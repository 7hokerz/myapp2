const cheerio = require('cheerio');
const { SELECTORS } = require('../config/const');

class DataParser {
    
    parseUsersFromPostList(html) {
        const users = new Map();
        const posts = new Set();

        const $ = cheerio.load(html);

        $(SELECTORS.POST_ITEM).each((index, element) => {
            const type = $(element).attr(SELECTORS.POST_TYPE_ATTR); // 게시글 구분 (공지, 이미지, 텍스트 등...)
            const uid = $(element).find(SELECTORS.POST_WRITER).attr(SELECTORS.POST_UID_ATTR); // 식별코드
            const no = $(element).attr(SELECTORS.POST_NO_ATTR); // 게시글 번호

            if(type !== SELECTORS.POST_TYPE_NOTICE) { 
                if(uid) {
                    const nick = $(element).find(SELECTORS.POST_WRITER).attr(SELECTORS.POST_NICK_ATTR); // 닉네임

                    if(nick) {
                        if(!users.has(uid)) {
                            users.set(uid, nick);
                        }
                        posts.add({uid, no});
                    }
                }
                const hasComment = $(element).find(SELECTORS.POST_HAS_COMMENT).text(); // 댓글 유무

                if(hasComment) posts.add({uid: null, no});
            }
        });
        return { users, posts };
    }

    parseUsersFromComments(html, postNo) {
        const users = new Map();
        const comments = new Set();

        const $ = cheerio.load(html);

        $(SELECTORS.COMMENT_ITEM).each((index, element) => {
            const commentNo = $(element).attr('no'); // 댓글 번호
            const uid = $(element).find(SELECTORS.COMMENT_UID_ITEM).attr(SELECTORS.COMMENT_UID_ATTR); // 식별코드
            const nick = $(element).find(SELECTORS.COMMENT_NICK_ATTR).text(); // 닉네임

            if(uid) {
                if(!users.has(uid)) {
                    users.set(uid, nick);
                }
                comments.add({uid, postNo, commentNo});
            }
        });
        return { users, comments };
    }

    parseFilenameFromPost(html, postNo) {
        const filenames = new Map();

        const $ = cheerio.load(html);
        const filename = $(SELECTORS.FILENAME_LINK).text().trim();

        if(filename) {


            filenames.set(postNo, filename);
        }

        return filenames;
    }

    /**
     * HTML에서 CSRF TOKEN을 파싱합니다.
     * @param {string} html 
     * @returns {string}
     */
    parseCsrfTokenFromPage(html) {
        const $ = cheerio.load(html);
        const csrfToken = $('meta[name="csrf-token"]').attr('content');

        if(!csrfToken) {
            return null;
            // 또는 에러 던지기
        }
        return csrfToken;
    }
}

module.exports = DataParser;