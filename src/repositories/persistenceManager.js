const pool = require('../config/mysql');
const CollectDAO = require('./collectDAOTest');

class PersistenceManager {
    constructor() {
        
    }

    collectDAO = new CollectDAO();

    async processAndInsertData(
        identityMap,
        allPostItems,
        allCommentItems,
        galleryCode
    ) {
        for(let [identityCode, nickname] of identityMap) { // id 추가
            await this._insertUser({identityCode, nickname, galleryCode})
        }

        const postQueue = this._processPost(allPostItems);
        const commentQueue = this._processComment(allCommentItems);
        
        await this._batchPostData(postQueue, galleryCode);
        await this._batchCommentData(commentQueue, galleryCode);
    }

    async _insertUser(user) {
        let connection;
        try {
            connection = await pool.getConnection();
            await this.collectDAO.insertUser(connection, user);
        } catch (error) {
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async _insertOrUpdatePost(identityCode, galleryCode, postNo) {
        let connection;
        try {
            connection = await pool.getConnection();
            await connection.execute(`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`);
            await connection.beginTransaction();

            const existingPosts = await this.collectDAO.findPostNoByUser(connection, { identityCode, galleryCode });

            const isDuplicate = existingPosts.some(row => row.postNum == postNo) // 중복 번호 검증

            if (!isDuplicate) {
                if (existingPosts.length < 2) {
                    await this.collectDAO.insertPost(connection, { postNo, identityCode, galleryCode });
                } else {
                    const smallestPostNo = existingPosts[0].postNum;
                    if(postNo > smallestPostNo) {
                        await this.collectDAO.updatePost(connection, { postNo, smallestPostNo, identityCode, galleryCode });
                    }
                }
            }
            await connection.commit();
        } catch (error) {
            if(connection) {
                await connection.rollback();
            }
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async _insertOrUpdateComment(identityCode, galleryCode, postNo, commentNo) {
        let connection;
        try {
            connection = await pool.getConnection();
            await connection.execute(`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`);
            await connection.beginTransaction();

            const existingComments = await this.collectDAO.findCommentNoByUser(
                connection, { identityCode, galleryCode });
            
            const isDuplicate = existingComments.some(row => row.postNum == postNo) // 중복 번호 검증

            if(!isDuplicate) {
                if(existingComments.length < 2) {
                    await this.collectDAO.insertComment(
                        connection, { postNo, identityCode, galleryCode, commentNo }); 
                } else {
                    const smallestPostNo = existingComments[0].postNum;
                    if(postNo > smallestPostNo) {
                        await this.collectDAO.updateComment(
                            connection, { postNo, commentNo, smallestPostNo, identityCode, galleryCode });
                    }
                }
            }
            await connection.commit();
        } catch (error) {
            if(connection) {
                await connection.rollback();
            }
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    _processPost(allPostItems) {
        const groupedByUidPost = allPostItems.reduce((acc, item) => {
            const { uid } = item;
            if (!acc[uid]) {
                acc[uid] = []; // 해당 UID 키가 없으면 빈 배열로 초기화
            }
            acc[uid].push(item); // 현재 아이템을 해당 UID 배열에 추가
            return acc;
        }, {});

        const itemsToProcessPost = Object.values(groupedByUidPost).flatMap(group => {
            // 'no' 값을 기준으로 내림차순 정렬 (큰 값이 먼저 오도록)
            group.sort((itemA, itemB) => itemB.no - itemA.no);
            // 정렬된 그룹에서 상위 2개 아이템만 선택 (slice는 원본 배열을 변경하지 않음)
            return group.slice(0, 2);
        });
        return itemsToProcessPost;
    }

    _processComment(allCommentItems) {
        const groupedByUidComment = allCommentItems.reduce((acc, item) => {
            const { uid, postNo } = item;
            if (!acc[uid]) {
                acc[uid] = []; // 해당 UID 키가 없으면 빈 배열로 초기화
            }
            const alreadyExists = acc[uid].some(existingItem => existingItem.postNo === postNo);

            if (!alreadyExists) {
                acc[uid].push(item);
            }
            return acc;
        }, {});

        const itemsToProcessComment = Object.values(groupedByUidComment).flatMap(group => {
            // 'no' 값을 기준으로 내림차순 정렬 (큰 값이 먼저 오도록)
            group.sort((itemA, itemB) => itemB.postNo - itemA.postNo);
            // 정렬된 그룹에서 상위 2개 아이템만 선택 (slice는 원본 배열을 변경하지 않음)
            return group.slice(0, 2);
        });
        return itemsToProcessComment;
    }

    async _batchPostData(postQueue, galleryCode) {
        let startTime = Date.now();
        while(postQueue.length > 0) {
            let batchSize = 20;
            const batch = postQueue.splice(0, batchSize);
            const results = await Promise.allSettled(
                batch.map(async (item) => {
                    await this._insertOrUpdatePost(item.uid, galleryCode, item.no);
                    return item;
                })
            );
            const failedTasks = results.filter(result => result.status === 'rejected');
            if (failedTasks.length > 0) {
                console.error(`[Batch Error] ${failedTasks.length}개의 항목을 처리하는 데 실패했습니다.`);
                // 실패한 항목들에 대한 후속 처리 (예: 재시도 큐에 넣기, 에러 로그 DB에 저장)
                failedTasks.forEach(task => console.error(task.reason));
            }
        }

        let endTime = Date.now();
        let time = endTime - startTime;
        console.log(`Concurrent operations finished in ${time} ms.`);
    }

    async _batchCommentData(commentQueue, galleryCode) {
        let startTime = Date.now();
        while(commentQueue.length > 0) {
            let batchSize = 20;
            const batch = commentQueue.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (item) => {
                    await this._insertOrUpdateComment(
                        item.uid, galleryCode, item.postNo, item.commentNo
                    )
                    return item;
                })
            );

            const failedTasks = results.filter(result => result.status === 'rejected');
            if (failedTasks.length > 0) {
                console.error(`[Batch Error] ${failedTasks.length}개의 항목을 처리하는 데 실패했습니다.`);
                // 실패한 항목들에 대한 후속 처리 (예: 재시도 큐에 넣기, 에러 로그 DB에 저장)
                failedTasks.forEach(task => console.error(task.reason));
            }
        }
        let endTime = Date.now();
        let time = endTime - startTime;
        console.log(`Concurrent operations finished in ${time} ms.`);
    }

    async processAndCompareData(users, postNoSet, commentNoSet) {
        const DataMap = new Map();
        for (const item of postNoSet) {
            if (item && item.uid !== undefined) {
                DataMap.set(item.uid, item.no);
            } else {
                console.warn("Invalid item found in postNoSet:", item);
            }
        }
        for (const item of commentNoSet) {
            if (item && item.uid !== undefined) {
                DataMap.set(item.uid, item.postNo);
            } else {
                console.warn("Invalid item found in commentNoSet:", item);
            }
        }

        let connection;
        try {
            connection = await pool.getConnection();

            const posts = await this.collectDAO.findAllPostsByUsers(connection, users);
            const comments = await this.collectDAO.findAllCommentsByUsers(connection, users);
            const results = [...posts, ...comments];
            const combinedResults = [];

            for (const resultItem of results) {
                const { identityCode: uid, galleryCODE: GID, postNum } = resultItem;
                
                if (DataMap.has(uid)) {
                    const no = DataMap.get(uid);
    
                    const combinedItem = {
                        uid: uid,
                        GID: GID, 
                        postNum: postNum,
                        no: no,
                    };
                    combinedResults.push(combinedItem);
                }
            }
            combinedResults.sort((a, b) => {
                if(a.uid > b.uid) return 1;
                else return -1;
            });

            return combinedResults;
        } catch (error) {
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }



    }
}

module.exports = PersistenceManager;