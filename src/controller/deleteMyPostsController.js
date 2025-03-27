const SSEUtil = require('../utils/SSEUtil');
const deleteMyPostsService = require('../services/deleteMyPostsService');

module.exports = class deleteMyPostsController {
    constructor() {
        this.stopFlag = true;
        this.SSEUtil = new SSEUtil();
    }

    async init(req, res) {
        const { UID, type, cno, startPage, limit, PHPSESSID } = req.body;

        this.deleteMyPostsService = new deleteMyPostsService(this.SSEUtil, UID, type, cno, startPage, limit, PHPSESSID);
        this.stopFlag = false;
    }

    async deletePostsOrComments(req, res) {
        this.SSEUtil.init(req, res);
        this.SSEUtil.SSEInitHeader();

        while(!(this.stopFlag)) {
            const { status } = await this.deleteMyPostsService.deletePostsOrComments();

            if(status.restPage < 1) this.stopFlag = true;

            this.SSEUtil.SSESendEvent('status', status);
        }

        this.SSEUtil.SSESendEvent('complete', '');
        this.SSEUtil.SSEendEvent();
    }

    stopSearch() {
        this.stopFlag = true;
        console.log("작업 중지 요청됨. 대기중...");
    }
}