const express = require('express');
const app = express();
const configExpress = require('./config/express');

configExpress(app);

const collectService = require('./services/collectService');
const SSEUtil = require('./utils/SSEUtil');
const collectController = require('./controller/collectController');
const filenameController = require('./controller/filenameController');

const collectservice = new collectService();
const SSEutil = new SSEUtil();
const collectcontroller = new collectController();
const filenamecontroller = new filenameController();

app.get('/', (req, res) => {
    const { mode, type } = req.query;
    res.render('index', {
        mode: mode || 'nick',
        type: mode === 'nick' ? type || 'search_name' : '',
    });
});

app.get('/api/user/stop', (req, res) => {
    collectcontroller.stopSearch();
    filenamecontroller.stopSearch();
    res.json({ message: '검색이 중지되었습니다.' });
});

app.get('/api/user/collect', async (req, res) => {
    try {
        await collectcontroller.getNicknameFromSite(res);
        await collectcontroller.insertToID();
    } catch (error) {
        console.log(error);
    }
});

app.get('/api/post/filename', async (req, res) => {
    try {
        await filenamecontroller.getFilenameFromSite(req, res);
    } catch (error) {
        console.log(error);
    }
});

app.post('/api/client-input', async (req, res) => { 
    const { mode, type } = req.query;
    if(mode === 'filename') await filenamecontroller.init(req.body);
    if(mode === 'nick') {
        if(type === 'search_subject_memo') req.body.nickname = '';
        if(type === 'search_name') req.body.keyword = '';
        await collectcontroller.init(req.body);
    }
    res.json({ status: 'success' });
});

app.get('/api/nickname-list', async (req, res) => {
    const { galleryid } = req.query;
    const data = await collectservice.getUIDByGalleryCode(galleryid);
    res.json(data)
});

app.get('/api/gallery-list', async (req, res) => {
    const { uid } = req.query;
    const data = await collectservice.getGalleryCodeByUID(uid);
    res.json(data)
});

app.delete('/api/nickname-list', async (req, res) => {
    const { galleryid } = req.query;
    await collectservice.deleteGarbage(galleryid);
    console.log('작업 완료.');
    res.json({ status: 'success' });
});


module.exports = app;