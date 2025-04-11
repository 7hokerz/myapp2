const cheerio = require('cheerio');
const fetchUtil = require('../utils/fetchUtil');
const collectDAO = require('../repositories/collectDAO');

const SELECTORS = {
    POST_ITEM: '.gall_list .ub-content.us-post', // 게시글 요소
    POST_WRITER: '.gall_writer.ub-writer', // 게시글 작성자 요소
    POST_TYPE_ATTR: 'data-type', // 게시글 타입(이미지 포함, 미포함 등)
    POST_NO_ATTR: 'data-no', // 게시글 번호
    POST_UID_ATTR: 'data-uid', // 게시글 작성자 UID
    FILENAME_LINK: '.appending_file_box .appending_file li a', // 첨부파일명
};

module.exports = class collectService {
    commentApi = `https://m.dcinside.com/ajax/response-comment`;
    STATUS_FLAGS = {
        INVALID_PAGE: 1 << 0,
        INVALID_POSITION: 1 << 1,
        NO_MORE_POSTS: 1 << 2,
    };
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
    collectDAO = new collectDAO();
    identityMap = new Map();
    postNoSet = new Set();
    commentNoSet = new Set();
    hasCommentPostNoSet = new Set();
    statBit = 0;
    curPage = 1;

    constructor(
        { SSEUtil, galleryType, galleryId, limit, pos, content, type, id, isProxy }
    ) {
        this.fetchUtil = new fetchUtil(isProxy);
        this.SSEUtil = SSEUtil;
        this.galleryType = galleryType;
        this.galleryId = galleryId;
        this.restPage = Number(limit);
        this.position = Number(pos);
        this.content = content;
        this.type = type;
        this.id = id;
    }

    async getNicknameFromSite() {
        //await this.collectDAO.test();
        if(this.position < 1) this.position = await this.getTotalPostCount();
        await this.getNicknameFromPostLists();
        await this.getNicknameFromCommentsInPost();
        this.hasCommentPostNoSet = new Set();
        this.updateStatus();
        
        return {
            identityMap: this.identityMap,
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

        const hasPosts = urlPage > 0 && $(SELECTORS.POST_ITEM).length; // 페이지에 게시글이 존재하는가?
        
        const isValidPage = hasPosts && this.curPage === urlPage; // 이전에 조회한 적 없거나 유효한 페이지인가?
        
        if (!isValidPage) {
            this.statBit |= hasPosts ? 0 : this.STATUS_FLAGS.NO_MORE_POSTS;
            this.statBit |= this.STATUS_FLAGS.INVALID_POSITION;
            this.statBit |= this.STATUS_FLAGS.INVALID_PAGE; 
        } else {
            $(SELECTORS.POST_ITEM).each((index, element) => {
                const uid = $(element).find(SELECTORS.POST_WRITER).attr(SELECTORS.POST_UID_ATTR);
                
                if(uid) {
                    const nick = $(element).find('.gall_writer').attr('data-nick');
                    const no = $(element).attr(SELECTORS.POST_NO_ATTR); 
                    const isComment = $(element).find('.gall_tit.ub-word .reply_numbox').text();
                    
                    this.identityMap.set(uid, nick);
                    this.postNoSet.add({uid, no});
                    if(isComment) this.hasCommentPostNoSet.add(no);
                }
            });
            this.statBit |= this.STATUS_FLAGS.NO_MORE_POSTS; // restPage
        }
    }

    async getNicknameFromCommentsInPost() { //mob
        const postNoQueue = Array.from(this.hasCommentPostNoSet);
        let currentQueue = [...postNoQueue];
        const failedQueue = [];

        while(currentQueue.length > 0) {
            let batchSize = Math.floor(Math.random() * 5) + 20; 
            const batch = currentQueue.splice(0, batchSize);

            const results = await Promise.allSettled(
                batch.map(async (no) => {
                    const url = this.commentApi;
                    const data = {
                        'id': this.galleryId,
                        'no': no,
                        'cpage': 1,
                    };
                    this.headers_mob['Referer'] = `https://m.dcinside.com/board/${this.galleryId}/${no}`;
                    try {
                        const response = await this.fetchUtil.axiosFetcher(url, 'POST', this.headers_mob, 1, data);
                        return { no, response: response };
                    } catch (error) {
                        return { no, reason: error };
                    }
                })
            );

            results.forEach(result => {
                const { status, value, reason } = result;

                if(status === "fulfilled") {
                    const { no, response } = value;
                    const html = response.data;
                    const $ = cheerio.load(html);
                    $('.all-comment-lst li').each((index, element) => {
                        const uid = $(element).find('a .blockCommentId').attr('data-info');
                        const nick = $(element).find('a.nick').text();
                        
                        if(uid /*&& nick === 'ㅇㅇ'*/) { // 닉네임이 ㅇㅇ
                            this.identityMap.set(uid, nick);
                            this.commentNoSet.add({uid, no});
                        }
                    });
                } else {
                    failedQueue.push(no);
                    console.log(reason, no);
                }
            });
            // 배치 처리 후 딜레이
            if (currentQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500) + 250);
            }
        }
    }

    async insertToID() {
        try {
            for(let [k,v] of this.identityMap) { // id 추가
                await this.collectDAO.insertUid(k, v, this.galleryId);
            }
            // 병렬 처리가 필요하다면 위에서처럼 batch로 나눠서 하는 게 좋을 듯
            for(let v of this.postNoSet) { 
                await this.collectDAO.insertPostCommentNo(1, v.uid, v.no, this.galleryId);
            }
            for(let v of this.commentNoSet) { 
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
        this.restPage = (this.statBit & this.STATUS_FLAGS.NO_MORE_POSTS) ? this.restPage - 1: this.restPage;

        this.position = (this.statBit & this.STATUS_FLAGS.INVALID_POSITION) ? this.position - 10000: this.position;

        this.curPage = (this.statBit & this.STATUS_FLAGS.INVALID_PAGE) ? 1 : this.curPage + 1;

        this.statBit = 0;
    }
}


/*
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
                        
                        if(uid && nick === 'ㅇㅇ') { // 닉네임이 ㅇㅇ
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

*/