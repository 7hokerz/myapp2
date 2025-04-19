const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

const userAgentPool = [
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

const userAgentPoolMob = [
    'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.87 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.87 Mobile Safari/537.36'
];

const socksproxyList = [
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

module.exports = class fetchUtil {
    testHeaders = {
        'Accept': 'text/html',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    };
    testUrl = 'https://api.ipify.org';

    constructor (isProxy) {
        this.isProxy = isProxy;
    }

    async axiosFetcher(url, method = 'GET', headers = {}, isMoblie = 0, data = null, timeout = 7500, baseBackoff = 100) {
        let socksProxyAgent = null;

        for (let attempt = 1; attempt <= 5; attempt++) {
            headers['User-Agent'] = this.getRandomUA(isMoblie);
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
                validateStatus: function (status) {
                    return ((status >= 200 && status < 300) || status === 403 || status === 404);
                }
            });

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
                if(!(error.code === 'ECONNABORTED' || error.code === 'ERR_BAD_RESPONSE')) console.log(error.code, error.message, url);
                await new Promise(resolve => setTimeout((resolve), baseBackoff * 2 ** attempt)); // 지수 백오프
            }
        }
        throw new Error('프록시 서버에 문제가 있습니다.');
    }

    getRandomSocksProxy() {
        const socksProxy = socksproxyList[Math.floor(Math.random() * socksproxyList.length)];
        const SocksProxyUrl = `socks://${socksProxy.ip}:${socksProxy.port}`;
        const socksProxyAgent = new SocksProxyAgent(SocksProxyUrl); // 특정 요소 설정으로 socket hang up 문제를 해결할 방안일지??
        
        return socksProxyAgent;
    }

    getRandomUA(isMobile) {
        if(isMobile) return userAgentPoolMob[Math.floor(Math.random() * userAgentPoolMob.length)];
        else return userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
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