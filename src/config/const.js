const SELECTORS = Object.freeze({
    POST_ITEM: '.gall_list .ub-content.us-post', // 게시글 리스트
    POST_WRITER: '.gall_writer.ub-writer', // 게시글 작성자 요소
    POST_TYPE_ATTR: 'data-type', // 게시글 타입(이미지 포함, 미포함 등)
    POST_TYPE_IMG: 'icon_pic', // 이미지 게시글
    POST_TYPE_REC_IMG: 'icon_recomimg', // 이미지 게시글 (개념글)
    POST_NO_ATTR: 'data-no', // 게시글 번호
    POST_UID_ATTR: 'data-uid', // 게시글 작성자 UID
    POST_NICK_ATTR: 'data-nick', // 게시글 작성자 NICK
    POST_HAS_COMMENT: '.gall_tit.ub-word .reply_numbox', // 게시글 댓글 유무
    POST_COUNT: 'span.count', // 갤러리의 총 게시글 수
    FILENAME_LINK: '.appending_file_box .appending_file li a', // 게시글 첨부파일명
    COMMENT_ITEM: '.all-comment-lst li', // 댓글 리스트
    COMMENT_UID_ITEM: 'a .blockCommentId', // 댓글 작성자 요소
    COMMENT_UID_ATTR: 'data-info', // 댓글 작성자 UID
    COMMENT_NICK_ATTR: 'a.nick', // 댓글 작성자 NICK
});

const STATUS_FLAGS = Object.freeze({
    INVALID_PAGE: 1 << 0,
    INVALID_POSITION: 1 << 1,
    NO_MORE_POSTS: 1 << 2,
});

const URL_PATTERNS = Object.freeze({
    COMMENT_API: () => `https://m.dcinside.com/ajax/response-comment`,

    GALLERY_MOB: (galleryId) => `https://m.dcinside.com/board/${galleryId}`,

    POST_SEARCH_DES: (galleryType, galleryId, curPage, position, type, content) => 
        `https://gall.dcinside.com/${galleryType}board/lists/?id=${galleryId}&page=${curPage}&search_pos=${-position}&s_type=${type}&s_keyword=${content}`,

    POST_LIST_DES: (galleryType, galleryId, startPage) => 
        `https://gall.dcinside.com/${galleryType}board/lists/?id=${galleryId}&page=${startPage}&list_num=100&search_head=0`,

    POST_MOB: (galleryId, no) => `https://m.dcinside.com/board/${galleryId}/${no}`,

    POST_DES: (galleryType, galleryId, no) => `https://gall.dcinside.com/${galleryType}board/view/?id=${galleryId}&no=${no}`,
});


module.exports = {
    SELECTORS,
    STATUS_FLAGS,
    URL_PATTERNS,
}