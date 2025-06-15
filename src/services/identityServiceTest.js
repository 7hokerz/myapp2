const { STATUS_FLAGS } = require('../config/const');
const PersistenceManager = require('../repositories/persistenceManager');

class CollectService {
    stopFlag = true;
    identityMap = new Map(); // UID
    newIdentityMap = new Map(); // UID
    postNoSet = new Set(); // 게시글 번호 
    commentNoSet = new Set(); // 댓글 (게시글 번호)
    hasCommentPostNoSet = new Set(); // 댓글을 가지고 있는 게시글 번호

    persistenceManager = new PersistenceManager();
    
    constructor(collectDAO, siteApiClient, dataParser) {
        this.collectDAO = collectDAO;
        this.dataParser = dataParser;
        this.siteApiClient = siteApiClient;
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
        const data = await this.siteApiClient.getTotalPostFromSite(this.galleryId);
        return this.dataParser.parseTotalPostCount(data);
    }
    
    async _getNicknameFromPostLists() { // des
        const searchOptions = {
            page: this.curPage,
            position: this.position,
            type: this.type,
            content: this.content,
        };
        const { data, request } = await this.siteApiClient.getUsersFromPostListFiltered(this.galleryType, this.galleryId, searchOptions);
        
        const resurl = new URL(request.res.responseUrl);
        const urlPage = Number(resurl.searchParams.get('page'));

        const hasPosts = urlPage > 0 && this.dataParser.parsePagePostCount(data); // 페이지에 게시글이 존재하는가?
        
        const isValidPage = hasPosts && this.curPage === urlPage; // 이전에 조회한 적 없거나 유효한 페이지인가?
        
        if (!isValidPage) {
            this.statBit |= (hasPosts && this.unitType === 'page') ? 0 : STATUS_FLAGS.NO_MORE_POSTS;
            this.statBit |= STATUS_FLAGS.INVALID_POSITION;
            this.statBit |= STATUS_FLAGS.INVALID_PAGE;
        } else {
            const { users, posts } = this.dataParser.parseUsersFromPostList(data);

            users.forEach((value, key) => {
                if(!(this.identityMap.has(key))){
                    this.identityMap.set(key, value);
                    this.newIdentityMap.set(key, value);
                }
            });

            posts.forEach(post => {
                if(post.uid === null) this.hasCommentPostNoSet.add(post);
                else this.postNoSet.add(post);
            });
            
            if(this.unitType === 'page') this.statBit |= STATUS_FLAGS.NO_MORE_POSTS; // restPage
        }
        await new Promise(resolve => setTimeout(resolve, Math.random() * 250 + 250));
    }

    async _getNicknameFromPostListsAll() { // des
        const data = await this.siteApiClient.getUsersFromPostList(this.galleryType, this.galleryId, { page: this.curPage })

        const { users, posts } = this.dataParser.parseUsersFromPostList(data);

        users.forEach((value, key) => {
            if(!(this.identityMap.has(key))){
                this.identityMap.set(key, value);
                this.newIdentityMap.set(key, value);
            }
        });

        posts.forEach(post => {
            if(post.uid === null) this.hasCommentPostNoSet.add(post);
            else this.postNoSet.add(post);
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
                batch.map(async ({no}) => {
                    try {
                        const data = await this.siteApiClient.getUsersFromComments(this.galleryId, {no, csrfToken: this.csrfToken});
                        return { no, data };
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
            const { no, data } = value;
            const { users, comments } = this.dataParser.parseUsersFromComments(data, no);

            users.forEach((value, key) => {
                if(!(this.identityMap.has(key))){
                    this.identityMap.set(key, value);
                    this.newIdentityMap.set(key, value);
                }
            });

            comments.forEach(comment => {
                this.commentNoSet.add(comment);
            });
        } else {
            //currentQueue.push(no);
            console.log(reason, no);
        }
    }

    async _insertUIDs() {
        try {//await this._checkUIDisValid(); // UID가 탈퇴했는지 확인
            const allPostItems = Array.from(this.postNoSet);
            const allCommentItems = Array.from(this.commentNoSet);

            await this.persistenceManager.processAndInsertData(
                this.identityMap, allPostItems, allCommentItems, this.galleryId);

        } catch (error) {
            console.error("Error during data insertion: " + error);
        } finally {
            this.identityMap.clear();
            this.postNoSet.clear();
            this.commentNoSet.clear();
        }
    }

    async _compareUIDs() {
        try{
            const users = Array.from(this.identityMap.keys());
            const combinedResults = await this.persistenceManager.processAndCompareData(
                users, this.postNoSet, this.commentNoSet
            )
            return combinedResults;
        } catch (error) {
            console.error("Error during data comparison:" + error);
        } finally {
            this.identityMap.clear();
            this.postNoSet.clear();
            this.commentNoSet.clear();
        }
    }

    async _getCsrfToken() {
        if(!this.csrfToken) {
            const data = await this.siteApiClient.getCsrfTokenFromPage(this.galleryId);
            this.csrfToken = this.dataParser.parseCsrfTokenFromPage(data);
        }
    }
}

module.exports = CollectService;
