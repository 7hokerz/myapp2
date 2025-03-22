const e = require('express');
const { HttpsProxyAgent } = require('https-proxy-agent');

module.exports = class fetchUtil {
    constructor () {
        this.userAgentPool = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0 Safari/537 Edg/91',
            'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537 Chrome Safari Edg',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux i686; rv:109.0) Gecko/20100101 Firefox/121.0',
        ];
        this.proxyList = [
            { ip: '193.148.16.60', port: 3128, country: 'KR', type: 'http' },
            { ip: '138.199.22.138', port: 8080, country: 'KR', type: 'http' },
            { ip: '146.70.205.140', port: 8080, country: 'KR', type: 'http' },
            { ip: '45.144.227.89', port: 3128, country: 'KR', type: 'http' },
            { ip: '45.144.227.77', port: 3128, country: 'KR', type: 'http' },
            { ip: '93.152.212.55', port: 8080, country: 'KR', type: 'http' },
            { ip: '93.152.212.60', port: 8080, country: 'KR', type: 'http' },
        ];
    }

    async fetcher(url) {
        for (let attempt = 0; attempt < 6; attempt++) {
            const proxy = this.getRandomProxy();
            const proxyUrl = `http://${proxy.ip}:${proxy.port}`;
            const proxyAgent = new HttpsProxyAgent(proxyUrl);
            try {
                const controller = new AbortController();
                const { signal } = controller;
                const timeoutid = setTimeout(() => controller.abort(), 1500);

                const response = await fetch(url, {
                    agent: proxyAgent,
                    headers: {
                        'User-Agent': this.getRandomUA(),
                        'Accept': 'text/html',
                        'Accept-Encoding': 'br, gzip, deflate',
                        'Referer': 'https://www.dcinside.com/',
                        'Connection': 'close',
                        'Cache-Control': 'no-cache',
                        'X-Forwarded-For': `${proxy.ip}`,
                        'Forwarded': `for=${proxy.ip}`,
                        'Via': '1.1 google',
                    },
                    signal,
                });
                clearTimeout(timeoutid);
                return response;
            } catch (error) {
                if (error.name !== 'AbortError') console.log(error);

                if(attempt < 6) {
                    if(attempt >= 3) {
                        if(error.response) console.log(`상태 코드: ${error.response.status}`);
                        console.log(`${attempt + 1}번째 시도 실패. 다시 시도합니다.`);
                    }
                    continue;
                }

                throw error;
            }
        }
        throw new Error('프록시 서버에 문제가 있습니다.');
    }

    getRandomUA() {
        return this.userAgentPool[Math.floor(Math.random() * this.userAgentPool.length)];
    }

    getRandomProxy() {
        return this.proxyList[Math.floor(Math.random() * this.proxyList.length)];
    }
}


