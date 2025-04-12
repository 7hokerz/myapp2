const cheerio = require('cheerio');
const fetchUtil = require('../utils/fetchUtil');
const { SELECTORS, URL_PATTERNS } = require('../config/const');

module.exports = class filenameService {
    headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
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
    galleryList = [
        'fancam', 
        'grsgills', 
        'girl',
        'group',
        'idol',
        'gaon',
        'kpop',
        'ball',
        'raengbo',
        'entertain',
        'xylitol',
        'week',
    ];
    excludeList = [
        'took1499', // 접
        'weaken8006', // 노글릿
        'type3700', // 노글릿
        'hello0511', // 노글릿
        'eltl0213', // 직갤
        'wrote7832', // 직갤
        'among0425', // 직갤
        'regret7265', // 직갤
        'welcome6013', // 직갤
        'symptom0855', // 직갤
        'guardian2789', // 탈, 직갤
        'open5441', // 탈, 직갤
        'dlstod0302', // 탈
        'crow8529', // 탈
        'chick9760', // 탈
        'convey2699', // 차단
        'went5920', // 글릿
        'resemble6229', // 글릿
        'read8491', // 글릿
        'groom6284', // 접, 걸갤
        'detect8729', // 걸갤
        'song4295', // 걸갤
        'green6157', // 걸갤
        'parasite0850', // 걸갤
        'thread9135', // 걸갤
        'together6862', // 걸갤
        'step3227', // 걸갤
        'solar5548', // 걸갤, 야갤
        'aada99', // 야갤
        '1212asasqwqw', // 야갤
        'ssddo', // 기타 걸그룹갤
        'definite2251', // 엳음갤
        'decided9769', // 엳음갤, 한엳갤
        'canada9224', // 한엳갤
        'vh4zz8yvws18', // 파딱
        'vjvadfkg9x2e', // 파딱(이었던)
        'illit12345', // 파딱(이었던)
        'ifqff7r5g77n', // 모갤주딱
        'first3159', // 모갤파딱
    ];
    postNoSet = new Set();
    
    constructor({
        SSEUtil, galleryType, galleryId, limit, startPage, isProxy
    }) {
        this.fetchUtil = new fetchUtil(isProxy); 
        this.SSEUtil = SSEUtil;
        this.galleryType = galleryType;
        this.galleryId = galleryId;
        this.restPage = Number(limit);
        this.startPage = startPage;
    }

    async getFilenameFromSite() {
        await this._getPostsFromSite();
        await this._getFilenameFromPosts();
        this.postNoSet = new Set();
        this.restPage--;
        this.startPage++;
        
        return {
            status: {
                restPage: this.restPage,
                curPage: this.startPage,
            }
        }
    }

    async _getPostsFromSite() { //des
        const response = await this.fetchUtil.axiosFetcher(
            URL_PATTERNS.POST_LIST_DES(this.galleryType, this.galleryId, this.startPage), 'GET', this.headers);
        const html = response.data;
        const $ = cheerio.load(html);
        
        $(SELECTORS.POST_ITEM).each((index, element) => {
            const type = $(element).attr(SELECTORS.POST_TYPE_ATTR);
            const uid = $(element).find(SELECTORS.POST_WRITER).attr(SELECTORS.POST_UID_ATTR);
            if(
                (type === SELECTORS.POST_TYPE_IMG || type === SELECTORS.POST_TYPE_REC_IMG) && 
                uid && 
                !( this.excludeList.some((e) => uid.includes(e)) )
            ) {
                const no = $(element).attr(SELECTORS.POST_NO_ATTR);
                this.postNoSet.add(no);
            }
        });
    }

    async _getFilenameFromPosts() { //des
        const postNoQueue = Array.from(this.postNoSet);
        let currentQueue = [...postNoQueue];
        
        /*  map 함수 = 순차(반복문)
            하지만 안에는 익명 async 함수이므로 함수 내부의 로직은 await 키워드에 따라 순차 진행하지만
            Promise 객체 즉시 반환 후 다음 작업 진행
            map 함수는 이러한 Promise 객체를 모아둔 배열을 생성하고 
            allSettled 함수는 각 Promise 객체의 결과를 기다렸다가 results 배열에 최종 저장.
            따라서 아래 함수 자체는 동시에 실행되지만 랜덤 시간 이후에 요청이 발생하므로
            각 요청마다 요청 시작 시간이 다름.
        */
        while(currentQueue.length > 0) {
            let batchSize = Math.floor(Math.random() * 5) + 25; 
            const batch = currentQueue.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (no) => {
                    try {
                        const response = await this.fetchUtil.axiosFetcher(
                            URL_PATTERNS.POST_DES(this.galleryType, this.galleryId, no), 'GET', this.headers);
                        return { no, response: response };
                    } catch (error) {
                        return { no, reason: error };
                    }
                })
            );

            results.forEach(result => {
                this._processPostResult(result, currentQueue); // 결과 처리 로직 분리
            });

            if (currentQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 1000) + 1000);
            }
        }
    }

    _processPostResult(result, currentQueue) {
        const { status, value, reason } = result;
                
        if(status === "fulfilled") {
            const { no, response } = value;
            const html = response.data;
            const $ = cheerio.load(html);
            const filename = $(SELECTORS.FILENAME_LINK).text().trim();
            //console.log(filename, no);
            if(!filename) {
                currentQueue.push(no);
            } else {
                if (this.galleryList.some((e) => filename.includes(e))) {
                    this.SSEUtil.SSESendEvent('post', { filename: filename, no: no });
                    console.log(`[Found] ${filename} (Post ${no})`);
                }
            }
            this.SSEUtil.SSESendEvent('no', { no: no, });
        } else {
            currentQueue.push(no);
            console.log(reason, no);
        }
    }  

    async getPostsFromSiteMob() { // mob (mob 헤더 추가 필요)(사용 X)
        const url = `
        https://m.dcinside.com/board/${this.galleryId}?page=${this.startPage}`;

        const response = await this.fetchUtil.axiosFetcher(url, 'GET', this.headers_mob, 1);
        const html = response.data;
        const $ = cheerio.load(html);

        $(".gall-detail-lst li .gall-detail-lnktb").each((index, element) => {
            const type = $(element).find('.lt .subject-add');
            
            const len = type.length;
            if($(type).find('.sp-lst.sp-lst-img').length || $(type).find('.sp-lst.sp-lst-recoimg').length) {
                //번호 찾기에 대해 필요
            }
        });

    }
}

