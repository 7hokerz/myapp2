const cheerio = require('cheerio');
const { SELECTORS, STATUS_FLAGS, URL_PATTERNS } = require('../config/const');
const { headers_des_chrome, headers_mob_chrome_comment_api, headers_mob_chrome_gallog } = require('../config/apiHeader');

class CollectService {
    stopFlag = true;
    identityMap = new Map(); // UID
    newIdentityMap = new Map(); // UID
    postNoSet = new Set(); // 게시글 번호 
    commentNoSet = new Set(); // 댓글 (게시글 번호)
    hasCommentPostNoSet = new Set(); // 댓글을 가지고 있는 게시글 번호
    
    constructor(collectDAO, fetchUtil) {
        this.collectDAO = collectDAO;
        this.fetchUtil = fetchUtil;
    }

    init({ sseUtil, galleryType, galleryId, limit, pos, content, type, id, unitType, actionType }) {
        this.SSEUtil = sseUtil;
        this.galleryType = galleryType;
        this.galleryId = galleryId;
        this.restPage = Number(limit);
        this.position = Number(pos);
        this.content = content;
        this.type = type;
        this.unitType = unitType;
        this.actionType = actionType;
        this.id = id;
        this.statBit = 0;
        this.curPage = 1;
    }

    requestStop() {
        this.stopFlag = true;
    }

    _updateStatus() {
        this.restPage = (this.statBit & STATUS_FLAGS.NO_MORE_POSTS) ? this.restPage - 1: this.restPage;

        this.position = (this.statBit & STATUS_FLAGS.INVALID_POSITION) ? this.position - 10000: this.position; 

        this.curPage = (this.statBit & STATUS_FLAGS.INVALID_PAGE) ? 1 : this.curPage + 1;

        this.statBit = 0;
    }

    async process() {
        try {
            this.stopFlag = false;

            if(this.type === 'search_all') {
                this.curPage = this.position || 1;
            } else if(this.position < 1) {
                this.position = await this._getTotalPostCount(); // 총 게시글 수 조회
            }
            await this._getCsrfToken(); // csrf token

            while(!this.stopFlag) {
                await this._getNicknameFromSite();

                const newIdentityCodes = Array.from(this.newIdentityMap);

                if(newIdentityCodes && newIdentityCodes.length > 0) this.SSEUtil.SSESendEvent('fixed-nick', newIdentityCodes);

                this.SSEUtil.SSESendEvent('status', {
                    restPage: this.restPage, 
                    curPage: this.curPage - 1,
                    position: this.position
                });

                this.newIdentityMap.clear();
                this.hasCommentPostNoSet.clear();

                if(this.restPage < 1 || this.position < 1) this.stopFlag = true;
            }
            console.log('식별코드 수집 완료.');

            if(this.actionType === 'insert') {
                await this._insertUIDs();

                console.log('식별코드 삽입 작업 완료.');
            } else {
                const results = await this._compareUIDs();

                this.SSEUtil.SSESendEvent('compare', results);

                console.log('식별코드 비교 작업 완료.');
            } 
        } catch (error) {
            console.error("Error in identityService.process:", error);
            this.SSEUtil.SSESendEvent('error', { message: 'Processing failed' });
        } finally {
            this.identityMap.clear();
            this.postNoSet.clear();
            this.commentNoSet.clear();
            this.newIdentityMap.clear();
            this.hasCommentPostNoSet.clear();
        }
    }

    async _getNicknameFromSite() {//await this.collectDAO.test();
        if(this.type === 'search_all') {
            await this._getNicknameFromPostListsAll(); // 페이지에서 게시글 목록 조회
        } else {
            await this._getNicknameFromPostLists(); // 페이지에서 게시글 목록 조회
        }
        await this._getNicknameFromCommentsInPost(); // 게시글 별 댓글 조회
        
        this._updateStatus();
        if(this.type === 'search_all') {
            this.restPage--;
        }
    }

    async _getTotalPostCount() { // mob (수정 필요)
        const response = await this.fetchUtil.axiosFetcher(
            URL_PATTERNS.GALLERY_MOB(this.galleryId), 'GET', {...headers_mob_chrome_comment_api}, 1);
        const html = response.data;
        const $ = cheerio.load(html);

        const tot = $(SELECTORS.POST_COUNT).text().replace(/[^0-9]/g, "");

        return tot;
    }
    
