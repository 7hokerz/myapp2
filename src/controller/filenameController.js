
const SSEUtil = require('../utils/SSEUtil');
const FilenameService = require('../services/filenameService');
const jobManager = require('../utils/jobUtil');

module.exports = class filenameController {
    constructor() {
        
    }

    async getFilenameFromSite(req, res) {
        const { jobId } = req.query;
        const jobData = jobManager.getJob(jobId); 

        const sseUtil = new SSEUtil(req, res);
        sseUtil.SSEInitHeader();

        let filenameService = null;
        try {
            const { 
                galleryType, 
                GID: galleryId, 
                startPage,
                limit,
                isProxy, 
            } = jobData.parameters;

            filenameService = new FilenameService({
                SSEUtil: sseUtil, 
                galleryType: galleryType, 
                galleryId: galleryId, 
                limit: limit, 
                startPage: startPage, 
                isProxy: isProxy,
            });

            jobManager.updateJobStatus(jobId, filenameService, "executing");

            await filenameService.getFilenameFromSite();

            sseUtil.SSESendEvent('complete', '');

            console.log('첨부파일 확인 작업 완료.');

        } catch (error) {
            console.error('Error during nickname collection:', error);
        } finally {
            sseUtil.SSEendEvent();
            jobManager.deleteJob(jobId); // 작업 완료 후 job 삭제
        }
    }

    async stopSearch(req, res) {
        const { jobId } = req.query;
        const { instance } = jobManager.getJob(jobId); 
        if (instance) {
            instance.requestStop();
            console.log("작업 중지 요청됨. 대기중...");
        }
    }
}

/*

*/