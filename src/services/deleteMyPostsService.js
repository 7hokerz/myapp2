const cheerio = require('cheerio');
const fetchUtil = require('../utils/fetchUtil');

module.exports = class deleteMyPostsService {
    
    constructor(SSEUtil, id, type, cno, page, limit, PHPSESSID) { 
        this.fetchUtil = new fetchUtil(false);
        this.SSEUtil = SSEUtil;
        this.id = id;
        this.type = type;
        this.cno = cno;
        this.page = page;
        this.restPage = Number(limit);
        this.noSet = new Set();
        this.headers = {
            'Accept': 'application/json',
            'Referer' : `http://gallog.dcinside.com//${this.id}/${this.type}/index?cno=${this.cno}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': `PHPSESSID=${PHPSESSID};`// PHPSESSID가 있어야 권한 획득
        }
        this.deleteUrl = `https://gallog.dcinside.com/${this.id}/ajax/log_list_ajax/delete`;
    }

    async deletePostsOrComments() {
        const url = `https://gallog.dcinside.com/${this.id}/${this.type}/index?cno=${this.cno}&p=${this.page}`;
        const response = await this.fetchUtil.axiosFetcher(url, 'GET', this.headers);

        const html = response.data;
        const $ = cheerio.load(html);

        $('.cont_box .cont_listbox li').each((index, element) => {
            const no = $(element).attr('data-no');
            this.noSet.add(no);
        });

        for(let no of this.noSet) {
            const data = new FormData();
            data.set('no', no);

            const response = await this.fetchUtil.axiosFetcher(this.deleteUrl, 'POST', this.headers, data);

            this.SSEUtil.SSESendEvent('no', { no, status: response.data.result });
            
            if(response.data.result === 'captcha') {
                console.log('캡챠');
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        this.noSet = new Set();
        this.restPage--;
        this.startPage++;
        
        return {
            status: {
                restPage: this.restPage,
                curPage: this.startPage,
            }
        }
    }

};

