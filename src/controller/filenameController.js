const cheerio = require('cheerio');
const fetchUtil = require('../utils/fetchUtil');
const SSEController = require('../controller/SSEController');

module.exports = class filenameController {

    constructor() {
        this.stopFlag = true;
        this.fetchUtil = new fetchUtil();
        this.SSEController  = new SSEController();
        this.postNoSet = new Set();
        this.lastChecked = null;
        this.galleryList = [
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
        this.excludeList = [
            'took1499', // 접
            'weaken8006', // 노글릿
            'type3700', // 노글릿
            'hello0511', // 노글릿
            'eltl0213', // 직갤
            'wrote7832', // 직갤
            'among0425', // 직갤
            'regret7265', // 직갤
            'welcome6013', // 직갤
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
            'decided9769', // 엳음갤, 한엳갤
            'vh4zz8yvws18', // 파딱
            'vjvadfkg9x2e', // 파딱(이었던)
            'illit12345', // 파딱(이었던)
            'ifqff7r5g77n', // 모갤주딱
            'first3159', // 모갤파딱
        ];
    }

    async init(data) {
        const { galleryType, GID: galleryId, limit, startPage } = data;
        
        this.stopFlag = false;
        this.galleryType = galleryType;
        this.galleryId = galleryId;
        this.restPage = Number(limit);
        this.startPage = startPage;
        this.curPage = 1;
    }

    async getFilenameFromSite(res) {
        const url = `
        https://gall.dcinside.com/${this.galleryType}board/lists/?id=${this.galleryId}&page=${this.startPage}&list_num=100&search_head=0`;
        const response = await this.fetchUtil.fetcher(url);
        
        const html = await response.text();
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

        for(let no of this.postNoSet) {
            const url = `
            https://gall.dcinside.com/${this.galleryType}board/view/?id=${this.galleryId}&no=${no}`;
            const response = await this.fetchUtil.fetcher(url);
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const filename = $('.appending_file_box .appending_file').find('li').find('a').text().trim();
            
            if(!filename) {
                this.postNoSet.add(no); 
                console.log(`${no}는 다시 검색`);
                await new Promise(resolve => setTimeout(resolve, 100)); 
            } 
            else {
                if(this.galleryList.some((e) => filename.includes(e))) {
                    console.log(filename);
                    console.log(no);
                }
            }
            this.CheckedPostNo(res, {
                no: no,
            });

            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 20) + 10)); // 디도스 방지 딜레이
        }

        if(this.restPage <= 1) this.stopFlag = true;
        this.postNoSet = new Set();

        return {
            stopFlag: this.stopFlag,
            status: {
                restPage: --this.restPage, 
                curPage: ++this.startPage,
            }
        }
    }

    CheckedPostNo(res, data) {
        this.SSEController.SSESendEvent(res, 'no', data);
    }

    stopSearch() {
        this.stopFlag = true;
        console.log("작업 중지 요청됨. 대기중...");
    }
}