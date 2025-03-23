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
            { ip: '193.148.16.60', port: 3128, country: 'KR', type: 'http' },
            { ip: '138.199.22.138', port: 8080, country: 'KR', type: 'http' },
            { ip: '146.70.205.140', port: 8080, country: 'KR', type: 'http' },
            { ip: '45.144.227.89', port: 3128, country: 'KR', type: 'http' },
            { ip: '45.144.227.77', port: 3128, country: 'KR', type: 'http' },
            { ip: '93.152.212.55', port: 8080, country: 'KR', type: 'http' },
            { ip: '93.152.212.60', port: 8080, country: 'KR', type: 'http' },
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
        /*const maxRetries = 5;
        const instance = axios.create({
            timeout,
            headers: {
                'Accept': 'text/html',
                'Accept-Encoding': 'br, gzip, deflate',
                'Referer': 'https://www.dcinside.com/',
                'Connection': 'close',
                'Cache-Control': 'no-cache',
                'Via': '1.1 google',
            },
        });

        instance.interceptors.request.use((config) => {
            const proxy = this.getRandomProxy();
            const proxyUrl = `http://${proxy.ip}:${proxy.port}`;
            const proxyAgent = new HttpsProxyAgent(proxyUrl);
            config.httpAgent = proxyAgent;
            config.httpsAgent = proxyAgent;
            config.headers['User-Agent'] = this.getRandomUA();
            config.headers['X-Forwarded-For'] = proxy.ip;
            config.headers['Forwarded'] = `for=${proxy.ip}`;
            // 응답 후 프록시 에이전트를 소멸하기 위해 config에 저장
            config.metadata = { proxyAgent };
            // 재시도 횟수 초기화
            config.__retryCount = config.__retryCount || 0;
            return config;
        });

        instance.interceptors.response.use(
            (response) => {
                if (response.config.metadata && response.config.metadata.proxyAgent) {
                    response.config.metadata.proxyAgent.destroy();
                }
                return response;
            }, (error) => {
                const config = error.config;
                if (config.metadata && config.metadata.proxyAgent) {
                    config.metadata.proxyAgent.destroy();
                }
                if (error.name !== 'ECONNABORTED') console.error(error);
                if (config.__retryCount < maxRetries) {
                    config.__retryCount++;
                    if (error.response) console.log(`상태 코드: ${error.response.status}`);
                    console.log(`${config.__retryCount + 1}번째 시도 실패. 다시 시도합니다.`);
                    return instance.request(config);
                }
                return Promise.reject(new Error('프록시 서버에 문제가 있습니다.'));
            }
        );*/

        //return instance.get(url);

        for (let attempt = 0; attempt < 6; attempt++) {
            const proxy = this.getRandomProxy();
            const proxyUrl = `http://${proxy.ip}:${proxy.port}`;
            const proxyAgent = new HttpsProxyAgent(proxyUrl);

            try {
                const response = await axios.get(url, {
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
                    timeout,
                });
                return response;
            } catch (error) {
                if (error.code !== 'ECONNABORTED') console.log(error.message);
                if (attempt >= 3) {
                    if(error.response) console.log(`상태 코드: ${error.response.status}`);
                    console.log(`${attempt + 1}번째 시도 실패. 다시 시도합니다.`);
                }
            } finally {
                proxyAgent.destroy();
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