const SELECTORS = Object.freeze({
    POST_ITEM: '.gall_list .ub-content.us-post', // 게시글 리스트
    POST_WRITER: '.gall_writer.ub-writer', // 게시글 작성자 요소
    POST_TYPE_ATTR: 'data-type', // 게시글 타입(이미지 포함, 미포함 등)
    POST_TYPE_TXT: 'icon_txt', // 텍스트 게시글
    POST_TYPE_REC_TXT: 'icon_recomtxt', // 텍스트 게시글 (개념글)
    POST_TYPE_IMG: 'icon_pic', // 이미지 게시글
    POST_TYPE_REC_IMG: 'icon_recomimg', // 이미지 게시글 (개념글)
    POST_TYPE_NOTICE: 'icon_notice', // 공지글
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
    USER_POST_COMMENT_ITEM: '.cont_box .cont_listbox li',
});

const STATUS_FLAGS = Object.freeze({
    INVALID_PAGE: 1 << 0, // 포지션이 초기화되어 첫 페이지부터 시작
    INVALID_POSITION: 1 << 1, // 해당 포지션의 게시글을 모두 확인함
    NO_MORE_POSTS: 1 << 2, // 해당 페이지에 게시글이 없음
});

const URL_PATTERNS = Object.freeze({
    COMMENT_API: () => `https://m.dcinside.com/ajax/response-comment`, // 댓글 목록 불러오기 API

    GALLERY_MOB: (galleryId) => `https://m.dcinside.com/board/${galleryId}`, // 모바일 버전 갤러리 접속

    POST_SEARCH_DES: (galleryType, galleryId, curPage, position, type, content) => // 검색어로 특정 게시글 검색
        `https://gall.dcinside.com/${galleryType}board/lists/?id=${galleryId}&page=${curPage}&search_pos=${-position}&s_type=${type}&s_keyword=${content}`,

    POST_LIST_DES: (galleryType, galleryId, startPage) => // 전체 게시글 목록
        `https://gall.dcinside.com/${galleryType}board/lists/?id=${galleryId}&page=${startPage}&list_num=100`,

    POST_MOB: (galleryId, no) => `https://m.dcinside.com/board/${galleryId}/${no}`, // 특정 게시글 조회

    POST_DES: (galleryType, galleryId, no) => `https://gall.dcinside.com/${galleryType}board/view/?id=${galleryId}&no=${no}`, // 특정 게시글 조회

    DELETE_USER_POST_COMMENT_API: (uid) => `https://gallog.dcinside.com/${uid}/ajax/log_list_ajax/delete`, // 특정 유저의 게시글 OR 댓글 삭제 API

    USER_GALLOG_POST_COMMENT_LIST: (uid, type, cno, page) => `https://gallog.dcinside.com/${uid}/${type}/index?cno=${cno}&p=${page}`, // 특정 유저 게시글 OR 댓글 목록 조회

    USER_GALLOG_MAIN_DES: (uid) => `https://gallog.dcinside.com/${uid}`, // 갤로그 메인

    USER_GALLOG_MAIN_MOB: (uid) => `https://m.dcinside.com/gallog/${uid}`, // 갤로그 메인
}); 


module.exports = {
    SELECTORS,
    STATUS_FLAGS,
    URL_PATTERNS,
}