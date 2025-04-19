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

    async insertPostCommentNo(mode, identityCode, postNum, galleryCODE) {
        const tableName = (mode) ? 'post_list' : 'comment_list';

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            //await connection.execute(`SET TRANSACTION ISOLATION LEVEL READ COMMITTEND`);

            const checkQuery = `
            SELECT postNum FROM ${tableName} 
            WHERE identityCode = ? AND galleryCODE = ?
            ORDER BY postNum ASC`; // 해당 갤러리 코드와 식별 코드가 일치하는 게시물 번호
            //FOR UPDATE`;
            const [rows] = await connection.execute(checkQuery, [identityCode, galleryCODE]);

            const isDuplicate = rows.some(row => row.postNum == postNum) // 중복 번호 검증

            if(!isDuplicate) {
                const insertQuery = `
                INSERT INTO ${tableName} (galleryCODE, postNum, identityCode)
                VALUES(?, ?, ?)`; 
                
                if(rows.length < 2) {
                    await connection.execute(insertQuery, [galleryCODE, postNum, identityCode]); 
                } else {
                    const smallestPostNum = rows[0].postNum;
                    if(postNum > smallestPostNum) {
                        const updateQuery = `
                        UPDATE ${tableName} SET postNum = ?
                        WHERE identityCode = ? AND galleryCODE = ? AND postNum = ?`;

                        await connection.execute(updateQuery, [postNum, identityCode, galleryCODE, smallestPostNum]);
                    }
                }
            }
            await connection.commit();
        } catch (error) {
            console.error("Error in insertPostCommentNo:", error);
            if(connection) {
                await connection.rollback();
            }
        } finally {
            if (connection) {
                connection.release(); // 성공/실패 여부와 관계없이 커넥션 반환
            }
        }
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

    async runRaceConditionTest(testFunction) {
        const testUser = 'explore9702';
        const testGallery = 'grsgills';
        const concurrentNum1 = 15; // 10을 15로 업데이트 시도
        const concurrentNum2 = 25;
    
        try {
            const results = await Promise.allSettled([
                testFunction(true, testUser, concurrentNum1, testGallery), 
                testFunction(true, testUser, concurrentNum2, testGallery)
            ]);
    
            console.log('Concurrent operations finished.');
            results.forEach((result, i) => {
                if (result.status === 'rejected') {
                    console.error(`   Error: ${result.reason}`);
                }
            });
    
        } catch (error) {
            console.error("Test failed:", error);
        }
    
    }

    async test() {
        await this.runRaceConditionTest(this.insertPostCommentNo);
    }
}


/*
async insertPostCommentNo(mode, identityCode, postNum, galleryCODE) {
        const tableName = (mode) ? 'post_list' : 'comment_list';

        const connection = await pool.getConnection();

        const checkQuery = `
        SELECT postNum FROM ${tableName} 
        WHERE identityCode = ? AND galleryCODE = ?
        ORDER BY postNum ASC`; // 해당 갤러리 코드와 식별 코드가 일치하는 게시물 번호

        const insertQuery = `
        INSERT INTO ${tableName} (galleryCODE, postNum, identityCode)
        VALUES(?, ?, ?)`; 
        
        const updateQuery = `
        UPDATE ${tableName} SET postNum = ?
        WHERE identityCode = ? AND galleryCODE = ? AND postNum = ?`;

        const [rows] = await connection.execute(checkQuery, [identityCode, galleryCODE]);

        const isDuplicate = rows.some(row => row.postNum == postNum) // 중복 번호 검증

        if(!isDuplicate) {
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
*/