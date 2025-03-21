const cheerio = require('cheerio');
const collectDAO = require('../repositories/collectDAO');

module.exports = class collectService {

    constructor() {
        this.collectDAO = new collectDAO();
        this.idMap = new Map();
        this.noSet = new Set();
    }

    async getTotalPost(html) {
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
    
    async getNicknameFromSite(html, urlPage, curPage) {
        const $ = cheerio.load(html);

        const hasPosts = urlPage > 0 && $('.gall_list .ub-content.us-post').length; // 페이지에 게시글이 존재하는가?
        
        const isValidPage = hasPosts && curPage === urlPage; // 이전에 조회한 적 없거나 유효한 페이지인가?
        
        let statBit = 0;
        if (!isValidPage) {
            statBit |= hasPosts ? 0 : (1 << 2); // restPage
            statBit |= (1 << 1); // position
            statBit |= (1 << 0); // curPage
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
            statBit |= (1 << 2); // restPage
        }
        
        return {
            idMap: this.idMap,
            statBit: statBit,
        };
    }

    async insertToID(galleryId) {
        try {
            for(let [k,v] of this.idMap) { // id 추가
                await this.collectDAO.insertToID(k, v, galleryId);
            }
            for(let v of this.noSet) { // 게시물 번호 추가
                await this.collectDAO.insertToPost(v.uid, v.no, galleryId);
            }
        } catch (error) {
            console.log(error);
        }
    }

    async getUIDByGalleryCode(galleryId) {
        const data = await this.collectDAO.getUIDByGalleryCode(galleryId);
        return data;
    }

    async getGalleryCodeByUID(galleryCode) {
        const data = await this.collectDAO.getGalleryCodeByUID(galleryCode);
        return data;
    }

    async deleteGarbage(galleryCode) {
        const data = await this.collectDAO.getUIDByGalleryCode(galleryCode);
        this.stopFlag = false;

        for(let e of data) {
            if(this.stopFlag) break;
            try {
                const url = `https://gallog.dcinside.com/${e.identityCode}`;

                const response = await fetch(url, {
                    headers: this.headers
                });
                console.log(e.identityCode, response.status);

                if (!response.ok && response.status === 404) {
                    await this.collectDAO.deleteGarbage(e.identityCode);
                    console.log(`${e.identityCode} 삭제 완료.`);                
                }
                await new Promise(resolve => setTimeout(resolve, 50));    
            } catch (error) {
                console.log(error);
            }
        }
    }
}


