const fetchUtil = require('../utils/fetchUtil');
const collectDAO = require('../repositories/collectDAO');
const { URL_PATTERNS } = require('../config/const');

module.exports = class checkService {
    headers_des = {
        'Accept': 'text/html',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Cookie': 'used_darkmode=1; darkmode=1; alarm_popup=1; ck_img_view_cnt=4;',
        'Host': 'gall.dcinside.com',
        'Pragma': 'no-cache',
        'Referer': 'https://www.dcinside.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'sec-ch-ua': '"Chromium";v="134", " Not A;Brand";v="24", "Google Chrome";v="134"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': 'Windows',
    };
    collectDAO = new collectDAO();

    constructor() {
        this.fetchUtil = new fetchUtil(true);
    }

    async chkPostExists() { // des
        const posts = await this.collectDAO.getAllPosts();

        while(posts.length > 0) {
            let batchSize = 10; 
            const batch = posts.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (post) => {
                    const { postNum, galleryCODE } = post;
                    const url = URL_PATTERNS.POST_DES('mgallery/', galleryCODE, postNum);
                    
                    try {
                        const response = await this.fetchUtil.axiosFetcher(url, 'GET', this.headers_des);
                        return { no: postNum, gid: galleryCODE, response: response };
                    } catch (error) {
                        return { no: postNum, gid: galleryCODE, reason: error };
                    }
                })
            );

            results.forEach(result => {
                const { status, value, reason } = result;
                
                if(status === "fulfilled"){
                    const { no, gid, response } = value;
                    
                    if(response && response.status && response.status === 404) {
                        this.collectDAO.deletePostInDB(no, gid);
                        console.log(`${no}, ${gid} 삭제 완료`);
                    }
                } else {
                    console.log(reason);
                }
            });
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500) + 700);
    }

    async chkUIDisValid() {
        const UIDs = await this.collectDAO.getValidUIDs();

        while(UIDs.length > 0) {
            let batchSize = Math.floor(Math.random() * 5) + 20; 
            const batch = UIDs.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (uid) => {
                    const url = URL_PATTERNS.USER_GALLOG_MAIN(uid);
                    
                    try {
                        const response = await this.fetchUtil.axiosFetcher(url, 'GET', this.headers_des);
                        return { uid, response: response };
                    } catch (error) {
                        return { uid, reason: error };
                    }
                })
            );

            results.forEach(result => {
                const { status, value, reason } = result;
                // 특정 경우(500?)에서는 response가 undefined로 표시되는 경우 존재. 이러한 경우가 드물게 존재하는데.
                if(status === "fulfilled"){
                    const { uid, response } = value;
                    
                    if(response && response.status && response.status === 404) {
                        this.collectDAO.updateVaild(uid);
                        //console.log(`${uid}는 존재하지 않음.`);
                    }
                } else {
                    //currentQueue.push(uid);
                    console.log(reason);
                }
            });

            if (UIDs.length > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500) + 500);
            }
        }
    }

    async _checkUIDisValidX() { // mob
        const currentQueue = Array.from(this.identityMap.keys());

        while(currentQueue.length > 0) {
            let batchSize = Math.floor(Math.random() * 5) + 20; 
            const batch = currentQueue.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (uid) => {
                    const url = URL_PATTERNS.USER_GALLOG_MAIN(uid);
                    
                    try {
                        const response = await this.fetchUtil.axiosFetcher(url, 'GET', this.headers_des);
                        return { uid, response: response };
                    } catch (error) {
                        return { uid, reason: error };
                    }
                })
            );

            results.forEach(result => {
                const { status, value, reason } = result;
                // 특정 경우(500?)에서는 response가 undefined로 표시되는 경우 존재. 이러한 경우가 드물게 존재하는데.
                if(status === "fulfilled"){
                    const { uid, response } = value;
                    
                    if(response && response.status && response.status === 404) {
                        this.identityMap.delete(uid);
                        //console.log(`${uid}는 존재하지 않음.`);
                    }
                } else {
                    //currentQueue.push(uid);
                    console.log(reason, uid);
                }
            });

            if (currentQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500) + 500);
            }
        }
    }
}