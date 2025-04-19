
const SSEUtil = require('../utils/SSEUtil');
const identityService = require('../services/identityService');

module.exports = class identityController {
    stopFlag = true;
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
            default:
                content = nickname;
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
            isProxy: isProxy,
        });
        this.stopFlag = false;
    }
    
    async getNicknameFromSite(req, res) { 
        this.SSEUtil.init(req, res);
        this.SSEUtil.SSEInitHeader();

        while(!(this.stopFlag)) {
            const { newIdentityCodes, status } = await this.identityService.getNicknameFromSite();

            if(status.restPage <= 0 || status.position <= 0) this.stopFlag = true;
            
            if(newIdentityCodes && newIdentityCodes.length > 0) this.SSEUtil.SSESendEvent('fixed-nick', newIdentityCodes);
            this.SSEUtil.SSESendEvent('status', status);
        }
        console.log('식별코드 수집 완료.');
        
        await this.identityService.insertToID();

        this.SSEUtil.SSESendEvent('complete', '');
        this.SSEUtil.SSEendEvent();

        console.log('식별코드 삽입 작업 완료.');
    }

    stopSearch() {
        this.stopFlag = true;
        console.log("작업 중지 요청됨. 대기중...");
    }
}