const pool = require('../config/mysql');

module.exports = class collectDAO {
    async insertUid(identityCode, nickname, galleryCode) {
        const connection = await pool.getConnection();

        const query = `
        INSERT INTO fixed_name_list (identityCode, nickname, galleryCODE)
        VALUES(?, ?, ?)
        ON DUPLICATE KEY UPDATE
            nickname = VALUES(nickname)`;

        await connection.execute(query, [identityCode, nickname, galleryCode]);

        connection.release();
    }

    async insertPostCommentNo(m, identityCode, postNum, galleryCODE) {
        const mode = (m) ? 'post_list' : 'comment_list';

        const connection = await pool.getConnection();

        const checkQuery = `
        SELECT postNum FROM ${mode} 
        WHERE galleryCODE = ? AND identityCode = ?
        ORDER BY postNum ASC`; // 해당 갤러리 코드와 식별 코드가 일치하는 게시물 번호

        const insertQuery = `
        INSERT INTO ${mode} (galleryCODE, postNum, identityCode)
        VALUES(?, ?, ?)`; 
        
        const updateQuery = `
        UPDATE ${mode} SET postNum = ?
        WHERE identityCode = ? AND galleryCODE = ? AND postNum = ?`;

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
                        await connection.execute(updateQuery, [postNum, identityCode, galleryCODE, v.postNum]);
                        break;
                    }
                }
            }
        }

        connection.release();
    }

    async getCommentNoByUID(identityCode) {
        const connection = await pool.getConnection();
        
        const query = `
        SELECT 
            f.identityCode, f.nickname, f.galleryCODE, c.postNum 
        FROM 
            dc.fixed_name_list f
        JOIN 
            dc.comment_list c
        ON 
            f.identityCode = c.identityCode
        AND 
            f.galleryCODE = c.galleryCode
        WHERE 
            f.identityCode = ?`;

        const [rows] = await connection.execute(query, [identityCode]);
        
        connection.release();

        return rows;
    }

    async getPostNoByUID(identityCode) {
        const connection = await pool.getConnection();
        
        const query = `
        SELECT 
            f.identityCode, f.nickname, f.galleryCODE, p.postNum 
        FROM 
            dc.fixed_name_list f
        JOIN 
            dc.post_list p
        ON 
            f.identityCode = p.identityCode
        AND 
            f.galleryCODE = p.galleryCode
        WHERE 
            f.identityCode = ?`;

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
