
class CheckService {
    stopFlag = true;

    constructor(collectDAO, siteApiClient) {
        this.collectDAO = collectDAO;
        this.siteApiClient = siteApiClient;
    }

    init({ SSEUtil, galleryType, galleryId }) {
        this.SSEUtil = SSEUtil;
        this.galleryType = galleryType;
        this.galleryId = galleryId;
    }

    requestStop() {
        this.stopFlag = true;
    }

    /*
    async chkResetValue(url) { //이분 탐색으로 적정 간격 확인
        const response = await this.fetchUtil.axiosFetcher(url, 'GET', {...headers_mob_chrome_gallog}, 1);
        let limit = Number(response.headers['x-ratelimit-limit']);
        if(!limit) {
            return;
        }
        
        let start = 0, end = 10000, mid = 0;
        while(start < end) {
            let remaining = limit;
            mid = parseInt((start + end) / 2);
            try {
                const batch = new Array(3).fill(0);

                const results = await Promise.allSettled( // limit 개의 요청 전송
                    batch.map(async () => {
                        try {
                            const response = await this.fetchUtil.axiosFetcher(url, 'GET', {...headers_mob_chrome_gallog}, 1);
                            if(limit !== response.headers['x-ratelimit-limit']) limit = Number(response.headers['x-ratelimit-limit']);
                            return { response: response };
                        } catch (error) {
                            return { reason: error };
                        }
                    })
                );

                await new Promise(resolve => setTimeout(resolve, mid));
                let reset = 0;
                // 1개의 요청 전송
                const response = await this.fetchUtil.axiosFetcher(url, 'GET', {...headers_mob_chrome_gallog}, 1);
                if(limit !== response.headers['x-ratelimit-limit']) limit = Number(response.headers['x-ratelimit-limit']);
                if(response.headers['x-ratelimit-reset']) reset = (response.headers['x-ratelimit-reset'] - parseInt(Date.now() / 1000)) * 100;
                remaining = Number(response.headers['x-ratelimit-remaining']);

                if(remaining >= limit / 2) {
                    end = mid - 1;
                } else {
                    start = mid + 1;
                }
                console.log(limit, remaining, start, end, (start + end) / 2);

            } catch (error) {
                
            }
        }
        console.log(mid);
    }*/

    async chkPostExists() { // des
        this.stopFlag = false;
        const posts = await this.collectDAO.getAllPosts(this.galleryId);
        const incs = [];
        let inc = 1, limit = 0;

        while(posts.length > 0) {
            let batchSize = 5, remaining = Infinity;
            const batch = posts.splice(0, batchSize);

            let startTime = performance.now();
            const results = await Promise.allSettled(
                batch.map(async (post) => {
                    const { postNum } = post;
                    try {
                        const { status, headers } = await this.siteApiClient.getPostMoblie(this.galleryId, { postNum });

                        if(!limit) limit = headers['x-ratelimit-limit'];
                        remaining = Math.min(remaining, headers['x-ratelimit-remaining'] || 0);

                        return { no: postNum, status };
                    } catch (error) {
                        return { no: postNum, reason: error };
                    }
                })
            );
            let endTime = performance.now();
            let latency = parseInt(endTime - startTime);
            //let preRemaining = incs.length > 0 ? incs[incs.length - 1].remaining : limit; // 남은 횟수
            //inc = ((preRemaining - remaining) / latency).toFixed(3) * 1000; // 기울기

            let weight = 30;
            if(remaining < parseInt(limit / 3 * 2)) {
                weight *= (parseInt(limit / 3 * 2) - remaining);
            }
            if(remaining <= 5) weight *= 5;
            if(remaining === -1) weight *= 2;

            incs.push({remaining, latency}); // 남은 횟수, 기울기, 지연시간

            results.forEach(result => {
                const { status, value, reason } = result;
                
                if(status === "fulfilled"){
                    const { no, status } = value;
                    
                    if(status === 403) {
                        this.collectDAO.deletePostInDB(no, this.galleryId);
                        console.log(`${no}, ${this.galleryId} 삭제 완료`);
                    }
                } else {
                    console.log(reason);
                }
            });
            if(this.stopFlag) break;

            if(incs.length % 20 === 0) console.log(weight, incs.length, remaining);
            
            await new Promise(resolve => setTimeout(resolve, 990 + weight)); 

            //await new Promise(resolve => setTimeout(resolve, 750 + inc * weight));
            //기울기 * 가중치 제외. 기울기는 remaining 값이 매우 불규칙적이고 명확하지 않으므로 직접적인 간격 조정 지표로 쓰기 어려움.
            //테스트를 통해 두가지 방식을 비굑해보자
        }
        console.log("POST CHECK 작업 완료.");
    }

    async chkUIDisValid() { // mob
        this.stopFlag = false;
        //await this.chkResetValue(URL_PATTERNS.USER_GALLOG_MAIN_MOB("wamdy"));
        const UIDs = await this.collectDAO.getValidUIDs();
        const incs = [];
        let inc = 1, limit = 0;

        while(UIDs.length > 0) {
            let batchSize = 3, remaining = 0; 
            const batch = UIDs.splice(0, batchSize);

            let startTime = performance.now();
            const results = await Promise.allSettled(
                batch.map(async (uid) => {
                    const { identityCode } = uid;
                    try {
                        const { status, headers } = await this.siteApiClient.getUserGallogMobile(identityCode);

                        if(!limit) limit = headers['x-ratelimit-limit'];
                        remaining = Math.max(remaining, headers['x-ratelimit-remaining'] || 0);

                        return { identityCode, status };
                    } catch (error) {
                        return { identityCode, reason: error };
                    }
                })
            );
            let endTime = performance.now();
            let latency = parseInt(endTime - startTime);
            let preRemaining = incs.length > 0 ? incs[incs.length - 1].remaining : limit; // 남은 횟수
            inc = ((preRemaining - remaining) / latency).toFixed(3) * 1000; // 기울기

            let weight = (limit / 2)
            if(inc > 0 && remaining < (limit / 2)) {
                weight *= ((limit / 2) - remaining);
            }

            incs.push({remaining, inc, latency}); // 남은 횟수, 기울기, 지연시간
            
            results.forEach(result => {
                const { status, value, reason } = result; // 특정 경우(500?des)에서는 response가 undefined로 표시되는 경우 존재.
                if(status === "fulfilled"){
                    const { identityCode, status} = value;
                    
                    if(status === 403) { // mob: 403 === 삭제된 갤로그, des: 404 === 삭제된 갤로그
                        this.collectDAO.updateVaild(identityCode);
                        console.log(`${identityCode}는 존재하지 않음.`);
                    }
                } else {
                    //currentQueue.push(identityCode);
                    console.log(reason);
                }
                //this.SSEUtil.SSESendEvent('db-fixed-nick', value.identityCode || null)
            });
            if(this.stopFlag) break;

            if(incs.length % 20 === 0) console.log(remaining, inc, weight);

            await new Promise(resolve => setTimeout(resolve, 750 + inc * weight));
        }
        console.log("UID CHECK 작업 완료.");
    }
}

module.exports = CheckService;