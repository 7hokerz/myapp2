const fetchUtil = require('../utils/fetchUtil');
const collectDAO = require('../repositories/collectDAO');
const { URL_PATTERNS } = require('../config/const');
const { headers_des_chrome, headers_mob_chrome_gallog } = require('../config/apiHeader');

module.exports = class checkService {
    stopFlag = true;
    collectDAO = new collectDAO();

    constructor({ SSEUtil, galleryType, galleryId, isProxy }) {
        this.fetchUtil = new fetchUtil(isProxy);
        this.SSEUtil = SSEUtil;
        this.galleryType = galleryType;
        this.galleryId = galleryId;
    }

    requestStop() {
        this.stopFlag = true;
    }

    async chkPostExists() { // des
        this.stopFlag = false;
        const posts = await this.collectDAO.getAllPosts(this.galleryId);

        while(posts.length > 0) {
            let batchSize = Math.floor(Math.random() * 5) + 10; 
            const batch = posts.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (post) => {
                    const { postNum } = post;
                    const url = URL_PATTERNS.POST_DES(this.galleryType, this.galleryId, postNum);
                    
                    try {
                        const response = await this.fetchUtil.axiosFetcher(url, 'GET', {...headers_des_chrome});
                        return { no: postNum, response: response };
                    } catch (error) {
                        return { no: postNum, reason: error };
                    }
                })
            );

            results.forEach(result => {
                const { status, value, reason } = result;
                
                if(status === "fulfilled"){
                    const { no, response } = value;
                    
                    if(response && response.status && response.status === 404) {
                        this.collectDAO.deletePostInDB(no, this.galleryId);
                        console.log(`${no}, ${this.galleryId} 삭제 완료`);
                    }
                } else {
                    console.log(reason);
                }
            });
            if(this.stopFlag) break;

            await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
        }
        console.log("POST CHECK 작업 완료.");
    }

    async chkUIDisValid() { // mob
        this.stopFlag = false;
        const UIDs = await this.collectDAO.getValidUIDs();

        while(UIDs.length > 0) {
            let batchSize = 3; 
            const batch = UIDs.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (uid) => {
                    const { identityCode } = uid;
                    const url = URL_PATTERNS.USER_GALLOG_MAIN_MOB(identityCode);
                    
                    try {
                        const response = await this.fetchUtil.axiosFetcher(url, 'GET', {...headers_mob_chrome_gallog}, 1, null, 20000, 2000);
                        return { identityCode, response: response };
                    } catch (error) {
                        return { identityCode, reason: error };
                    }
                })
            );

            results.forEach(result => {
                const { status, value, reason } = result;
                // 특정 경우(500?des)에서는 response가 undefined로 표시되는 경우 존재. 이러한 경우가 드물게 존재하는데.
                if(status === "fulfilled"){
                    const { identityCode, response } = value;
                    
                    if(response.status === 403) { // mob 403 === 삭제된 갤로그
                        this.collectDAO.updateVaild(identityCode);
                        console.log(`${identityCode}는 존재하지 않음.`);
                    }
                } else {
                    //currentQueue.push(identityCode);
                    console.log(reason);
                }
            });
            if(this.stopFlag) break;

            await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
        }
        console.log("UID CHECK 작업 완료.");
    }
}