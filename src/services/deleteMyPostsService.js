const cheerio = require('cheerio');
//const puppeteer = require('puppeteer');
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
        this.PHPSESSID = PHPSESSID;
        this.headers = {
            'Accept': 'application/json',
            'Referer' : `http://gallog.dcinside.com//${this.id}/${this.type}/index?cno=${this.cno}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': `PHPSESSID=${this.PHPSESSID};`// PHPSESSID가 있어야 권한 획득
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

            if(response.data.result === 'captcha') { // 캡챠를 해결하기 위한 추가 방법 필요
                console.log('캡챠');
                
                await new Promise(resolve => setTimeout(resolve, 20000));
            }
        }
        this.noSet = new Set();
        this.restPage--;
        this.page++;
        
        return {
            status: {
                restPage: this.restPage,
                curPage: this.page,
            }
        }
    }

    // 작동하지 않으므로 추후 수정 필요
    async handleCaptcha(url) {
        // 원하는 쿠키 값 저장
        const desiredCookie = {
            name: 'PHPSESSID',
            value: this.PHPSESSID,
            domain: 'dcinside.com',
        };

        const browser = await puppeteer.launch({
            headless: false
        });

        const context = browser.defaultBrowserContext();

        const page = await browser.newPage();

        await page.goto(url)

        await context.setCookie(desiredCookie);

        // 쿠키 값 모니터링 및 복원 함수
        const monitorCookie = async () => {
            while (true) {
                // 현재 쿠키 확인
                const cookies = await browser.cookies();

                const currentCookie = cookies.find(c => c.name === desiredCookie.name);
                console.log(currentCookie.value, desiredCookie.value)
                if (!currentCookie || currentCookie.value !== desiredCookie.value) {
                    console.log(currentCookie + '쿠키 값이 변경됨, 복원 중...');
                    //await browser.defaultBrowserContext().setCookie(desiredCookie);
                }
                
                // 잠시 대기
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        };

        // 쿠키 모니터링 시작 (백그라운드 작업)
        await monitorCookie().catch(err => console.error('쿠키 모니터링 오류:', err));


        const deleteBtn = await page.$('.btn_delete')

        //await deleteBtn.click();

    }
};

