const express = require('express');
const app = express();
const configExpress = require('./config/express');

configExpress(app);

const identityController = require('./controller/identityController');
const filenameController = require('./controller/filenameController');

const identitycontroller = new identityController();
const filenamecontroller = new filenameController();

app.get('/', (req, res) => {
    const { mode, type } = req.query;
    res.render('index', {
        mode: mode || 'identity',
        type: (mode === 'identity' && type) ? type : 'search_name',
    });
});

app.get('/api/user/stop', (req, res) => {
    identitycontroller.stopSearch();
    filenamecontroller.stopSearch();
    res.json({ message: '검색 중지 요청 완료.' });
});

app.get('/api/user/collect', async (req, res) => {
    try {
        await identitycontroller.getNicknameFromSite(req, res);
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
    const { mode } = req.body;
    switch (mode) {
        case 'identity':
            await identitycontroller.init(req, res);
            break;
        case 'filename':
            await filenamecontroller.init(req, res);
            break;
        default:
            break;
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
    res.json({ status: 'success' });
});


module.exports = app;