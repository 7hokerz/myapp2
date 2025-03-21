const pool = require('../config/mysql');

module.exports = class collectDAO {
    async insertToID(identityCode, nickname, galleryCode) {
        const connection = await pool.getConnection();

        const query = `
        INSERT INTO fixed_name_list (identityCode, nickname, galleryCODE)
        VALUES(?, ?, ?)
        ON DUPLICATE KEY UPDATE
            nickname = VALUES(nickname)`;

        await connection.execute(query, [identityCode, nickname, galleryCode]);

        connection.release();
    }

    async insertToPost(identityCode, postNum, galleryCODE) {
        const connection = await pool.getConnection();

        const checkQuery = `
        SELECT postNum FROM post_list 
        WHERE galleryCODE = ? AND identityCode = ?
        ORDER BY postNum ASC`; // 해당 갤러리 코드와 식별 코드가 일치하는 게시물 번호

        const insertQuery = `
        INSERT INTO post_list (galleryCODE, postNum, identityCode)
        VALUES(?, ?, ?)`; 
        
        const updateQuery = `
        UPDATE post_list SET postNum = ?
        WHERE galleryCODE = ? AND postNum = ?`;

        const [rows] = await connection.execute(checkQuery, [galleryCODE, identityCode]);

        const stat = rows.findIndex((e) => e.postNum == postNum); // 중복 번호 검증
        
        if(stat === -1) {
            if(rows.length === 0) {
                await connection.execute(insertQuery, [galleryCODE, postNum, identityCode]); 
            } else {
                for(let v of rows) {
                    if(rows.length < 2) { // 요소가 2개 미만
                        await connection.execute(insertQuery, [galleryCODE, postNum, identityCode]);
                        break; 
                    }
                    else if(v.postNum < postNum) { // 번호가 낮은 경우
                        await connection.execute(updateQuery, [postNum, galleryCODE, v.postNum]);
                        break;
                    }
                }
            }
        }

        connection.release();
    }

    async getUIDByGalleryCode(galleryCode) {
        const connection = await pool.getConnection();
        
        const query = `
        SELECT identityCode, nickname, galleryName, added_date
        FROM fixed_name_list F
        JOIN gallery_list G
        ON F.galleryCODE = G.galleryCODE
        WHERE F.galleryCODE = ?
        ORDER BY 
            identityCode ASC,
            galleryName ASC`;

        const [rows] = await connection.execute(query, [galleryCode]);
        
        connection.release();

        return rows;
    }

    async getGalleryCodeByUID(identityCode) {
        const connection = await pool.getConnection();
        
        const query = `
        SELECT identityCode, nickname, galleryName, added_date
        FROM fixed_name_list F
        JOIN gallery_list G
        ON F.galleryCODE = G.galleryCODE
        WHERE F.identityCode = ?
        ORDER BY 
            identityCode ASC,
            galleryName ASC`;

        const [rows] = await connection.execute(query, [identityCode]);
       
        connection.release();
        
        return rows;
    }

    async deleteGarbage(identityCode) {
        const connection = await pool.getConnection();

        const query = `
        DELETE FROM fixed_name_list
        WHERE identityCode = ?`;

        await connection.execute(query, [identityCode]);

        connection.release();
    }

}
