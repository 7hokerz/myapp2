const cheerio = require('cheerio');
const fetchUtil = require('../utils/fetchUtil');
const collectDAO = require('../repositories/collectDAO');

module.exports = class collectService {

    constructor(SSEUtil, galleryType, galleryId, limit, pos, content, type, id, isProxy) {
        this.fetchUtil = new fetchUtil(isProxy);
        this.collectDAO = new collectDAO();
        this.idMap = new Map();
        this.noSet = new Set();
        this.SSEUtil = SSEUtil;
        this.curPage = 1;
        this.statBit = 0;

        this.galleryType = galleryType;
        this.galleryId = galleryId;
        this.restPage = Number(limit);
        this.position = Number(pos);
        this.content = content;
        this.type = type;
        this.id = id;
    }

    async getNicknameFromSite() {
        if(this.position < 1) this.position = await this.getTotalPostCount();
        await this.getNicknameFromPostLists();
        this.updateStatus();
        
        return {
            idMap: this.idMap,
            status: {
                restPage: this.restPage, 
                curPage: this.curPage - 1,
                position: this.position
            }
        }
    }

    async getTotalPostCount() {
        const url = `https://gall.dcinside.com/${this.galleryType}board/lists/?id=${this.galleryId}`;
        const response = await this.fetchUtil.axiosFetcher(url);
        const html = response.data;
        const $ = cheerio.load(html);

        let result = null;
        $('.gall_list .ub-content.us-post').each((index, element) => {
            if($(element).attr('data-type') !== 'icon_notice') {
                result = Number($(element).attr('data-no'));
                return false;
            }
        });
        return result;
    }
    
    async getNicknameFromPostLists() {
        const url = `
        https://gall.dcinside.com/${this.galleryType}board/lists/?id=${this.galleryId}&page=${this.curPage}&search_pos=${-this.position}&s_type=${this.type}&s_keyword=${this.content}`;
        const response = await this.fetchUtil.axiosFetcher(url);
        
        const resurl = new URL(response.request.res.responseUrl);
        const urlPage = Number(resurl.searchParams.get('page'));
        
        const html = response.data;
        const $ = cheerio.load(html);

        const hasPosts = urlPage > 0 && $('.gall_list .ub-content.us-post').length; // 페이지에 게시글이 존재하는가?
        
        const isValidPage = hasPosts && this.curPage === urlPage; // 이전에 조회한 적 없거나 유효한 페이지인가?
        
        if (!isValidPage) {
            this.statBit |= hasPosts ? 0 : (1 << 2); // restPage
            this.statBit |= (1 << 1); // position
            this.statBit |= (1 << 0); // curPage
        } else {
            $('.gall_list .ub-content.us-post').each((index, element) => {
                const uid = $(element).find('.gall_writer').attr('data-uid');
                
                if(uid) {
                    const nick = $(element).find('.gall_writer').attr('data-nick');
                    const no = $(element).attr('data-no');
                    
                    this.idMap.set(uid, nick);
                    this.noSet.add({uid, no});
                }
            });
            this.statBit |= (1 << 2); // restPage
        }
    }

    async insertToID() {
        try {
            for(let [k,v] of this.idMap) { // id 추가
                await this.collectDAO.insertToID(k, v, this.galleryId);
            }
            for(let v of this.noSet) { // 게시물 번호 추가
                await this.collectDAO.insertToPost(v.uid, v.no, this.galleryId);
            }
        } catch (error) {
            console.log(error);
        }
    }

    async getUIDByGalleryCode() {
        const data = await this.collectDAO.getUIDByGalleryCode(this.galleryId);
        return data;
    }

    async getGalleryCodeByUID() {
        const data = await this.collectDAO.getGalleryCodeByUID(this.galleryId);
        return data;
    }

    async deleteGarbage() {
        const data = await this.collectDAO.getUIDByGalleryCode(this.galleryId);

        for(let e of data) {
            if(this.stopFlag) break;
            try {
                const url = `https://gallog.dcinside.com/${e.identityCode}`;
                const response = this.fetchUtil.axiosFetcher(url);

                console.log(e.identityCode, response.status);

                if (!response.ok && response.status === 404) {
                    await this.collectDAO.deleteGarbage(e.identityCode);
                    console.log(`${e.identityCode} 삭제 완료.`);                
                }
                //await new Promise(resolve => setTimeout(resolve, 50));    
            } catch (error) {
                console.log(error);
            }
        }
    }

    updateStatus() {
        this.restPage = (this.statBit & (1 << 2)) ? this.restPage - 1: this.restPage;

        this.position = (this.statBit & (1 << 1)) ? this.position - 10000: this.position;

        this.curPage = (this.statBit & (1 << 0)) ? 1 : this.curPage + 1;

        this.statBit = 0;
    }
}


