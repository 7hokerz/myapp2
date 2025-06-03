const cheerio = require('cheerio');
const fetchUtil = require('../utils/fetchUtil');
const { headers_mob_chrome_comment_api, headers_mob_chrome_gallog } = require('../config/apiHeader');
const { URL_PATTERNS } = require('../config/const');

class writeService {

    constructor({ uid, isProxy }) {
        this.fetchUtil = new fetchUtil(isProxy);
        this.uid = uid;
    }


    async process() {
        const csrfToken = await this._getCsrfToken();
        const blockKey = await this._getBlockKey("guestbook", csrfToken);
        await this._writeGuestBook(blockKey, csrfToken);
    }

    async _writeGuestBook(blockKey, csrfToken) {
        const url = URL_PATTERNS.USER_GALLOG_WRITE_GUESTBOOK_MOB();
        const payload = {
            "g_id": this.uid,
            "gb_memo": 'test',
            "gb_name": 'test',
            "gb_password": 'test',
            "secret": '',
            "parent_no": undefined,
            "mode": "gb_write",
            "subject": "방명록에 새글이 등록되었습니다.",
            "con_key": blockKey, //res의 Block_key
        };

        try {
            const headers_mob = {...headers_mob_chrome_comment_api};
            headers_mob['Content-Length'] = new URLSearchParams(payload).toString().length;
            headers_mob['Referer'] = URL_PATTERNS.USER_GALLOG_MAIN_MOB(this.uid);
            headers_mob['X-CSRF-TOKEN'] = csrfToken;

            const response = await this.fetchUtil.axiosFetcher(url, 'POST', headers_mob, 1, data2);
            
            if(response.data.result && response.data.data) {

            }
        } catch (error) {
            
        }
    }

    async _getBlockKey(tokenVerify, csrfToken) {
        const url = URL_PATTERNS.ACCESS_MOB();
        const payload = {
            "token_verify": tokenVerify
        }

        try {
            const headers_mob = {...headers_mob_chrome_comment_api};
            headers_mob['Content-Length'] = new URLSearchParams(payload).toString().length;
            headers_mob['Referer'] = URL_PATTERNS.USER_GALLOG_MAIN_MOB(this.uid);
            headers_mob['X-CSRF-TOKEN'] = csrfToken;

            const response = await this.fetchUtil.axiosFetcher(url, 'POST', headers_mob, 1, payload);
            if(response.data.result) return response.data["Block_key"];
            return null;
        } catch (error) {
            
        }
    }

    async _DeleteGuestBook() {

    }

    async _getCsrfToken() {
        if(!this.csrfToken) {
            const url = URL_PATTERNS.GALLERY_MOB(this.galleryId);
            const response = await this.fetchUtil.axiosFetcher(url, 'GET', {...headers_mob_chrome_gallog}, 1);

            const html = response.data;
            const $ = cheerio.load(html);
            return $('meta[name="csrf-token"]').attr('content');
        }
    }
}

new writeService({isProxy: true, uid: ""})._writeGuestBook();

/*
    방명록 작성 PC
    const url = 'https://gallog.dcinside.com/ajax/guestbook_ajax/write';
    const data = { 
        'ci_t' : csrf_token, >> var csrf_token = get_cookie('ci_c');
        'name' : name, 
        'password' : password, 
        'memo' : memo, 
        'is_secret' : is_secret >> 0, 1
    },

    
    방명록 작성 MOB
    1.
    const url = 'https://m.dcinside.com/ajax/access';
    const data = {
        "token_verify": "guestbook"
    }

    res >> {"result":true,"Block_key":"2aa8d535f1d037a965a3cae441857364b500f9e403"}
    
    2.
    const url = 'https://m.dcinside.com/gallog/guestbook-write';

    const data = {
        "g_id": 
        "gb_memo": 
        "gb_name":
        "gb_password":
        "secret": '',
        "parent_no": undefined,
        "mode": "gb_write",
        "subject": "방명록에 새글이 등록되었습니다."
        "con_key": res의 Block_key
    }

    x-ratelimit-limit: 10

    

    
*/