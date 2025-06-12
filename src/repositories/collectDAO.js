const pool = require('../config/mysql');

class CollectDAO {
    async insertUid(identityCode, nickname, galleryCode) {
        const connection = await pool.getConnection();

        const query = `
        INSERT INTO fixed_name_list (identityCode, nickname, galleryCODE)
        VALUES(?, ?, ?)
        ON DUPLICATE KEY UPDATE
            nickname = VALUES(nickname)`;

        await connection.execute(query, [identityCode, nickname, galleryCode]);

        connection.release();
    }

    async insertPostNo(item, galleryCode) {
        const { uid: identityCode, no: postNum } = item;

        const checkQuery = `
            SELECT postNum FROM post_list p 
            JOIN fixed_name_list f
            ON f.identityCode = p.identityCode
                AND f.galleryCODE = p.galleryCODE
            WHERE f.identityCode = ? 
                AND f.galleryCODE = ?
            ORDER BY postNum ASC
            FOR UPDATE`;// 해당 갤러리 코드와 식별 코드가 일치하는 게시물 번호 (is_valid도 같이 가져오기)

        const insertPostQuery = `
            INSERT INTO post_list (postNum, identityCode, galleryCODE)
            VALUES(?, ?, ?)`;

        const updatePostQuery = `
            UPDATE post_list SET postNum = ?
            WHERE postNum = ? AND identityCode = ? AND galleryCODE = ?`;

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.execute(`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`);
            await connection.beginTransaction();

            const [rows] = await connection.execute(checkQuery, [identityCode, galleryCode]);

            const isDuplicate = rows.some(row => row.postNum == postNum) // 중복 번호 검증

            if(!isDuplicate) {
                if(rows.length < 2) {
                    await connection.execute(insertPostQuery, [postNum, identityCode, galleryCode]); 
                } else {
                    const smallestPostNum = rows[0].postNum;
                    if(postNum > smallestPostNum) {
                        await connection.execute(updatePostQuery, [postNum, smallestPostNum, identityCode, galleryCode]);
                    }
                }
            } 
            await connection.commit();

        } catch (error) { 
            console.error("Error in insertPostCommentNo:", error);
            if(connection) {
                await connection.rollback();
            }// 데드락 발생 시 재시도하는 로직 필요
        } finally {
            if (connection) {
                connection.release(); // 성공/실패 여부와 관계없이 커넥션 반환
            }
        }
    }

    async insertCommentNo(item, galleryCode) {
        const { uid: identityCode, no: postNum, commentNum } = item;
        const checkQuery = `
            SELECT postNum FROM comment_list c
            JOIN fixed_name_list f
            ON f.identityCode = c.identityCode
                AND f.galleryCODE = c.galleryCODE
            WHERE f.identityCode = ? 
                AND f.galleryCODE = ?
            ORDER BY postNum ASC
            FOR UPDATE`;

        const insertCommentQuery = `
            INSERT INTO comment_list (postNum, identityCode, galleryCODE, commentNum)
            VALUES(?, ?, ?, ?)`;

        const updateCommentQuery = `
            UPDATE comment_list SET postNum = ?, commentNum = ?
            WHERE postNum = ? AND identityCode = ? AND galleryCODE = ?`;

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.execute(`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`);
            await connection.beginTransaction();
            
            const [rows] = await connection.execute(checkQuery, [identityCode, galleryCode]);

            const isDuplicate = rows.some(row => row.postNum == postNum) // 중복 번호 검증

            if(!isDuplicate) {
                if(rows.length < 2) {
                    await connection.execute(insertCommentQuery, [
                        postNum, identityCode, galleryCode, commentNum]); 
                } else {
                    const smallestPostNum = rows[0].postNum;
                    if(postNum > smallestPostNum) {
                        await connection.execute(updateCommentQuery, [
                            postNum, commentNum, smallestPostNum, identityCode, galleryCode]);
                    }
                }
            } 
            await connection.commit();
            
        } catch (error) {
            if(connection) {
                await connection.rollback();
            }
        } finally {
            if (connection) {
                connection.release(); // 성공/실패 여부와 관계없이 커넥션 반환
            }
        }
    }

    async compareUIDs(uidsArray) {
        let connection;
        try {
            connection = await pool.getConnection();

            const queryPost = `
            SELECT f.identityCode, p.galleryCODE, p.postNum
            FROM fixed_name_list f
            JOIN post_list p
            ON f.identityCode = p.identityCode
            AND f.galleryCODE = p.galleryCODE
            WHERE f.is_valid = 0
            AND f.identityCode IN (?)`;

            const queryComment = `
            SELECT f.identityCode, c.galleryCODE, c.postNum
            FROM fixed_name_list f
            JOIN comment_list c
            ON f.identityCode = c.identityCode
            AND f.galleryCODE = c.galleryCODE
            WHERE f.is_valid = 0
            AND f.identityCode IN (?)`;
            
            const [rowsPost] = await connection.query(queryPost, [uidsArray]);

            const [rowsComment] = await connection.query(queryComment, [uidsArray]);

            return [...rowsPost, ...rowsComment];
        } catch (error) {
            console.error("Error in insertPostCommentNo:", error);
        } finally {
            if (connection) {
                connection.release(); // 성공/실패 여부와 관계없이 커넥션 반환
            }
        }
    }

    async getValidUIDs() {
        const connection = await pool.getConnection();

        const query = `
            SELECT DISTINCT identityCode
            FROM fixed_name_list
            WHERE is_valid = 0
            ORDER BY 1 ASC`;

        const [rows] = await connection.execute(query);

        connection.release();

        return rows;
    }

    async updateVaild(identityCode) { 
        const connection = await pool.getConnection();

        const query = `
            UPDATE fixed_name_list
            SET is_valid = 1
            WHERE identityCode = ?`;

        await connection.execute(query, [identityCode]);

        connection.release();
    }

    async getAllPosts(galleryCode) {
        const connection = await pool.getConnection();

        const queryPostTable = `
            SELECT postNum
            FROM post_list
            WHERE galleryCODE = ?
            ORDER BY postNum DESC`;

        const queryCommentTable = `
            SELECT postNum
            FROM comment_list
            WHERE galleryCODE = ?
            ORDER BY postNum DESC`;

        const [rows] = await connection.execute(queryPostTable, [galleryCode]);

        connection.release();

        return rows;
    }

    async deletePostInDB(postNum, galleryCode) {
        const queryPost = `
            DELETE FROM post_list
            WHERE postNum = ? 
            AND galleryCODE = ?`;
        
        const queryComment = `
            DELETE FROM comment_list
            WHERE postNum = ?
            AND galleryCODE = ?`;

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            await connection.execute(queryPost, [postNum, galleryCode]);
            await connection.execute(queryComment, [postNum, galleryCode]);

            await connection.commit();
        } catch (error) { 
            console.error("Error in deletePostInDB:", error);
            if(connection) {
                await connection.rollback();
            }
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async deleteCommentInDB(commentNum, galleryCode) {
        const queryComment = `
            DELETE FROM comment_list
            WHERE commentNum = ?
            AND galleryCODE = ?`;

        let connection;
        try {
            connection = await pool.getConnection();

            await connection.execute(queryComment, [commentNum, galleryCode]);

        } catch (error) { 
            console.error("Error in deleteCommentInDB:", error);
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async runRaceConditionTest(testFunction) {
        const array = [];
        for(let i = 4; i < 80; i += 2) {
            array.push(i);
        }
        
        try {
            let startTime = Date.now();/*
            for(let i = 0; i < array.length; i++) {
                await testFunction(true, 'explore7258', array[i], 'grsgills'); 
                await testFunction(true, 'explore4719', array[i] + 1, 'grsgills'); 
            }*/
            
            const results = await Promise.allSettled(
                array.map(async (no) => {
                    await testFunction(true, no % 2? 'explore7258': 'explore4719', no + 1, no % 2? 'girlsong': 'grsgills');
                    await testFunction(true, no % 2? 'explore4719': 'explore7258', no, no % 2? 'girlsong': 'grsgills'); 
                })
            );
            
            let endTime = Date.now();
            let time = endTime - startTime;
            console.log(`Concurrent operations finished in ${time} ms.`);

            results.forEach((result, i) => {
                if (result.status === 'rejected') {
                    console.error(`Error: ${result.reason}`);
                }
            });
            console.log("All operations completed successfully.");
        } catch (error) {
            console.error("Test failed:", error);
        }
    }

    async test() {
        await this.runRaceConditionTest(this.insertPostCommentNo);
    }
}

module.exports = CollectDAO;

/*
게시글, 댓글 분리 로직 필요





*/