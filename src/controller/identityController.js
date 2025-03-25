
const SSEUtil = require('../utils/SSEUtil');
const identityService = require('../services/identityService');

module.exports = class identityController {
    
    constructor() {
        this.stopFlag = true;
        this.SSEUtil = new SSEUtil();
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
        
        this.identityService = new identityService(this.SSEUtil, galleryType, galleryId, limit, pos, content, type, id);
        this.stopFlag = false;
    }
    
    async getNicknameFromSite(req, res) { 
        this.SSEUtil.init(req, res);
        this.SSEUtil.SSEInitHeader();

        while(!(this.stopFlag)) {
            const { idMap, status } = await this.identityService.getNicknameFromSite();

            if(status.restPage <= 0 || status.position < 0) this.stopFlag = true;
            
            const data = Array.from(idMap).sort();
            
            this.SSEUtil.SSESendEvent('fixed-nick', data);
            this.SSEUtil.SSESendEvent('status', status);
        }
        this.SSEUtil.SSESendEvent('complete', '');
        this.SSEUtil.SSEendEvent();

        console.log('식별코드 삽입 작업 완료.');
    }

    stopSearch() {
        this.stopFlag = true;
        console.log("작업 중지 요청됨. 대기중...");
    }
}