const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');

module.exports = class filenameService {
    
    constructor(concurrency = 2) {
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
            { ip: '104.236.34.127', port: 3128, country: 'KR', type: 'http' },
            { ip: '138.197.222.35', port: 8080, country: 'KR', type: 'http' },
            { ip: '183.111.165.166', port: 8080, country: 'KR', type: 'http' },
            { ip: '121.167.40.226', port: 3128, country: 'KR', type: 'http' },
            { ip: '175.196.45.10', port: 80, country: 'KR', type: 'http' }
        ];
        this.queue1 = [];
        this.queue2 = [];
        this.concurrency = concurrency;
        this.running = 0;
        this.postNoSet = new Set();
    }

    async add1(url) {
        return new Promise((resolve, reject) => {
            this.queue1.push({ url, resolve, reject });
            this.processCollectNo();
        })
    }

    async add2(url, no) {
        return new Promise((resolve, reject) => {
            this.queue2.push({ url, no, resolve, reject });
            this.processCheckFileName();
        })
    }

    async processCollectNo() {
        if (this.running >= this.concurrency || this.queue1.length === 0) return;

        const { url, resolve, reject } = this.queue1.shift();
        this.running++;

        try {
            const response = await this.fetcher(url);
            const html = await response.text();

            const $ = cheerio.load(html);
                    
            $('.gall_list .ub-content.us-post').each((index, element) => {
                const type = $(element).attr('data-type');
    
                if(type === 'icon_pic') {
                    const no = $(element).attr('data-no');
                    this.postNoSet.add(no);
                }
            });

            resolve();
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            this.processCollectNo();
        }
    }

    async processCheckFileName() {
        if (this.running >= this.concurrency || this.queue2.length === 0) return;

        const { url, no, resolve, reject } = this.queue2.shift();
        this.running++;

        try {
            const response = await this.fetcher(url);
            const html = await response.text();

            const arr = [
                'savefancam', 
                'grsgills', 
                'girl',
                'idol',
                'gaon',
                'kpop',
                'ball',
            ];
            const $ = cheerio.load(html);
            
            const filename = $('.appending_file_box .appending_file').find('li').find('a').text().trim();

            if(arr.some((e) => filename.includes(e))) {
                console.log(filename + " " + no);
            }

            resolve();
        } catch (error) {
            console.log(error);
        } finally {
            this.running--;
            this.processCheckFileName();
        }
    }

    async fetcher(url) {
        let count = 3;
        
        while(count > 0) {
            const proxy = this.getRandomProxy();
            const proxyUrl = `http://${proxy.ip}:${proxy.port}`;
            const proxyAgent = new HttpsProxyAgent(proxyUrl);
            try {
                const response = await fetch(url, {
                    agent: proxyAgent,
                    headers: {
                        'User-Agent': this.getRandomUA(),
                        'Accept': 'text/html',
                        'Accept-Encoding': 'br, gzip, deflate',
                        'Referer': 'https://www.google.com/',
                        'Cache-Control': 'no-cache',
                        'X-Forwarded-For': `${proxy.ip}`,
                        'Forwarded': `for=${proxy.ip}`,
                        'Via': '1.1 google',
                    }
                });
                if (!response.ok) {
                    if(count <= 0) throw new Error(`HTTP 오류 발생: ${response.status}`);
                    count--;
                    console.log(`${count}회 남음.`);
                    continue;
                }
                const result = response.clone(); // other side closed 오류 해결 방안?
                return result;
            } catch (error) {
                console.log(error);
            }
        }
    }
    
    getRandomUA() {
        return this.userAgentPool[Math.floor(Math.random() * this.userAgentPool.length)];
    }

    getRandomProxy() {
        return this.proxyList[Math.floor(Math.random() * this.proxyList.length)];
    }
}






