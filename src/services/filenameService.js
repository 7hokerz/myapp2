const cheerio = require('cheerio');
const fetchUtil = require('../utils/fetchUtil');

module.exports = class filenameService {
    
    constructor() {
        this.fetchUtil = new fetchUtil();
        this.stopFlag = true;
        this.postNoSet = new Set();
        this.galleryType = galleryType;
        this.galleryId = galleryId;
        this.restPage = Number(limit);
        this.startPage = startPage;
        this.curPage = 1;
    }

    async getFilenameFromSite() {
        while(!(this.stopFlag)) {
            await this.getPostsFromSite();

            await this.getFilenameFromPosts();

            if(this.restPage <= 1) this.stopFlag = true;
            this.postNoSet = new Set();
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
            let i = 0, batch = 1; 
            i < postNoArr.length; 
            i += batch, batch = Math.floor(Math.random() * 3) + 1
        ) { 
            const slicedArr = postNoArr.slice(i, i + batch); 
            const results = await Promise.allSettled(
                slicedArr.map((no) => {
                    const url = `https://gall.dcinside.com/${this.galleryType}board/view/?id=${this.galleryId}&no=${no}`;
                    return this.fetchUtil.axiosFetcher(url);
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
                            this.SSEUtil.SSESendEvent(res, 'post', {
                                filename: filename,
                                no: no,
                            });
                            console.log(filename, no);
                        }
                    }
                    this.CheckedPostNo(res, { no: no, });
                } else {
                    postNoArr.push(no);
                    console.log(response.reason, no);
                }
            });
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 100) + 100)); // 디도스 방지 딜레이 
        }
    }
    
}






