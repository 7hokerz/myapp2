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

        const checkQuery = `
            SELECT postNum FROM ${tableName} 
            JOIN fixed_name_list f
            ON f.identityCode = ${tableName}.identityCode
                AND f.galleryCODE = ${tableName}.galleryCODE
            WHERE f.identityCode = ? 
                AND f.galleryCODE = ?
                AND f.is_valid = 0
            ORDER BY postNum ASC
            FOR UPDATE`;// 해당 갤러리 코드와 식별 코드가 일치하는 게시물 번호

        const insertQuery = `
            INSERT INTO ${tableName} (postNum, identityCode, galleryCODE)
            VALUES(?, ?, ?)`;

        const updateQuery = `
            UPDATE ${tableName} SET postNum = ?
            WHERE postNum = ? AND identityCode = ? AND galleryCODE = ?`;

        let connection;
        try {
            connection = await pool.getConnection();
            //await connection.execute(`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);
            await connection.execute(`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`);
            await connection.beginTransaction();

            const [rows] = await connection.execute(checkQuery, [identityCode, galleryCODE]);

            const isDuplicate = rows.some(row => row.postNum == postNum) // 중복 번호 검증

            if(!isDuplicate) {
                if(rows.length < 2) {
                    await connection.execute(insertQuery, [postNum, identityCode, galleryCODE]); 
                } else {
                    const smallestPostNum = rows[0].postNum;
                    if(postNum > smallestPostNum) {
                        await connection.execute(updateQuery, [postNum, smallestPostNum, identityCode, galleryCODE]);
                    }
                }
            } 
            await connection.commit();

        } catch (error) { 
            console.error("Error in insertPostCommentNo:", error);
            if(connection) {
                await connection.rollback();
            }
            // 데드락 발생 시 재시도하는 로직 필요
        } finally {
            if (connection) {
                connection.release(); // 성공/실패 여부와 관계없이 커넥션 반환
            }
        }
    }

    async compareUIDs(uidsArray) {
        let connection;
        try {
            connection = await pool.getConnection();

            const queryPost = `
            SELECT f.identityCode, p.galleryCODE, p.postNum
            FROM fixed_name_list f
            JOIN post_list p
            ON f.identityCode = p.identityCode
            AND f.galleryCODE = p.galleryCODE
            WHERE f.identityCode IN (?)`;

            const queryComment = `
            SELECT f.identityCode, c.galleryCODE, c.postNum
            FROM fixed_name_list f
            JOIN comment_list c
            ON f.identityCode = c.identityCode
            AND f.galleryCODE = c.galleryCODE
            WHERE f.identityCode IN (?)`;
            
            const [rowsPost] = await connection.query(queryPost, [uidsArray]);

            const [rowsComment] = await connection.query(queryComment, [uidsArray]);

            return [...rowsPost, ...rowsComment];
        } catch (error) {
            console.error("Error in insertPostCommentNo:", error);
        } finally {
            if (connection) {
                connection.release(); // 성공/실패 여부와 관계없이 커넥션 반환
            }
        }
    }

    async getValidUIDs() {
        const connection = await pool.getConnection();

        const query = `
            SELECT DISTINCT identityCode
            FROM fixed_name_list
            WHERE is_valid = 0
            ORDER BY 1 ASC`;

        const [rows] = await connection.execute(query);

        connection.release();

        return rows;
    }

    async updateVaild(identityCode) { 
        const connection = await pool.getConnection();

        const query = `
            UPDATE fixed_name_list
            SET is_valid = 1
            WHERE identityCode = ?`;

        await connection.execute(query, [identityCode]);

        connection.release();
    }

    async getAllPosts() {
        const connection = await pool.getConnection();

        const query = `
            SELECT postNum, galleryCODE
            FROM post_list`;

        const [rows] = await connection.execute(query);

        connection.release();

        return rows;
    }

    async deletePostInDB(postNum, galleryCODE) {
        const connection = await pool.getConnection();

        const query = `
            DELETE FROM post_list
            WHERE postNum = ${postNum} 
            AND galleryCODE = ${galleryCODE}`;

        await connection.execute(query);

        connection.release();
    }

    async runRaceConditionTest(testFunction) {
        const array = [];
        for(let i = 4; i < 80; i += 2) {
            array.push(i);
        }
        
        try {
            let startTime = Date.now();/*
            for(let i = 0; i < array.length; i++) {
                await testFunction(true, 'explore7258', array[i], 'grsgills'); 
                await testFunction(true, 'explore4719', array[i] + 1, 'grsgills'); 
            }*/
            
            const results = await Promise.allSettled(
                array.map(async (no) => {
                    await testFunction(true, no % 2? 'explore7258': 'explore4719', no + 1, no % 2? 'girlsong': 'grsgills');
                    await testFunction(true, no % 2? 'explore4719': 'explore7258', no, no % 2? 'girlsong': 'grsgills'); 
                })
            );
            
            let endTime = Date.now();
            let time = endTime - startTime;
            console.log(`Concurrent operations finished in ${time} ms.`);

            results.forEach((result, i) => {
                if (result.status === 'rejected') {
                    console.error(`Error: ${result.reason}`);
                }
            });
            console.log("All operations completed successfully.");
        } catch (error) {
            console.error("Test failed:", error);
        }
    }

    async test() {
        await this.runRaceConditionTest(this.insertPostCommentNo);
    }
}


/*

*/