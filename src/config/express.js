const express = require('express');
const cookieParser = require('cookie-parser');

module.exports = (app) => {
    app.use(cookieParser()); // 쿠키 해석
    app.use(express.urlencoded({ extended: true })); // HTML 폼 데이터 해석 및 req.body에 주입
    app.use(express.json()); // JSON 파싱

    app.set("view engine", "ejs");
    app.set("views", "./views");
}

