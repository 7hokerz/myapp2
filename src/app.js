const express = require('express');
const app = express();
const configExpress = require('./config/express');

configExpress(app);

const identityController = require('./controller/identityController');
const filenameController = require('./controller/filenameController');
const deleteMyPostsController = require('./controller/deleteMyPostsController');
const jobManager = require('./utils/jobUtil');

const identitycontroller = new identityController();
const filenamecontroller = new filenameController();
const deleteMyPostscontroller = new deleteMyPostsController();

app.get('/', (req, res) => {
    const defaultModeTypeMapping = {
        'identity': 'search_all',
        'delete-post': 'posts',
    };

    let { mode, type } = req.query;

    mode = mode || 'identity';
    type = type || defaultModeTypeMapping[mode] || '';

    res.render('index', {
        mode,
        type,
    });
});

app.get('/api/user/stop', (req, res) => {
    const { mode } = req.query;
    switch (mode) {
        case 'identity':
            identitycontroller.stopSearch(req, res);
            break;
        case 'filename':
            filenamecontroller.stopSearch(req, res);
            break;
        case 'delete-post':
            deleteMyPostscontroller.stopSearch();
            break;
        default:
            break;
    }
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
    const jobId = jobManager.addJob(req.body); 
    res.status(202).json({ jobId: jobId, status: 'pending' });
});

app.delete('/api/nickname-list', async (req, res) => {
    await identitycontroller.chkUIDisValid(req, res);
    res.json({ status: 'success' });
});

app.delete('/api/post-list', async (req, res) => {
    await identitycontroller.chkPostExists(req, res);
    res.json({ status: 'success' });
});

app.get('/api/my-post-comment', async (req, res) => {
    try {
        await deleteMyPostscontroller.deletePostsOrComments(req, res);
    } catch (error) {
        console.log(error);
    }
});

module.exports = app;