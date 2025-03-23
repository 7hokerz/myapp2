const axios = require('axios');
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
            { ip: '103.237.144.232', port: 1311, country: 'VN', type: 'http' },
            { ip: '18.223.25.15', port: 80, country: 'US', type: 'https' },
            { ip: '203.115.101.51', port: 82, country: 'IN', type: 'http' },
            { ip: '184.169.154.119', port: 80, country: 'US', type: 'https' },
            { ip: '13.56.192.187', port: 80, country: 'US', type: 'https' },
        ];
    }

    async fetcher(url, timeout = 1500) {
        for (let attempt = 0; attempt < 6; attempt++) {
            const proxy = this.getRandomProxy();
            const proxyUrl = `http://${proxy.ip}:${proxy.port}`;
            const proxyAgent = new HttpsProxyAgent(proxyUrl);

            const controller = new AbortController();
            const { signal } = controller;
            const timeoutid = setTimeout(() => controller.abort(), timeout);
            
            try {
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
                return response;
            } catch (error) {
                if (error.name !== 'AbortError') console.error(error);
                if(attempt < 6) {
                    if(attempt >= 3) {
                        if(error.response) console.log(`상태 코드: ${error.response.status}`);
                        console.log(`${attempt + 1}번째 시도 실패. 다시 시도합니다.`);
                    }
                    continue;
                }
                throw error;
            } finally {
                if (proxyAgent) {
                    proxyAgent.destroy();
                }
                clearTimeout(timeoutid);
            }
        }
        throw new Error('프록시 서버에 문제가 있습니다.');
    }

    async axiosFetcher(url, timeout = 1500) {
        const axiosInstance = axios.create({
            timeout,
            headers: {
                'Accept': 'text/html',
                'Accept-Encoding': 'br, gzip, deflate',
                'Referer': 'https://www.dcinside.com/',
                'Connection': 'close',
                'Cache-Control': 'no-cache',
            }
        });

        axiosInstance.interceptors.request.use((config) => {
            const proxy = this.getRandomProxy();
            const proxyUrl = `http://${proxy.ip}:${proxy.port}`;
            config.agent = new HttpsProxyAgent(proxyUrl);
            config.headers['User-Agent'] = this.getRandomUA();
            config.headers['X-Forwarded-For'] = proxy.ip;
            config.headers['Forwarded'] = `for=${proxy.ip}`;
            return config;
        });

        axiosInstance.interceptors.response.use((response) => { // 성공 응답 후 프록시 에이전트 종료
                if (response.config.agent && typeof response.config.agent.destroy === 'function') {
                    response.config.agent.destroy();
                }
                return response;
            }, (error) => { // 에러 응답 시에도 프록시 에이전트 종료
                if (error.config && error.config.agent && typeof error.config.agent.destroy === 'function') {
                    error.config.agent.destroy();
                }
                return Promise.reject(error);
            }
        );

        for (let attempt = 0; attempt <= 5; attempt++) {
            try {
                const response = await axiosInstance.get(url);
                return response;
            } catch (error) {
                if (error.code !== 'ECONNABORTED') console.log(error.message);
                if (attempt >= 3) {
                    if(error.response) console.log(`상태 코드: ${error.response.status}`);
                    console.log(`${attempt + 1}번째 시도 실패. 다시 시도합니다.`);
                }
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


/*
        
*/