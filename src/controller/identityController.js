const SSEUtil = require('../utils/SSEUtil');
const IdentityService = require('../services/identityService');
const CheckService = require('../services/checkService');
const jobManager = require('../utils/jobUtil');

module.exports = class identityController {
    constructor() {}
    
    async getNicknameFromSite(req, res) { 
        const { jobId } = req.query;
        const jobData = jobManager.getJob(jobId); 

        const sseUtil = new SSEUtil(req, res);
        sseUtil.SSEInitHeader();

        let identityService = null;
        try {
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
            } = jobData.parameters;

            let content = null;
            switch (type) {
                case 'search_name':
                    content = nickname;
                    break;
                case 'search_subject_memo':
                    content = keyword;
                    break;
            }

            identityService = new IdentityService({
                SSEUtil: sseUtil, 
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

            jobManager.updateJobStatus(jobId, identityService, "executing");

            await identityService.process();

            sseUtil.SSESendEvent('complete', '');
        } catch (error) {
            console.error('Error during nickname collection:', error);
        } finally {
            sseUtil.SSEendEvent();
            jobManager.deleteJob(jobId); // 작업 완료 후 job 삭제
        }
    }

    async chkPostExists(req, res) {
        const { jobId } = req.query;
        const jobData = jobManager.getJob(jobId); 

        const sseUtil = new SSEUtil(req, res);
        sseUtil.SSEInitHeader();

        let checkService = null;
        try {
            const { 
                galleryType, 
                GID: galleryId, 
                isProxy,
            } = jobData.parameters;

            checkService = new CheckService({
                SSEUtil: this.SSEUtil, 
                galleryType: galleryType,
                galleryId: galleryId,
                isProxy: isProxy,
            });

            jobManager.updateJobStatus(jobId, checkService, "executing");

            await checkService.chkPostExists();

            //sseUtil.SSESendEvent('complete', '');
        } catch (error) {
            console.error('Error checking post existence:', error);
        } finally {
            //sseUtil.SSEendEvent();
            jobManager.deleteJob(jobId); // 작업 완료 후 job 삭제
        }
    }

    async chkUIDisValid(req, res) {
        const { jobId } = req.query;
        const jobData = jobManager.getJob(jobId);

        const sseUtil = new SSEUtil(req, res);
        sseUtil.SSEInitHeader();

        let checkService = null;
        try {
            const { 
                galleryType, 
                GID: galleryId, 
                isProxy,
            } = jobData.parameters;

            checkService = new CheckService({
                SSEUtil: this.SSEUtil, 
                galleryType: galleryType,
                galleryId: galleryId,
                isProxy: isProxy,
            });

            jobManager.updateJobStatus(jobId, checkService, "executing");

            await checkService.chkUIDisValid();

            //sseUtil.SSESendEvent('complete', '');
        } catch (error) {
            console.error('Error checking UID existence:', error);
        } finally {
            //sseUtil.SSEendEvent();
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