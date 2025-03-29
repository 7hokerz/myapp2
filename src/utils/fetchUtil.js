const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

module.exports = class fetchUtil {
    userAgentPool = [
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
    socksproxyList = [
        // usa
        { ip: '184.181.217.220', port:4145 },
        { ip: '184.178.172.3', port:4145 },
        { ip: '174.75.211.222', port:4145 },
        { ip: '192.111.130.2', port:4145 },
        { ip: '72.214.108.67', port:4145 },
        { ip: '206.220.175.2', port:4145 },

        { ip: '98.175.31.222', port:4145 },
        { ip: '192.252.216.81', port:4145 },
        { ip: '72.195.114.169', port:4145 },
        { ip: '104.200.152.30', port:4145 },
        { ip: '107.152.98.5', port:4145 },
        { ip: '216.68.128.121', port:4145 },
        { ip: '72.195.34.42', port:4145 },
        { ip: '184.181.217.206', port:4145 },
        { ip: '199.116.114.11', port:4145 },
        { ip: '184.170.245.148', port:4145 },
        { ip: '184.170.248.5', port:4145 },

        // japan
        { ip: '38.48.252.4', port:9553 },
        { ip: '38.48.252.16', port:9553 },
        { ip: '38.48.242.86', port:9553 },
        { ip: '38.48.251.91', port:9553 },
        { ip: '38.48.224.84', port:9553 },
    ];
    testHeaders = {
        'Accept': 'text/html',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };
    testUrl = 'https://api.ipify.org';

    constructor (isProxy) {
        this.isProxy = isProxy;
    }

    async axiosFetcher(url, method = 'GET', headers = {}, data = null, timeout = 5000, baseBackoff = 20) {
        let socksProxyAgent = null;

        for (let attempt = 1; attempt <= 5; attempt++) {
            headers['User-Agent'] = this.getRandomUA();
            if(this.isProxy) {
                socksProxyAgent = this.getRandomSocksProxy();
                headers['X-Forwarded-For'] = socksProxyAgent.proxy.host;
                headers['Forwarded'] = `for=${socksProxyAgent.proxy.host}`;
            }

            const axiosInstance = axios.create({
                httpAgent: socksProxyAgent,
                headers: headers,
                proxy: false,
                timeout,
            });
            
            axiosInstance.interceptors.response.use((response) => { // 성공 응답 후 프록시 에이전트 종료
                if (response.config.httpAgent && typeof response.config.httpAgent.destroy === 'function') {
                    response.config.httpAgent.destroy();
                }
                return response;
                }, (error) => { // 에러 응답 시에도 프록시 에이전트 종료
                    if (error.config && error.config.httpAgent && typeof error.config.httpAgent.destroy === 'function') {
                        error.config.httpAgent.destroy();
                    }
                    return Promise.reject(error);
                }
            );

            try {
                const requestConfig = {
                    method,
                    url
                };
                
                if (method.toUpperCase() === 'GET') {
                    if (data) requestConfig.params = data;
                } else {
                    if (data) requestConfig.data = data;
                }

                const response = await axiosInstance(requestConfig);
                return response;
            } catch (error) {
                if(!(error.code === 'ECONNABORTED' || error.code === 'ERR_BAD_RESPONSE')) console.log(error.message);
                await new Promise(resolve => setTimeout((resolve), baseBackoff * 2 ** attempt)); // 지수 백오프
            }
        }
        throw new Error('프록시 서버에 문제가 있습니다.');
    }

    getRandomSocksProxy() {
        const socksProxy = this.socksproxyList[Math.floor(Math.random() * this.socksproxyList.length)];
        const SocksProxyUrl = `socks://${socksProxy.ip}:${socksProxy.port}`;
        const socksProxyAgent = new SocksProxyAgent(SocksProxyUrl);
        
        return socksProxyAgent;
    }

    getRandomUA() {
        return this.userAgentPool[Math.floor(Math.random() * this.userAgentPool.length)];
    }
}


/*
         async fetcher(url, timeout = 2000) {
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
*/