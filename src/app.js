const express = require('express');
const app = express();
const configExpress = require('./config/express');
configExpress(app);

const jobManager = require('./utils/jobUtil');
const FetchUtil = require('./utils/fetchUtil');
const DataParser = require('../parsers/dataParser');

const CollectDAO = require('./repositories/collectDAO');

const IdentityService = require('./services/identityServiceTest');
const CheckService = require('./services/checkService');
const FilenameService = require('./services/filenameService');

const IdentityController = require('./controller/identityController');
const FilenameController = require('./controller/filenameController');

const identityController = new IdentityController(IdentityService, CheckService, new CollectDAO(), FetchUtil, new DataParser());
const filenameController = new FilenameController(FilenameService, FetchUtil);


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

app.get('/api/stop/:mode', (req, res) => {
    const { mode } = req.params;
    switch (mode) {
        case 'identity':
            identityController.stopSearch(req, res);
            break;
        case 'filename':
            filenameController.stopSearch(req, res);
            break;
        case 'delete-post':
            deleteMyPostsController.stopSearch(req, res);
            break;
        default:
            break;
    }
    res.status(200).json({ message: '검색 중지 요청 완료.' });
});

app.post('/api/input', async (req, res) => { 
    const jobId = jobManager.addJob(req.body); 
    res.status(202).json({ jobId: jobId, status: 'pending' });
});

app.get('/api/user/id', async (req, res) => {
    try {
        await identityController.getNicknameFromSite(req, res);
    } catch (error) {
        console.log(error);
    }
});

app.put('/api/user/id', async (req, res) => {
    await identityController.chkUIDisValid(req, res);
    res.json({ status: 'success' });
});

app.put('/api/user/post-comment', async (req, res) => {
    await identityController.chkPostExists(req, res);
    res.json({ status: 'success' });
});

app.get('/api/post/filename', async (req, res) => {
    try {
        await filenameController.getFilenameFromSite(req, res);
    } catch (error) {
        console.log(error);
    }
});

app.get('/api/my-post-comment', async (req, res) => {
    try {
        await deleteMyPostscontroller.deletePostsOrComments(req, res);
    } catch (error) {
        console.log(error);
    }
});

module.exports = app;