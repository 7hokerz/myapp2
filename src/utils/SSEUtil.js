
module.exports = class SSEController {

    init(request, response) {
        this.response = response;
        this.request = request;
    }

    SSEInitHeader() {
        this.response.setHeader('Content-Type', 'text/event-stream');
        this.response.setHeader('Cache-Control', 'no-cache');
        this.response.setHeader('Connection', 'keep-alive');
    }

    SSESendEvent(event, data) {
        this.response.write(`event: ${event}\n`);
        this.response.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    SSEendEvent() {
        this.response.end();
    }
}