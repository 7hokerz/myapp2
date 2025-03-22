const cheerio = require('cheerio');
const collectService = require('../services/collectService');
const fetchUtil = require('../utils/fetchUtil');

module.exports = class collectController {
    
    constructor() {
        this.stopFlag = true;
        this.fetchUtil = new fetchUtil();
        this.collectService = new collectService();
    }

    async init(data) {
        this.collectService.idMap = new Map();
        this.collectService.noSet = new Set();

        const { GID: galleryId, nickname, keyword, type, UID: id, pos, limit, galleryType } = data;
        
        this.stopFlag = false;
        this.curPage = 1;
        this.galleryId = galleryId;
        this.keyword = nickname || keyword || '';
        this.type = type;
        this.id = id;
        this.restPage = Number(limit);
        this.galleryType = galleryType;

        if(!Number(pos)) this.position = await this.getTotalPost();
        else this.position = Number(pos);
    }

    async getTotalPost() {   
        const url = `https://gall.dcinside.com/${this.galleryType}board/lists/?id=${this.galleryId}`;
        const response = await this.fetchUtil.fetcher(url);
        
        const html = await response.text();
        const cleanhtml = this.parseHtml(html);

        const result = await this.collectService.getTotalPost(cleanhtml);
        return result;
    }
    
    async getNicknameFromSite() { 
        const url = `
        https://gall.dcinside.com/${this.galleryType}board/lists/?id=${this.galleryId}&page=${this.curPage}&search_pos=${-this.position}&s_type=${this.type}&s_keyword=${this.keyword}`;
        
        const response = await this.fetchUtil.fetcher(url);

        const resurl = new URL(response.url);
        const urlPage = Number(resurl.searchParams.get('page'));

        const html = await response.text();
        const cleanhtml = this.parseHtml(html);
        
        const { idMap, statBit } = await this.collectService.getNicknameFromSite(cleanhtml, urlPage, this.curPage);
        
        this.updateStatus(statBit);

        return {
            idMap: idMap,
            stopFlag: this.stopFlag,
            status: {
                restPage: this.restPage, 
                curPage: this.curPage - 1,
                position: this.position
            }
        }
    }

    async insertToID() {
        await this.collectService.insertToID(this.galleryId);
    }

    stopSearch() {
        this.stopFlag = true;
        console.log("작업 중지 요청됨. 대기중...");
    }

    updateStatus(status) {
        this.restPage = (status & (1 << 2)) ? this.restPage - 1: this.restPage;

        this.position = (status & (1 << 1)) ? this.position - 10000: this.position;

        this.curPage = (status & (1 << 0)) ? 1 : this.curPage + 1;

        this.stopFlag = (this.restPage <= 0 || this.position < 0) ? true: this.stopFlag;
    }

    parseHtml(html) {
        const cleanhtml = html.replace(/<(img|link|script|style|iframe|noscript|svg|canvas|video|audio|head|header|footer|ins)[^>]*>[\s\S]*?<\/\1>/gi, '')
            //.replace(/<(?!td\b|\/td\b|tr\b|\/tr\b|table\b|\/table\b)([^>]+)>/gi, '') 
            .replace(/<!--[\s\S]*?-->/g, '') // 주석 제거;
            .replace(/\s{2,}/g, ' ') // 연속된 공백 제거
            .trim(); // 앞뒤 공백 제거
        
        return cleanhtml;
    }
    
}