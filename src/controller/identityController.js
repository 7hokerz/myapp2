const SSEUtil = require('../utils/SSEUtil');
const identityService = require('../services/identityService');
const checkService = require('../services/checkService');

module.exports = class identityController {
    SSEUtil = new SSEUtil();
    constructor() {
        
    }

    async init(req, res) {
        const { 
            galleryType, 
            GID: galleryId, 
            nickname, 
            keyword, 
            type, 
            UID: id, 
            pos, 
            limit,
            unitType,
            actionType,
            isProxy, 
        } = req.body;

        let content = null;
        switch (type) {
            case 'search_name':
                content = nickname;
                break;
            case 'search_subject_memo':
                content = keyword;
                break;
        }
        
        this.identityService = new identityService({
            SSEUtil: this.SSEUtil, 
            galleryType: galleryType, 
            galleryId: galleryId, 
            limit: limit, 
            pos: pos, 
            content: content, 
            type: type, 
            id: id, 
            unitType: unitType,
            actionType: actionType,
            isProxy: isProxy,
        });
    }
    
    async getNicknameFromSite(req, res) { 
        this.SSEUtil.init(req, res);
        this.SSEUtil.SSEInitHeader();

        try {
            await this.identityService.process();

            this.SSEUtil.SSESendEvent('complete', '');
        } catch (error) {
            console.error('Error during nickname collection:', error);
        } finally {
            this.SSEUtil.SSEendEvent();
        }
    }

    async chkPostExists() {
        this.checkService = new checkService();
        await this.checkService.chkPostExists();
    }

    async chkUIDisValid() {
        this.checkService = new checkService();
        await this.checkService.chkUIDisValid();
    }

    stopSearch() {
        if (this.identityService) {
            this.identityService.requestStop(); // 서비스에 중지 요청
            console.log("작업 중지 요청됨. 대기중...");
        }
    }
}