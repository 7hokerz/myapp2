
const SSEUtil = require('../utils/SSEUtil');
const filenameService = require('../services/filenameService');

module.exports = class filenameController {
    stopFlag = true;
    SSEUtil = new SSEUtil();
    constructor() {
        
    }

    async init(req, res) {
        const { galleryType, GID: galleryId, limit, startPage, isProxy } = req.body;
        
        this.filenameService = new filenameService(
            {
                SSEUtil: this.SSEUtil, 
                galleryType: galleryType, 
                galleryId: galleryId, 
                limit: limit, 
                startPage: startPage, 
                isProxy: isProxy,
            }
        );
        this.stopFlag = false;
    }

    async getFilenameFromSite(req, res) {
        this.SSEUtil.init(req, res);
        this.SSEUtil.SSEInitHeader();
        
        while(!(this.stopFlag)) {
            const { status } = await this.filenameService.getFilenameFromSite();

            if(status.restPage < 1) this.stopFlag = true;

            this.SSEUtil.SSESendEvent('status', status);
        }
        this.SSEUtil.SSESendEvent('complete', '');
        this.SSEUtil.SSEendEvent();

        console.log('첨부파일 확인 작업 완료.');
    }

    stopSearch() {
        this.stopFlag = true;
        console.log("작업 중지 요청됨. 대기중...");
    }
}

/*

*/