
module.exports = class SSEController {
    constructor(){
        
    }

    SSEInitHeader(res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
    }

    SSESendEvent(res, event, data) {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    SSEendEvent(res) {
        res.end();
    }
}