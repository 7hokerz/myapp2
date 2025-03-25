const cheerio = require('cheerio');
const fetchUtil = require('../utils/fetchUtil');

module.exports = class filenameService {
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
        'vh4zz8yvws18', // 파딱
        'vjvadfkg9x2e', // 파딱(이었던)
        'illit12345', // 파딱(이었던)
        'ifqff7r5g77n', // 모갤주딱
        'first3159', // 모갤파딱
    ];
    
    constructor(SSEUtil, galleryType, galleryId, limit, startPage) {
        this.fetchUtil = new fetchUtil();
        this.postNoSet = new Set();
        this.SSEUtil = SSEUtil;
        
        this.galleryType = galleryType;
        this.galleryId = galleryId;
        this.restPage = Number(limit);
        this.startPage = startPage;
    }

    async getFilenameFromSite() {
        await this.getPostsFromSite();
        await this.getFilenameFromPosts();
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

    async getPostsFromSite() {
        const url = `
        https://gall.dcinside.com/${this.galleryType}board/lists/?id=${this.galleryId}&page=${this.startPage}&list_num=100&search_head=0`;
        const response = await this.fetchUtil.axiosFetcher(url);
        const html = response.data;
        const $ = cheerio.load(html);
        
        $('.gall_list .ub-content.us-post').each((index, element) => {
            const type = $(element).attr('data-type');
            const uid = $(element).find('.gall_writer.ub-writer').attr('data-uid');
            if(
                (type === 'icon_pic' || type === 'icon_recomimg') && 
                uid && 
                !( this.excludeList.some((e) => uid.includes(e)) )
            ) {
                const no = $(element).attr('data-no');
                this.postNoSet.add(no);
            }
        });
    }

    async getFilenameFromPosts() {
        const postNoArr = Array.from(this.postNoSet);

        for ( // 랜덤 병렬 요청
            let i = 0, batch = Math.floor(Math.random() * 5) + 3; 
            i < postNoArr.length; 
            i += batch, batch = Math.floor(Math.random() * 5) + 3
        ) { 
            const slicedArr = postNoArr.slice(i, i + batch); 
            const results = await Promise.allSettled(
                slicedArr.map((no) => {
                    const url = `https://gall.dcinside.com/${this.galleryType}board/view/?id=${this.galleryId}&no=${no}`;
                    return this.fetchUtil.axiosFetcher(url, 1000);
                })
            );

            results.forEach((response, index) => {
                const no = postNoArr[i + index];

                if (response.status === "fulfilled") {
                    const html = response.value.data;
                    const $ = cheerio.load(html);
                    const filename = $('.appending_file_box .appending_file').find('li').find('a').text().trim();
                    
                    if(!filename) {
                        postNoArr.push(no);
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
                    postNoArr.push(no);
                    console.log(response.reason, no);
                }
            });
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 150) + 100)); // 디도스 방지 딜레이 
        }
    }
}






