
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

            if(status.restPage < 1 || status.position < 1) this.stopFlag = true;
            
            if(newIdentityCodes && newIdentityCodes.length > 0) this.SSEUtil.SSESendEvent('fixed-nick', newIdentityCodes);
            this.SSEUtil.SSESendEvent('status', status);
        }
        console.log('식별코드 수집 완료.');

        if(true) {
            await this._insertUIDs();
        } else {
            await this._compareUIDs();
        }

        this.SSEUtil.SSESendEvent('complete', '');
        this.SSEUtil.SSEendEvent();
    }

    async _insertUIDs() {
        await this.identityService.insertUIDs();

        console.log('식별코드 삽입 작업 완료.');
    }

    async _compareUIDs() {
        const results = await this.identityService.compareUIDs();

        this.SSEUtil.SSESendEvent('compare', results);

        console.log('식별코드 비교 작업 완료.');
    }

    async chkPostisExist() {
        await this.identityService.chkPostisExist();
    }

    stopSearch() {
        this.stopFlag = true;
        console.log("작업 중지 요청됨. 대기중...");
    }
}