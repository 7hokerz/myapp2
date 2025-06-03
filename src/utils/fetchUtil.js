const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { userAgentPool, userAgentPoolMob, socksproxyList } = require('../config/apiHeader');

testUrl = 'https://api.ipify.org';

module.exports = class fetchUtil {
    
    constructor(isProxy) {
        this.isProxy = isProxy;
    }

    async axiosFetcher(url, method = 'GET', headers = {}, isMoblie = 0, data = null, timeout = 10000, baseBackoff = 100) {
        let socksProxyAgent = null;
         
        for (let attempt = 0; attempt < 5; attempt++) {
            headers['User-Agent'] = this._getRandomUA(isMoblie);
            if(this.isProxy) {
                socksProxyAgent = this._getRandomSocksProxy();
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
                    if(error.code !== 'ECONNABORTED' && error.code !== 'ENOTFOUND' && attempt > 2) {
                        console.error('Error code:', error.code);
                        console.error('Error message:', error.message);
                        console.error('Error url:', url);

                        if (error.response) {
                            console.error('Status Code:', error.response.status);
                            if(error.response.status !== 429) console.error('Response Data:', error.response.data);
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

                await this._retryAfter(baseBackoff, attempt);
            }
        }
        throw new Error('프록시 서버에 문제가 있습니다.');
    }

    async _retryAfter(baseBackoff, attempt) { // 백오프, 지터
        let delay = baseBackoff * 2 ** attempt; // backoff
        await new Promise(
            resolve => setTimeout(
                (resolve), (delay / 2) + Math.random() * (delay / 2) // jitter
            )
        );
    }

    _getRandomSocksProxy() {
        const socksProxy = socksproxyList[Math.floor(Math.random() * socksproxyList.length)];
        const SocksProxyUrl = `socks://${socksProxy.ip}:${socksProxy.port}`;
        const socksProxyAgent = new SocksProxyAgent(SocksProxyUrl); // 특정 요소 설정으로 socket hang up 문제를 해결할 방안일지??
        
        return socksProxyAgent;
    }

    _getRandomUA(isMobile) {
        if(isMobile) return userAgentPoolMob[Math.floor(Math.random() * userAgentPoolMob.length)];
        else return userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
    }
}


/*

*/