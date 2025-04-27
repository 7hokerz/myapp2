const cheerio = require('cheerio');
const fetchUtil = require('../utils/fetchUtil');
const collectDAO = require('../repositories/collectDAO');
const { SELECTORS, STATUS_FLAGS, URL_PATTERNS } = require('../config/const');


module.exports = class collectService {
    headers_des = {
        'Accept': 'text/html',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Cookie': 'used_darkmode=1; darkmode=1; alarm_popup=1; ck_img_view_cnt=4;',
        'Host': 'gall.dcinside.com',
        'Pragma': 'no-cache',
        'Referer': 'https://www.dcinside.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'sec-ch-ua': '"Chromium";v="134", " Not A;Brand";v="24", "Google Chrome";v="134"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': 'Windows',
    };
    headers_mob = {
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'ko-KR,ko;q=0.6',
        'Connection': 'keep-alive',
        'Host': 'm.dcinside.com',
        'Origin': 'https://m.dcinside.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-GPC': 1,
        'X-Requested-With': 'XMLHttpRequest',
        'sec-ch-ua': '"Chromium";v="134", " Not A;Brand";v="24", "Google Chrome";v="134"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': 'Android',
    };
    collectDAO = new collectDAO();
    identityMap = new Map(); // UID
    newIdentityMap = new Map(); // UID
    postNoSet = new Set(); // 게시글 번호 
    commentNoSet = new Set(); // 댓글 (게시글 번호)
    hasCommentPostNoSet = new Set(); // 댓글을 가지고 있는 게시글 번호
    statBit = 0;
    curPage = 1;

    constructor(
        { SSEUtil, galleryType, galleryId, limit, pos, content, type, id, unitType, isProxy }
    ) {
        this.fetchUtil = new fetchUtil(isProxy);
        this.SSEUtil = SSEUtil;
        this.galleryType = galleryType;
        this.galleryId = galleryId;
        this.restPage = Number(limit);
        this.position = Number(pos);
        this.content = content;
        this.type = type;
        this.unitType = unitType;
        this.id = id;
    }

    async getNicknameFromSite() {
        //await this.collectDAO.test();
        if(this.type === 'search_all') {
            this.position = 1;
            await this._getNicknameFromPostListsAll(); // 페이지에서 게시글 목록 조회
        } else {
            if(this.position < 1) this.position = await this.getTotalPostCount(); // 총 게시글 수 조회
            await this._getNicknameFromPostLists(); // 페이지에서 게시글 목록 조회
        }
        await this._getNicknameFromCommentsInPost(); // 게시글 별 댓글 조회
        
        this._updateStatus();
        if(this.type === 'search_all') this.restPage--;

        const newIdentityCodes = Array.from(this.newIdentityMap);

        this.newIdentityMap.clear();
        this.hasCommentPostNoSet.clear();
        
        return {
            newIdentityCodes: newIdentityCodes,
            status: {
                restPage: this.restPage, 
                curPage: this.curPage - 1,
                position: this.position
            }
        }
    }

    async getTotalPostCount() { // mob
        const response = await this.fetchUtil.axiosFetcher(URL_PATTERNS.GALLERY_MOB(this.galleryId), 'GET', this.headers_mob, 1);
        const html = response.data;
        const $ = cheerio.load(html);

        const tot = $(SELECTORS.POST_COUNT).text().replace(/[^0-9]/g, "");

        return tot;
    }
    
    async _getNicknameFromPostLists() { // des
        const response = await this.fetchUtil.axiosFetcher(
            URL_PATTERNS.POST_SEARCH_DES(this.galleryType, this.galleryId, this.curPage, this.position, this.type, this.content), 'GET', this.headers_des);
        
        const resurl = new URL(response.request.res.responseUrl);
        const urlPage = Number(resurl.searchParams.get('page'));
        
        const html = response.data;
        const $ = cheerio.load(html);

        const hasPosts = urlPage > 0 && $(SELECTORS.POST_ITEM).length; // 페이지에 게시글이 존재하는가?
        
        const isValidPage = hasPosts && this.curPage === urlPage; // 이전에 조회한 적 없거나 유효한 페이지인가?
        
        if (!isValidPage) {
            this.statBit |= (hasPosts && this.unitType === 'page') ? 0 : STATUS_FLAGS.NO_MORE_POSTS;
            this.statBit |= STATUS_FLAGS.INVALID_POSITION;
            this.statBit |= STATUS_FLAGS.INVALID_PAGE;
        } else {
            $(SELECTORS.POST_ITEM).each((index, element) => {
                const uid = $(element).find(SELECTORS.POST_WRITER).attr(SELECTORS.POST_UID_ATTR);
                const no = $(element).attr(SELECTORS.POST_NO_ATTR); 

                if(uid) {
                    const nick = $(element).find(SELECTORS.POST_WRITER).attr(SELECTORS.POST_NICK_ATTR);
                    
                    if(nick === 'ㅇㅇ') {
                        if(!(this.identityMap.has(uid))) {
                            this.identityMap.set(uid, nick);
                            this.newIdentityMap.set(uid, nick);
                        }
                        this.postNoSet.add({uid, no});
                    }
                }
                const hasComment = $(element).find(SELECTORS.POST_HAS_COMMENT).text();

                if(hasComment) this.hasCommentPostNoSet.add(no);
            });
            
            if(this.unitType === 'page') this.statBit |= STATUS_FLAGS.NO_MORE_POSTS; // restPage
        }
    }

    async _getNicknameFromPostListsAll() { // des
        const response = await this.fetchUtil.axiosFetcher(
            URL_PATTERNS.POST_LIST_DES(this.galleryType, this.galleryId, this.curPage), 'GET', this.headers);

        const html = response.data;
        const $ = cheerio.load(html);

        $(SELECTORS.POST_ITEM).each((index, element) => {
            const type = $(element).attr(SELECTORS.POST_TYPE_ATTR);
            const uid = $(element).find(SELECTORS.POST_WRITER).attr(SELECTORS.POST_UID_ATTR);
            const no = $(element).attr(SELECTORS.POST_NO_ATTR);
            
            if(type !== SELECTORS.POST_TYPE_NOTICE) { 
                if (uid) {
                    const nick = $(element).find(SELECTORS.POST_WRITER).attr(SELECTORS.POST_NICK_ATTR);

                    if(nick/* === 'ㅇㅇ'*/) {
                        if(!(this.identityMap.has(uid))) {
                            this.identityMap.set(uid, nick);
                            this.newIdentityMap.set(uid, nick);
                        }
                        this.postNoSet.add({uid, no});
                    }
                }
                const hasComment = $(element).find(SELECTORS.POST_HAS_COMMENT).text();

                if(hasComment) this.hasCommentPostNoSet.add(no);
            }
        });
    }

    async _getNicknameFromCommentsInPost() { //mob
        const postNoQueue = Array.from(this.hasCommentPostNoSet);
        let currentQueue = [...postNoQueue];

        while(currentQueue.length > 0) {
            let batchSize = Math.floor(Math.random() * 5) + 20; 
            const batch = currentQueue.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (no) => {
                    const url = URL_PATTERNS.COMMENT_API();
                    const data = {
                        'id': this.galleryId,
                        'no': no,
                        'cpage': 1,
                    };
                    this.headers_mob['Referer'] = URL_PATTERNS.POST_MOB(this.galleryId, no);
                    try {
                        const response = await this.fetchUtil.axiosFetcher(url, 'POST', this.headers_mob, 1, data, 15000);
                        return { no, response: response };
                    } catch (error) {
                        return { no, reason: error };
                    }
                })
            );

            results.forEach(result => {
                this._processCommentResult(result, currentQueue);
            });
            // 배치 처리 후 딜레이
            if (currentQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500) + 500);
            }
        }
    }

    async _processCommentResult(result, currentQueue) {
        const { status, value, reason } = result;

        if(status === "fulfilled") {
            const { no, response } = value;
            const html = response.data;
            const $ = cheerio.load(html);
            $(SELECTORS.COMMENT_ITEM).each((index, element) => {
                const uid = $(element).find(SELECTORS.COMMENT_UID_ITEM).attr(SELECTORS.COMMENT_UID_ATTR);
                const nick = $(element).find(SELECTORS.COMMENT_NICK_ATTR).text();
                
                if(uid /*&& nick === 'ㅇㅇ'*/) { // 닉네임이 ㅇㅇ
                    if(!(this.identityMap.has(uid))) {
                        this.identityMap.set(uid, nick);
                        this.newIdentityMap.set(uid, nick);
                    }
                    this.commentNoSet.add({uid, no});
                }
            });
        } else {
            //currentQueue.push(no);
            console.log(reason, no);
        }
    }

    async insertUIDs() {
        try {
            let startTime = 0, endTime = 0, time = 0;
            //await this._checkUIDisValid(); // UID가 탈퇴했는지 확인

            for(let [uid, nick] of this.identityMap) { // id 추가
                await this.collectDAO.insertUid(uid, nick, this.galleryId);
            }
            const allPostItems = Array.from(this.postNoSet); // 병렬
            const allCommentItems = Array.from(this.commentNoSet); // 병렬

            const groupedByUidPost = allPostItems.reduce((acc, item) => {
                const { uid } = item;
                if (!acc[uid]) {
                    acc[uid] = []; // 해당 UID 키가 없으면 빈 배열로 초기화
                }
                acc[uid].push(item); // 현재 아이템을 해당 UID 배열에 추가
                return acc;
            }, {});

            const groupedByUidComment = allCommentItems.reduce((acc, item) => {
                const { uid, no } = item;
                if (!acc[uid]) {
                    acc[uid] = []; // 해당 UID 키가 없으면 빈 배열로 초기화
                }
                const alreadyExists = acc[uid].some(existingItem => existingItem.no === no);

                if (!alreadyExists) {
                    acc[uid].push(item);
                }
                return acc;
            }, {});

            const itemsToProcessPost = Object.values(groupedByUidPost).flatMap(group => {
                // 'no' 값을 기준으로 내림차순 정렬 (큰 값이 먼저 오도록)
                group.sort((itemA, itemB) => itemB.no - itemA.no);
                // 정렬된 그룹에서 상위 2개 아이템만 선택 (slice는 원본 배열을 변경하지 않음)
                return group.slice(0, 2);
            });

            const itemsToProcessComment = Object.values(groupedByUidComment).flatMap(group => {
                // 'no' 값을 기준으로 내림차순 정렬 (큰 값이 먼저 오도록)
                group.sort((itemA, itemB) => itemB.no - itemA.no);
                // 정렬된 그룹에서 상위 2개 아이템만 선택 (slice는 원본 배열을 변경하지 않음)
                return group.slice(0, 2);
            });

            const postNoQueue = [...itemsToProcessPost];
            const commentNoQueue = [...itemsToProcessComment];
            startTime = Date.now();
            while(postNoQueue.length > 0) {
                let batchSize = 20;
                const batch = postNoQueue.splice(0, batchSize);

                await Promise.allSettled(
                    batch.map(async (item) => {
                        const { uid, no } = item;
                        try {
                            await this.collectDAO.insertPostCommentNo(1, uid, no, this.galleryId);
                            return { uid, no };
                        } catch (error) {
                            return console.log(error);
                        }
                    })
                );
            }/*
            for(let item of this.postNoSet) { // 순차
                if(this.identityMap.has(item.uid)) await this.collectDAO.insertPostCommentNo(1, item.uid, item.no, this.galleryId);
            }*/
            endTime = Date.now();
            time = endTime - startTime;
            console.log(`Concurrent operations finished in ${time} ms.`);

            startTime = Date.now();
            while(commentNoQueue.length > 0) {
                let batchSize = 20;
                const batch = commentNoQueue.splice(0, batchSize);

                await Promise.allSettled(
                    batch.map(async (item) => {
                        const { uid, no } = item;
                        try {
                            await this.collectDAO.insertPostCommentNo(0, uid, no, this.galleryId);
                            return { uid, no };
                        } catch (error) {
                            return console.log(error);
                        }
                    })
                );
            }
            /*for(let item of this.commentNoSet) { // 순차
                if(this.identityMap.has(item.uid)) await this.collectDAO.insertPostCommentNo(0, item.uid, item.no, this.galleryId);
            }*/
            endTime = Date.now();
            time = endTime - startTime;
            console.log(`Concurrent operations finished in ${time} ms.`);
        } catch (error) {
            console.log(error);
        } finally {
            this.identityMap.clear();
            this.postNoSet.clear();
            this.commentNoSet.clear();
        }
    }

    async compareUIDs() {
        let combinedResults = [];
        try{
            const uidsArray = Array.from(this.identityMap.keys());
            const results = await this.collectDAO.compareUIDs(uidsArray);

            const DataMap = new Map();
            for (const item of this.postNoSet) {
                if (item && item.uid !== undefined) {
                    DataMap.set(item.uid, item.no);
                } else {
                    console.warn("Invalid item found in postNoSet:", item);
                }
            }
            for (const item of this.commentNoSet) {
                if (item && item.uid !== undefined) {
                    DataMap.set(item.uid, item.no);
                } else {
                    console.warn("Invalid item found in commentNoSet:", item);
                }
            }

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
            console.log(error);
        }   finally {
            this.identityMap.clear();
            this.postNoSet.clear();
            this.commentNoSet.clear();
        }
    }

    async _checkUIDisValidX() { // mob
        const currentQueue = Array.from(this.identityMap.keys());

        while(currentQueue.length > 0) {
            let batchSize = Math.floor(Math.random() * 5) + 20; 
            const batch = currentQueue.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (uid) => {
                    const url = URL_PATTERNS.USER_GALLOG_MAIN(uid);
                    
                    try {
                        const response = await this.fetchUtil.axiosFetcher(url, 'GET', this.headers_des);
                        return { uid, response: response };
                    } catch (error) {
                        return { uid, reason: error };
                    }
                })
            );

            results.forEach(result => {
                const { status, value, reason } = result;
                // 특정 경우(500?)에서는 response가 undefined로 표시되는 경우 존재. 이러한 경우가 드물게 존재하는데.
                if(status === "fulfilled"){
                    const { uid, response } = value;
                    
                    if(response && response.status && response.status === 404) {
                        this.identityMap.delete(uid);
                        //console.log(`${uid}는 존재하지 않음.`);
                    }
                } else {
                    //currentQueue.push(uid);
                    console.log(reason, uid);
                }
            });

            if (currentQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500) + 500);
            }
        }
    }

    async chkUIDisValid() {
        const UIDs = await this.collectDAO.getValidUIDs();

        while(UIDs.length > 0) {
            let batchSize = Math.floor(Math.random() * 5) + 20; 
            const batch = UIDs.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (uid) => {
                    const url = URL_PATTERNS.USER_GALLOG_MAIN(uid);
                    
                    try {
                        const response = await this.fetchUtil.axiosFetcher(url, 'GET', this.headers_des);
                        return { uid, response: response };
                    } catch (error) {
                        return { uid, reason: error };
                    }
                })
            );

            results.forEach(result => {
                const { status, value, reason } = result;
                // 특정 경우(500?)에서는 response가 undefined로 표시되는 경우 존재. 이러한 경우가 드물게 존재하는데.
                if(status === "fulfilled"){
                    const { uid, response } = value;
                    
                    if(response && response.status && response.status === 404) {
                        this.collectDAO.updateVaild(uid);
                        //console.log(`${uid}는 존재하지 않음.`);
                    }
                } else {
                    //currentQueue.push(uid);
                    console.log(reason);
                }
            });

            if (UIDs.length > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500) + 500);
            }
        }
    }

    async chkPostisExist() { //미완성
        const posts = await this.collectDAO.getAllPosts();

        while(posts.length > 0) {
            let batchSize = 20; 
            const batch = posts.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (no, gid) => {
                    const url = URL_PATTERNS.POST_DES(this.galleryType, this.galleryId, no);
                    
                    try {
                        const response = await this.fetchUtil.axiosFetcher(url, 'GET', this.headers_des);
                        return { no, gid, response: response };
                    } catch (error) {
                        return { no, gid, reason: error };
                    }
                })
            );

            results.forEach(result => {
                const { status, value, reason } = result;
                // 특정 경우(500?)에서는 response가 undefined로 표시되는 경우 존재. 이러한 경우가 드물게 존재하는데.
                if(status === "fulfilled"){
                    const { no, gid, response } = value;
                    
                    if(response && response.status && response.status === 404) {
                        this.collectDAO.deletePostInDB(no, gid);
                    }
                } else {
                    console.log(reason);
                }
            });
        }
    }

    _updateStatus() {
        this.restPage = (this.statBit & STATUS_FLAGS.NO_MORE_POSTS) ? this.restPage - 1: this.restPage;

        this.position = (this.statBit & STATUS_FLAGS.INVALID_POSITION) ? this.position - 10000: this.position; 

        this.curPage = (this.statBit & STATUS_FLAGS.INVALID_PAGE) ? 1 : this.curPage + 1;

        this.statBit = 0;
    }
}

/*
    만들어볼 것? 해당 유저의 탈퇴 유무를 언제 점검하는지? 
    DB의 구조 변경 필요(컬럼 추가 및 AI?)
*/