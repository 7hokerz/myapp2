const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

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
        this.httpproxyList = [
            { ip: '157.180.40.36', port:9720 },
            { ip: '45.140.143.77', port:18080 },
            { ip: '184.168.124.233', port:5402 },
        ];
        this.socksproxyList = [
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
    }

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

    async axiosFetcher(url, timeout = 5000) {
        for (let attempt = 1; attempt <= 5; attempt++) {
            //const httpsProxy = this.getRandomHttpProxy();
            //const HttpsProxyUrl = `http://${httpsProxy.ip}:${httpsProxy.port}`;
            //const httpsProxyAgent = new HttpsProxyAgent(HttpsProxyUrl);

            const socksProxy = this.getRandomSocksProxy();
            const SocksProxyUrl = `socks://${socksProxy.ip}:${socksProxy.port}`;
            const socksProxyAgent = new SocksProxyAgent(SocksProxyUrl);
            
            const axiosInstance = axios.create({
                httpAgent: socksProxyAgent,
                //httpsAgent: socksProxyAgent,
                headers: {
                    'User-Agent': this.getRandomUA(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'ko-KR,ko;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Cookie': 'used_darkmode=1; darkmode=1; alarm_popup=1; ck_img_view_cnt=4;',
                    'Host': 'gall.dcinside.com',
                    'Pragma': 'no-cache',
                    'Referer': 'https://www.dcinside.com/',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'origin',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                    'sec-ch-ua': '"Chromium";v="134", " Not A;Brand";v="24", "Google Chrome";v="134"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': 'Windows',
                    'X-Forwarded-For': socksProxy.ip,
                    'Forwarded': `for=${socksProxy.ip}`,
                },
                proxy: false,
                timeout,
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

            try {
                const response = await axiosInstance.get(url); //'https://api.ipify.org'
                return response;
            } catch (error) {
                if(!(error.code === 'ECONNABORTED' || error.code === 'ERR_BAD_RESPONSE')) console.log(error.message, socksProxy.ip);
                await new Promise(resolve => setTimeout((resolve), 20 * 2 ** attempt)); // 지수 백오프
            }
        }
        throw new Error('프록시 서버에 문제가 있습니다.');
    }

    getRandomUA() {
        return this.userAgentPool[Math.floor(Math.random() * this.userAgentPool.length)];
    }

    getRandomHttpProxy() {
        return this.httpproxyList[Math.floor(Math.random() * this.httpproxyList.length)];
    }

    getRandomSocksProxy() {
        return this.socksproxyList[Math.floor(Math.random() * this.socksproxyList.length)];
    }
}


/*
        
*/