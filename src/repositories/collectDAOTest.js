const pool = require('../config/mysql');

class CollectDAO {
    async insertUser(connection, user) {
        const { identityCode, nickname, galleryCode } = user

        const query = `
        INSERT INTO fixed_name_list (identityCode, nickname, galleryCODE)
        VALUES(?, ?, ?)
        ON DUPLICATE KEY UPDATE
            nickname = VALUES(nickname)`;

        await connection.execute(query, [identityCode, nickname, galleryCode]);
    }

    async findPostNoByUser(connection, user) {
        const { identityCode, galleryCode } = user;

        const checkQuery = `
            SELECT postNum FROM post_list p 
            JOIN fixed_name_list f
            ON f.identityCode = p.identityCode
                AND f.galleryCODE = p.galleryCODE
            WHERE f.identityCode = ? 
                AND f.galleryCODE = ?
            ORDER BY postNum ASC
            FOR UPDATE`;

        const [rows] = await connection.execute(checkQuery, [identityCode, galleryCode]);
        return rows;
    }

    async insertPost(connection, post) {
        const { postNo, identityCode, galleryCode } = post;

        const insertPostQuery = `
            INSERT INTO post_list (postNum, identityCode, galleryCODE)
            VALUES(?, ?, ?)`;

        await connection.execute(insertPostQuery, [postNo, identityCode, galleryCode]); 
    }

    async updatePost(connection, post) {
        const { postNo, smallestPostNo, identityCode, galleryCode } = post;

        const updatePostQuery = `
            UPDATE post_list SET postNum = ?
            WHERE postNum = ? AND identityCode = ? AND galleryCODE = ?`;

        await connection.execute(updatePostQuery, [postNo, smallestPostNo, identityCode, galleryCode]);
    }

    async findCommentNoByUser(connection, user) {
        const { identityCode, galleryCode } = user;

        const checkQuery = `
            SELECT postNum FROM comment_list c
            JOIN fixed_name_list f
            ON f.identityCode = c.identityCode
                AND f.galleryCODE = c.galleryCODE
            WHERE f.identityCode = ? 
                AND f.galleryCODE = ?
            ORDER BY postNum ASC
            FOR UPDATE`;
        
        const [rows] = await connection.execute(checkQuery, [identityCode, galleryCode]);
        return rows;
    }

    async insertComment(connection, comment) {
        const { postNo, identityCode, galleryCode, commentNo } = comment;

        const insertCommentQuery = `
            INSERT INTO comment_list (postNum, identityCode, galleryCODE, commentNum)
            VALUES(?, ?, ?, ?)`;

        await connection.execute(insertCommentQuery, [
            postNo, identityCode, galleryCode, commentNo]); 
    }

    async updateComment(connection, comment) {
        const { postNo, smallestPostNo, identityCode, galleryCode, commentNo } = comment;

        const updateCommentQuery = `
            UPDATE comment_list SET postNum = ?, commentNum = ?
            WHERE postNum = ? AND identityCode = ? AND galleryCODE = ?`;

        await connection.execute(updateCommentQuery, [
            postNo, commentNo, smallestPostNo, identityCode, galleryCode]);
    }

    async findAllPostsByUsers(connection, users) {
        const queryPost = `
            SELECT f.identityCode, p.galleryCODE, p.postNum
            FROM fixed_name_list f
            JOIN post_list p
            ON f.identityCode = p.identityCode
            AND f.galleryCODE = p.galleryCODE
            WHERE f.is_valid = 0
            AND f.identityCode IN (?)`;

        const [rowsPost] = await connection.query(queryPost, [users]);

        return rowsPost;
    }

    async findAllCommentsByUsers(connection, users) {
        const queryComment = `
            SELECT f.identityCode, c.galleryCODE, c.postNum
            FROM fixed_name_list f
            JOIN comment_list c
            ON f.identityCode = c.identityCode
            AND f.galleryCODE = c.galleryCODE
            WHERE f.is_valid = 0
            AND f.identityCode IN (?)`;

        const [rowsComment] = await connection.query(queryComment, [users]);

        return rowsComment;
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

    async getAllPosts(galleryCode) {
        const connection = await pool.getConnection();

        const queryPostTable = `
            SELECT postNum
            FROM post_list
            WHERE galleryCODE = ?
            ORDER BY postNum DESC`;

        const queryCommentTable = `
            SELECT postNum
            FROM comment_list
            WHERE galleryCODE = ?
            ORDER BY postNum DESC`;

        const [rows] = await connection.execute(queryPostTable, [galleryCode]);

        connection.release();

        return rows;
    }

    async deletePostInDB(postNum, galleryCode) {
        const queryPost = `
            DELETE FROM post_list
            WHERE postNum = ? 
            AND galleryCODE = ?`;
        
        const queryComment = `
            DELETE FROM comment_list
            WHERE postNum = ?
            AND galleryCODE = ?`;

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            await connection.execute(queryPost, [postNum, galleryCode]);
            await connection.execute(queryComment, [postNum, galleryCode]);

            await connection.commit();
        } catch (error) { 
            console.error("Error in deletePostInDB:", error);
            if(connection) {
                await connection.rollback();
            }
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async deleteCommentInDB(commentNum, galleryCode) {
        const queryComment = `
            DELETE FROM comment_list
            WHERE commentNum = ?
            AND galleryCODE = ?`;

        let connection;
        try {
            connection = await pool.getConnection();

            await connection.execute(queryComment, [commentNum, galleryCode]);

        } catch (error) { 
            console.error("Error in deleteCommentInDB:", error);
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
}

module.exports = CollectDAO;

/*
게시글, 댓글 분리 로직 필요

async runRaceConditionTest(testFunction) {
        const array = [];
        for(let i = 4; i < 80; i += 2) {
            array.push(i);
        }
        
        try {
            let startTime = Date.now();
            for(let i = 0; i < array.length; i++) {
                await testFunction(true, 'explore7258', array[i], 'grsgills'); 
                await testFunction(true, 'explore4719', array[i] + 1, 'grsgills'); 
            }
            
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



*/