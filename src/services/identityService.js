const cheerio = require('cheerio');
const fetchUtil = require('../utils/fetchUtil');
const collectDAO = require('../repositories/collectDAO');

module.exports = class collectService {
    commentApi = `https://m.dcinside.com/ajax/response-comment`;
    
    headers_des = {
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
    headers_mob = {
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'ko-KR,ko;q=0.6',
        'Connection': 'keep-alive',
        'Host': 'm.dcinside.com',
        'Origin': 'https://m.dcinside.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-GPC': 1,
        'X-Requested-With': 'XMLHttpRequest',
        'sec-ch-ua': '"Chromium";v="134", " Not A;Brand";v="24", "Google Chrome";v="134"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': 'Android',
    };

    constructor(SSEUtil, galleryType, galleryId, limit, pos, content, type, id, isProxy) {
        this.fetchUtil = new fetchUtil(isProxy);
        this.collectDAO = new collectDAO();
        this.idMap = new Map();
        this.noSet = new Set();
        this.hasCommentPostNoSet = new Set();
        this.noSetC = new Set();
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

        this.filteredPostListUrl = ``;
    }

    async getNicknameFromSite() {
        if(this.position < 1) this.position = await this.getTotalPostCount();
        await this.getNicknameFromPostLists();
        await this.getNicknameFromCommentsInPost();
        this.hasCommentPostNoSet = new Set();
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

    async getTotalPostCount() { // mob
        const url = `https://m.dcinside.com/board/${this.galleryId}`;
        const response = await this.fetchUtil.axiosFetcher(url, 'GET', this.headers_mob, 1);
        const html = response.data;
        const $ = cheerio.load(html);

        const tot = $('span.count').text().replace(/[^0-9]/g, "");

        return tot;
    }
    
    async getNicknameFromPostLists() { //des
        const url = `
        https://gall.dcinside.com/${this.galleryType}board/lists/?id=${this.galleryId}&page=${this.curPage}&search_pos=${-this.position}&s_type=${this.type}&s_keyword=${this.content}`;
        const response = await this.fetchUtil.axiosFetcher(url, 'GET', this.headers_des);
        
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
                const uid = $(element).find('.gall_writer.ub-writer').attr('data-uid');
                
                if(uid) {
                    const nick = $(element).find('.gall_writer').attr('data-nick');
                    const no = $(element).attr('data-no');
                    const isComment = $(element).find('.gall_tit.ub-word .reply_numbox').text();
                    
                    this.idMap.set(uid, nick);
                    this.noSet.add({uid, no});
                    if(isComment) this.hasCommentPostNoSet.add(no);
                }
            });
            this.statBit |= (1 << 2); // restPage
        }
    }

    async getNicknameFromCommentsInPost() { // mob
        const postNoArr = Array.from(this.hasCommentPostNoSet);

        for ( 
            let i = 0, batch = Math.floor(Math.random() * 5) + 20; 
            i < postNoArr.length; 
            i += batch, batch = Math.floor(Math.random() * 5) + 20
        ) { 
            const slicedArr = postNoArr.slice(i, i + batch); 
            const results = await Promise.allSettled( // 댓글 api
                slicedArr.map((no) => {
                    const url = this.commentApi;
                    const data = {
                        'id': this.galleryId,
                        'no': no,
                        'cpage': 1,
                    };
                    this.headers_mob['Referer'] = `https://m.dcinside.com/board/${this.galleryId}/${no}`;
                    return this.fetchUtil.axiosFetcher(url, 'POST', this.headers_mob, 0, data);
                })
            );

            results.forEach((response, index) => {
                const no = postNoArr[i + index];

                if (response.status === "fulfilled") {
                    const html = response.value.data;
                    const $ = cheerio.load(html);
                    $('.all-comment-lst li').each((index, element) => {
                        const uid = $(element).find('a .blockCommentId').attr('data-info');
                        const nick = $(element).find('a.nick').text();
                        
                        if(uid /*&& nick === 'ㅇㅇ'*/) { // 닉네임이 ㅇㅇ
                            this.idMap.set(uid, nick);
                            this.noSetC.add({uid, no});
                        }
                    });
                } else {
                    postNoArr.push(no);
                    console.log(response.reason, no);
                }
            });
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 150) + 100)); // 디도스 방지 딜레이 
        }
    }

    async insertToID() {
        try {
            for(let [k,v] of this.idMap) { // id 추가
                await this.collectDAO.insertUid(k, v, this.galleryId);
            }
            for(let v of this.noSet) { // 게시물 번호 추가
                await this.collectDAO.insertPostCommentNo(1, v.uid, v.no, this.galleryId);
            }
            for(let v of this.noSetC) { // 게시물 번호 추가 (댓글)
                await this.collectDAO.insertPostCommentNo(0, v.uid, v.no, this.galleryId);
            }
        } catch (error) {
            console.log(error);
        }
    }

    async getCommentNoByUID() {
        const data = await this.collectDAO.getCommentNoByUID(this.identityCode);
        return data;
    }

    async getPostNoByUID() {
        const data = await this.collectDAO.getPostNoByUID(this.identityCode);
        return data;
    }

    async deleteGarbage() {
        const data = await this.collectDAO.getUIDByGalleryCode(this.galleryId);

        for(let e of data) {
            if(this.stopFlag) break;
            try {
                const url = `https://gallog.dcinside.com/${e.identityCode}`;
                const response = this.fetchUtil.axiosFetcher(url, 'GET', this.headers_des);

                console.log(e.identityCode, response.status);

                if (response.status === 404) {
                    await this.collectDAO.deleteGarbage(e.identityCode);
                    this.SSEUtil.SSESendEvent('delete', {
                        id: e.identityCode,
                    });
                    console.log(`${e.identityCode} 삭제 완료.`);                
                }  
            } catch (error) {
                console.log(error);
            }
        }
    }

    async compareUidToRank() { // 갤랭과 비교

    }

    updateStatus() {
        this.restPage = (this.statBit & (1 << 2)) ? this.restPage - 1: this.restPage;

        this.position = (this.statBit & (1 << 1)) ? this.position - 10000: this.position;

        this.curPage = (this.statBit & (1 << 0)) ? 1 : this.curPage + 1;

        this.statBit = 0;
    }
}


