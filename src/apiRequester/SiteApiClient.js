const { URL_PATTERNS } = require('../config/const');
const { headers_des_chrome, headers_mob_chrome_comment_api, headers_mob_chrome_gallog } = require('../config/apiHeader');

class SiteApiClient {

    constructor(fetchUtil) {
        this.fetchUtil = fetchUtil;
    }

    async getUsersFromComments(galleryId, options) {
        const { no, csrfToken } = options;

        const url = URL_PATTERNS.COMMENT_API();
        const data = {
            'id': galleryId,
            'no': no,
            'cpage': 1,
            'managerskill': '',
            'csort': '',
            'permission_pw': '',
        };
        const payload = `id=${galleryId}&no=${no}&cpage=1&managerskill=&csort=&permission_pw=`;
        const headers = {...headers_mob_chrome_comment_api};
        headers['Content-Length'] = payload.length;
        headers['Referer'] = URL_PATTERNS.POST_MOB(galleryId, no);
        headers['X-CSRF-TOKEN'] = csrfToken;

        const response = await this.fetchUtil.axiosFetcher(url, 'POST', headers, 1, data, 5000);
        return response.data;
    }

    async getUsersFromPostList(galleryType, galleryId, options) {
        const { page } = options;

        const url = URL_PATTERNS.POST_LIST_DES(galleryType, galleryId, page);
        const headers = {...headers_des_chrome};

        const response = await this.fetchUtil.axiosFetcher(url, 'GET', headers, 0);
        return response.data;
    }

    async getUsersFromPostListFiltered(galleryType, galleryId, options) {
        const { page, position, type, content } = options;
        
        const url = URL_PATTERNS.POST_SEARCH_DES(galleryType, galleryId, page, position, type, content);
        const headers = {...headers_des_chrome};

        const response = await this.fetchUtil.axiosFetcher(url, 'GET', headers, 0);

        return {
            data: response.data,
            request: response.request
        };
    }

    async getTotalPostFromSite(galleryId) {
        const url = URL_PATTERNS.GALLERY_MOB(galleryId)
        const headers = {...headers_mob_chrome_comment_api};

        const response = await this.fetchUtil.axiosFetcher(url, 'GET', headers, 1);
        return response.data;
    }

    async getCsrfTokenFromPage(galleryId) {
        const url = URL_PATTERNS.GALLERY_MOB(galleryId);
        const headers = {...headers_mob_chrome_gallog};

        const response = await this.fetchUtil.axiosFetcher(url, 'GET', headers, 1);
        return response.data;
    }

    async getPostMoblie(galleryId, options) {
        const { postNum } = options;

        const url = URL_PATTERNS.POST_MOB(galleryId, postNum);
        const headers = {...headers_mob_chrome_gallog};

        const response = await this.fetchUtil.axiosFetcher(url, 'GET', headers, 1, null, 20000, 2000);

        return {
            data: response.data,
            status: response.status,
            headers: response.headers,
        };
    }

    async getUserGallogMobile(identityCode) {
        const url = URL_PATTERNS.USER_GALLOG_MAIN_MOB(identityCode);
        const headers = {...headers_mob_chrome_gallog};

        const response = await this.fetchUtil.axiosFetcher(url, 'GET', headers, 1, null, 20000, 2000);

        return {
            data: response.data,
            status: response.status,
            headers: response.headers,
        };
    }

}

module.exports = SiteApiClient;