const axios = require('axios');
const { Agent } = require('https');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { userAgentPool, userAgentPoolMob, socksproxyList, httpsproxyList } = require('../config/apiHeader');

testUrl = 'https://api.ipify.org';

let tlsCert = null; // 인증서 확인용

module.exports = class fetchUtil {
    constructor(isProxy) {
        this.isProxy = isProxy;
        this.api = axios.create({
            //httpsAgent: new Agent().on('keylog', (line, tlsSocket) => tlsCert = tlsSocket.getPeerCertificate(false)),
            keepAlive: true,
            validateStatus: function (status) {
                return ((status >= 200 && status < 300) || status === 403 || status === 404);
            },
        });
    }

    async axiosFetcher(url, method = 'GET', headers = {}, isMoblie = 0, data = null, timeout = 20000, baseBackoff = 100) { 
        for (let attempt = 0; attempt < 5; attempt++) {
            const attemptConfig = {
                url,
                method,
                headers: {
                    ...headers,
                    'User-Agent': this._getRandomUA(isMoblie)
                },
                timeout,
            }

            if(this.isProxy) {
                const proxyAgent = this._getRandomSocksProxy();
                attemptConfig.httpAgent = proxyAgent;
                attemptConfig.httpsAgent = proxyAgent;
                attemptConfig.headers['X-Forwarded-For'] = proxyAgent.proxy.host;
                attemptConfig.headers['Forwarded'] = `for=${proxyAgent.proxy.host}`;
            }

            try {
                if (method.toUpperCase() === 'GET') {
                    if (data) attemptConfig.params = data;
                } else {
                    if (data) attemptConfig.data = data;
                }
                const response = await this.api(attemptConfig);
                return response;
            } catch (error) {
                if(axios.isAxiosError(error)) {
                    if(attempt > -1) {
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
        const SocksProxy = socksproxyList[Math.floor(Math.random() * socksproxyList.length)];
        const SocksProxyUrl = `socks://${SocksProxy.ip}:${SocksProxy.port}`;
        const socksProxyAgent = new SocksProxyAgent(
            SocksProxyUrl, {
                //rejectUnauthorized: false,
            }
        )//.on('keylog', (line, tlsSocket) => tlsCert = tlsSocket.getPeerCertificate(false));
        return socksProxyAgent;
    }

    _getRandomHttpsProxy() {
        const HttpsProxy = httpsproxyList[Math.floor(Math.random() * httpsproxyList.length)];
        const HttpsProxyUrl = `https://${HttpsProxy.ip}:${HttpsProxy.port}`;
        const httpsProxyAgent = new HttpsProxyAgent(
            HttpsProxyUrl, {
                //rejectUnauthorized: false,
            }
        )//.on('keylog', (line, tlsSocket) => tlsCert = tlsSocket.getPeerCertificate(false));
        return httpsProxyAgent;
    }

    _getRandomUA(isMobile) {
        if(isMobile) return userAgentPoolMob[Math.floor(Math.random() * userAgentPoolMob.length)];
        else return userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
    }
}


/*

*/