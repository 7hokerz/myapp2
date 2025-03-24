
const SSEUtil = require('../utils/SSEUtil');
const filenameService = require('../services/filenameService');

module.exports = class filenameController {

    constructor() {
        this.stopFlag = true;
        this.SSEUtil = new SSEUtil();
    }

    async init(data) {
        const { galleryType, GID: galleryId, limit, startPage } = data;
        
        this.filenameService = new filenameService(this.SSEUtil, galleryType, galleryId, limit, startPage);
        this.stopFlag = false;
    }

    async getFilenameFromSite(req, res) {
        this.SSEUtil.init(req, res);
        this.SSEUtil.SSEInitHeader();

        while(!(this.stopFlag)) {
            const { restPage, startPage } = await this.filenameService.getFilenameFromSite();

            if(restPage <= 1) this.stopFlag = true;

            this.SSEUtil.SSESendEvent('status', {
                restPage, 
                curPage: startPage,
            });
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