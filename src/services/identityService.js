const cheerio = require('cheerio');
const fetchUtil = require('../utils/fetchUtil');
const collectDAO = require('../repositories/collectDAO');
const { SELECTORS, STATUS_FLAGS, URL_PATTERNS } = require('../config/const');


module.exports = class collectService {
    headers_des = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
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
        if(this.position < 1) this.position = await this.getTotalPostCount(); // 총 게시글 수 조회
        await this.getNicknameFromPostLists(); // 페이지에서 게시글 목록 조회
        await this.getNicknameFromCommentsInPost(); // 게시글 별 댓글 조회
        this.updateStatus();

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
    
    async getNicknameFromPostLists() { //des
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
                
                if(uid) {
                    const nick = $(element).find(SELECTORS.POST_WRITER).attr(SELECTORS.POST_NICK_ATTR);
                    const no = $(element).attr(SELECTORS.POST_NO_ATTR); 
                    
                    if(nick === 'ㅇㅇ') {
                        if(!(this.identityMap.has(uid))) {
                            this.identityMap.set(uid, nick);
                            this.newIdentityMap.set(uid, nick);
                        }
                        this.postNoSet.add({uid, no});
                    }
                    const hasComment = $(element).find(SELECTORS.POST_HAS_COMMENT).text();

                    if(hasComment) this.hasCommentPostNoSet.add(no);
                }
            });
            
            if(this.unitType === 'page') this.statBit |= STATUS_FLAGS.NO_MORE_POSTS; // restPage
        }
    }

    async getNicknameFromCommentsInPost() { //mob
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
                        const response = await this.fetchUtil.axiosFetcher(url, 'POST', this.headers_mob, 1, data);
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
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500) + 300);
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
                
                if(uid && nick === 'ㅇㅇ') { // 닉네임이 ㅇㅇ
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

    async insertToID() {
        try {
            //await this.checkUIDisValid(); // UID가 탈퇴했는지 확인

            for(let [uid, nick] of this.identityMap) { // id 추가
                await this.collectDAO.insertUid(uid, nick, this.galleryId);
            }
            for(let v of this.postNoSet) { 
                if(this.identityMap.has(v.uid)) await this.collectDAO.insertPostCommentNo(1, v.uid, v.no, this.galleryId);
            }
            for(let v of this.commentNoSet) { 
                if(this.identityMap.has(v.uid)) await this.collectDAO.insertPostCommentNo(0, v.uid, v.no, this.galleryId);
            }
        } catch (error) {
            console.log(error);
        } finally {
            this.identityMap.clear();
            this.postNoSet.clear();
            this.commentNoSet.clear();
        }
    }

    async checkUIDisValid() { // mob
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

    remainHighNos() {
        const grouped = new Map();

        for(const item of this.postNoSet) {
            const uid = item.uid;
            if(!grouped.has(uid)) {

            } else {

            }
        }
    }

    async getCommentNoByUID() {
        const data = await this.collectDAO.getCommentNoByUID(this.identityCode);
        return data;
    }

    async getPostNoByUID() {
        const data = await this.collectDAO.getPostNoByUID(this.identityCode);
        return data;
    }

    async deleteGarbage() {
        const data = await this.collectDAO.getUIDByGalleryCode(this.galleryId);

        for(let e of data) {
            if(this.stopFlag) break;
            try {
                const url = URL_PATTERNS.USER_GALLOG_MAIN(e.identityCode);
                const response = this.fetchUtil.axiosFetcher(url, 'GET', this.headers_des);

                console.log(e.identityCode, response.status);

                if (response.status === 404) {
                    await this.collectDAO.deleteGarbage(e.identityCode);
                    this.SSEUtil.SSESendEvent('delete', {
                        id: e.identityCode,
                    });
                    console.log(`${e.identityCode} 삭제 완료.`);                
                }  
            } catch (error) {
                console.log(error);
            }
        }
    }

    updateStatus() {
        this.restPage = (this.statBit & STATUS_FLAGS.NO_MORE_POSTS) ? this.restPage - 1: this.restPage;

        this.position = (this.statBit & STATUS_FLAGS.INVALID_POSITION) ? this.position - 10000: this.position; 

        this.curPage = (this.statBit & STATUS_FLAGS.INVALID_PAGE) ? 1 : this.curPage + 1;

        this.statBit = 0;
    }
}

// 만들어볼 것? 해당 유저의 탈퇴 유무를 언제 점검하는지? 
// 페이지 대신 포지션별로 조회하는 기능

/*
async getNicknameFromCommentsInPost() { // mob
        const postNoArr = Array.from(this.hasCommentPostNoSet);

        for ( 
            let i = 0, batch = Math.floor(Math.random() * 5) + 20; 
            i < postNoArr.length; 
            i += batch, batch = Math.floor(Math.random() * 5) + 20
        ) { 
            const slicedArr = postNoArr.slice(i, i + batch); 
            const results = await Promise.allSettled( // 댓글 api
                slicedArr.map((no) => {
                    const url = this.commentApi;
                    const data = {
                        'id': this.galleryId,
                        'no': no,
                        'cpage': 1,
                    };
                    this.headers_mob['Referer'] = `https://m.dcinside.com/board/${this.galleryId}/${no}`;
                    return this.fetchUtil.axiosFetcher(url, 'POST', this.headers_mob, 0, data);
                })
            );

            results.forEach((response, index) => {
                const no = postNoArr[i + index];

                if (response.status === "fulfilled") {
                    const html = response.value.data;
                    const $ = cheerio.load(html);
                    $('.all-comment-lst li').each((index, element) => {
                        const uid = $(element).find('a .blockCommentId').attr('data-info');
                        const nick = $(element).find('a.nick').text();
                        
                        if(uid && nick === 'ㅇㅇ') { // 닉네임이 ㅇㅇ
                            this.idMap.set(uid, nick);
                            this.noSetC.add({uid, no});
                        }
                    });
                } else {
                    postNoArr.push(no);
                    console.log(response.reason, no);
                }
            });
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 150) + 100)); // 디도스 방지 딜레이 
        }
    }

*/