const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

const userAgentPool = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    //'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
    //'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0 Safari/537 Edg/91',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    //'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537 Chrome Safari Edg',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const userAgentPoolMob = [
    'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
    //'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36 Edg/135.0.0.0'
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

    async axiosFetcher(url, method = 'GET', headers = {}, isMoblie = 0, data = null, timeout = 10000, baseBackoff = 200) {
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
                keepAlive: true,
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
                if(axios.isAxiosError(error)) {
                    if(error.code !== 'ECONNABORTED' && error.code !== 'ENOTFOUND' && attempt > 1) {
                        console.error('Error code:', error.code);
                        console.error('Error message:', error.message);
                        console.error('Error url:', url);

                        if (error.response) {
                            console.error('Status Code:', error.response.status);
                            console.error('Response Data:', error.response.data);
                            //console.error('Response Headers:', error.response.headers);
                        } else if (error.request) { 
                            console.error('Request made but no response received.');
                        } else {
                            console.error('Error setting up request.');
                        }

                        console.error('Request Config:', error.config.data);

                        console.log('attempt: ', attempt, '\n');
                    }
                } else {
                    console.error('Unexpected error', error);
                }
                

                let delay = baseBackoff * 2 ** attempt; // backoff
                await new Promise(
                    resolve => setTimeout(
                        (resolve), (delay / 2) + Math.random() * (delay / 2) // jitter
                    )
                );
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

*/