/*
async getFilenameFromPosts() { //des
        const postNoQueue = Array.from(this.postNoSet);

        for ( // 랜덤 병렬 요청
            let i = 0, batch = Math.floor(Math.random() * 5) + 20; 
            i < postNoQueue.length; 
            i += batch, batch = Math.floor(Math.random() * 5) + 20
        ) { 
            const slicedArr = postNoQueue.slice(i, i + batch); 
            const results = await Promise.allSettled(
                slicedArr.map((no) => {
                    const url = `https://gall.dcinside.com/${this.galleryType}board/view/?id=${this.galleryId}&no=${no}`;
                    return this.fetchUtil.axiosFetcher(url, 'GET', this.headers);
                })
            );

            results.forEach((response, index) => {
                const no = postNoQueue[i + index];

                if (response.status === "fulfilled") {
                    const html = response.value.data;
                    const $ = cheerio.load(html);
                    const filename = $('.appending_file_box .appending_file').find('li').find('a').text().trim();
                    //console.log(filename);
                    if(!filename) {
                        postNoQueue.push(no);
                    } else {
                        if(this.galleryList.some((e) => filename.includes(e))) {
                            this.SSEUtil.SSESendEvent('post', {
                                filename: filename,
                                no: no,
                            });
                            console.log(filename, no);
                        }
                    }
                    this.SSEUtil.SSESendEvent('no', { no: no, });
                } else {
                    postNoQueue.push(no);
                    console.log(response.reason, no);
                }
            });
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 150) + 100)); // 디도스 방지 딜레이 
        }
    }
*/