    async _getNicknameFromPostLists() { // des
        const response = await this.fetchUtil.axiosFetcher(
            URL_PATTERNS.POST_SEARCH_DES(this.galleryType, this.galleryId, this.curPage, this.position, this.type, this.content), 'GET', {...headers_des_chrome});
        
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
                    
                    if(nick) {
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
        await new Promise(resolve => setTimeout(resolve, Math.random() * 250 + 250));
    }

    async _getNicknameFromPostListsAll() { // des
        const response = await this.fetchUtil.axiosFetcher(
            URL_PATTERNS.POST_LIST_DES(this.galleryType, this.galleryId, this.curPage), 'GET', {...headers_des_chrome});

        const html = response.data;
        const $ = cheerio.load(html);

        $(SELECTORS.POST_ITEM).each((index, element) => {
            const type = $(element).attr(SELECTORS.POST_TYPE_ATTR);
            const uid = $(element).find(SELECTORS.POST_WRITER).attr(SELECTORS.POST_UID_ATTR);
            const no = $(element).attr(SELECTORS.POST_NO_ATTR);
            
            if(type !== SELECTORS.POST_TYPE_NOTICE) { 
                if (uid) {
                    const nick = $(element).find(SELECTORS.POST_WRITER).attr(SELECTORS.POST_NICK_ATTR);

                    if(nick) {
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
        await new Promise(resolve => setTimeout(resolve, Math.random() * 250 + 250));
    }

    async _getNicknameFromCommentsInPost() { // mob
        const postNoQueue = Array.from(this.hasCommentPostNoSet);
        let currentQueue = [...postNoQueue];

        while(currentQueue.length > 0) {
            let batchSize = Math.floor(Math.random() * 10) + 45; 
            const batch = currentQueue.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (no) => {
                    const url = URL_PATTERNS.COMMENT_API();
                    const data = {
                        'id': this.galleryId,
                        'no': no,
                        'cpage': 1,
                        'managerskill': '',
                        'csort': '',
                        'permission_pw': '',
                    };
                    const payload = `id=${this.galleryId}&no=${no}&cpage=1&managerskill=&csort=&permission_pw=`;
                    const headers_mob = {...headers_mob_chrome_comment_api};
                    headers_mob['Content-Length'] = payload.length;
                    headers_mob['Referer'] = URL_PATTERNS.POST_MOB(this.galleryId, no);
                    headers_mob['X-CSRF-TOKEN'] = this.csrfToken;
                    try {
                        const response = await this.fetchUtil.axiosFetcher(url, 'POST', headers_mob, 1, data, 5000);
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
                await new Promise(resolve => setTimeout(resolve, Math.random() * 250 + 250));
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
                const commentNum = $(element).attr('no');
                const uid = $(element).find(SELECTORS.COMMENT_UID_ITEM).attr(SELECTORS.COMMENT_UID_ATTR);
                const nick = $(element).find(SELECTORS.COMMENT_NICK_ATTR).text();
                
                if(uid) { 
                    if(!(this.identityMap.has(uid))) {
                        this.identityMap.set(uid, nick);
                        this.newIdentityMap.set(uid, nick);
                    }
                    this.commentNoSet.add({uid, no, commentNum});
                }
            });
        } else {
            //currentQueue.push(no);
            console.log(reason, no);
        }
    }

    async _insertUIDs() {
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
                            await this.collectDAO.insertPostNo(item, this.galleryId);
                            return { uid, no };
                        } catch (error) {
                            return console.log(error);
                        }
                    })
                );
            }
            endTime = Date.now();
            time = endTime - startTime;
            console.log(`Concurrent operations finished in ${time} ms.`);

            startTime = Date.now();
            while(commentNoQueue.length > 0) {
                let batchSize = 20;
                const batch = commentNoQueue.splice(0, batchSize);

                await Promise.allSettled(
                    batch.map(async (item) => {
                        const { uid, no, commentNum } = item;
                        try {
                            await this.collectDAO.insertCommentNo(item, this.galleryId);
                            return { uid, no, commentNum };
                        } catch (error) {
                            return console.log(error);
                        }
                    })
                );
            }
            endTime = Date.now();
            time = endTime - startTime;
            console.log(`Concurrent operations finished in ${time} ms.`);
        } catch (error) {
            console.error(error);
        } finally {
            this.identityMap.clear();
            this.postNoSet.clear();
            this.commentNoSet.clear();
        }
    }

    async _compareUIDs() {
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
        } finally {
            this.identityMap.clear();
            this.postNoSet.clear();
            this.commentNoSet.clear();
        }
    }

    async _getCsrfToken() {
        if(!this.csrfToken) {
            const response = await this.fetchUtil.axiosFetcher(
                URL_PATTERNS.GALLERY_MOB(this.galleryId), 'GET', {...headers_mob_chrome_gallog}, 1);

            const html = response.data;
            const $ = cheerio.load(html);
            this.csrfToken = $('meta[name="csrf-token"]').attr('content');
        }
    }
}

module.exports = CollectService;
