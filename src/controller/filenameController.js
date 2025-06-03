
const SSEUtil = require('../utils/SSEUtil');
const jobManager = require('../utils/jobUtil');

class FilenameController {
    constructor(FilenameService, FetchUtil) {
        this.FilenameService = FilenameService;
        this.FetchUtil = FetchUtil;
    }
    
    async getFilenameFromSite(req, res) {
        const { jobId } = req.query;
        const jobData = jobManager.getJob(jobId); 

        const sseUtil = new SSEUtil(req, res);
        sseUtil.SSEInitHeader();

        try {
            const { 
                galleryType, 
                GID: galleryId, 
                startPage,
                limit,
                isProxy, 
            } = jobData.parameters;

            const filenameService = new this.FilenameService(new this.FetchUtil(isProxy));
            filenameService.init({sseUtil, galleryType, galleryId, limit, startPage});

            jobManager.updateJobStatus(jobId, filenameService, "executing");

            await filenameService.getFilenameFromSite();

            sseUtil.SSESendEvent('complete', '');

            console.log('첨부파일 확인 작업 완료.');
        } catch (error) {
            console.error('Error during filename collection:', error);
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

module.exports = FilenameController;
/*

*/