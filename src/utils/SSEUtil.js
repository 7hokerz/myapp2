
module.exports = class SSEController {

    static SSEInitHeader(response) {
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Connection', 'keep-alive');
    }

    static SSESendEvent(response, event, data) {
        response.write(`event: ${event}\n`);
        response.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    static SSEendEvent(response) {
        response.end();
    }
}