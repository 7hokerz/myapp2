
const SSEUtil = require('../utils/SSEUtil');
const jobManager = require('../utils/jobUtil');

class IdentityController {
    constructor(IdentityService, CheckService, collectDAO, FetchUtil, dataParser) {
        this.IdentityService = IdentityService;
        this.CheckService = CheckService;
        this.collectDAO = collectDAO;
        this.FetchUtil = FetchUtil;
        this.dataParser = dataParser;
        console.log('UserController: Instance created (Singleton)');
    }

    async getNicknameFromSite(req, res) { 
        const { jobId } = req.query;
        const jobData = jobManager.getJob(jobId); 

        const sseUtil = new SSEUtil(req, res);
        sseUtil.SSEInitHeader();

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

            const identityService = new this.IdentityService(this.collectDAO, new this.FetchUtil(isProxy));
            identityService.init({sseUtil,galleryType,galleryId,type,id,pos,content,limit,unitType,actionType});

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

        try {
            const { 
                galleryType, 
                GID: galleryId, 
                isProxy,
            } = jobData.parameters;

            const checkService = new this.CheckService(this.collectDAO, new this.FetchUtil(isProxy), this.dataParser);
            checkService.init({sseUtil,galleryType,galleryId})

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

        try {
            const { 
                galleryType, 
                GID: galleryId, 
                isProxy,
            } = jobData.parameters;

            const checkService = new this.CheckService(this.collectDAO, new this.FetchUtil(isProxy));
            checkService.init({sseUtil,galleryType,galleryId})

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

module.exports = IdentityController;