const BaseClass = require('./baseClass');

class DeletePageClass extends BaseClass {
    constructor() {
        super();
        this.init();
        this.addEvents();
    }

    init() {
        super.init();
        window.onload = () => {
            const savedValue = JSON.parse(sessionStorage.getItem('inputs'));
            if(savedValue) {
                document.getElementById('limit').value = savedValue.limit || '';
                document.getElementById('uid').value = savedValue.UID || '';
                document.getElementById('cno').value = savedValue.cno || '';
                document.getElementById('PHPSESSID').value = savedValue.PHPSESSID || '';
                document.getElementById('start-page').value = savedValue.startPage || 1;
            }
        };

        this.statusDiv1 = document.getElementById('status1');
        this.statusDiv2 = document.getElementById('status2');
        this.isProxy = document.getElementById('is-proxy');
        this.isTest = document.getElementById('is-test');
        this.searchBtn = document.getElementById('search');
        this.type = document.getElementById('delete-type');
    }

    addEvents() {
        super.addEvents();

        document.getElementById('delete-type').addEventListener('change', () => {
            const url = new URL(window.location.href);
            url.searchParams.set('mode', this.mode.value);
            url.searchParams.set('type', this.type.value);
            location.href = url.toString();
        });

        this.searchBtn.addEventListener('click', () => {
            this.deletePostsFromSite();
        })

        this.saveOptions.addEventListener('click', () => {
            this.getValueFromUsers();
            sessionStorage.setItem('inputs', JSON.stringify({
                UID: this.UID, 
                cno: this.cno,
                PHPSESSID: this.PHPSESSID,
                limit: this.limit,
                startPage: this.startPage,
            }));
        });
    }

    getValueFromUsers() {
        this.limit = document.getElementById('limit').value.trim() || 1;
        this.startPage = document.getElementById('start-page').value.trim();
        this.UID = document.getElementById('uid').value.trim() || null;
        this.cno = document.getElementById('cno').value.trim() || null;
        this.PHPSESSID = document.getElementById('PHPSESSID').value.trim() || null;
    }

    async deletePostsFromSite() {
        this.getValueFromUsers();

        if(!(this.limit < 1001 && this.startPage > 0)) {
            alert('유효한 값을 입력하세요.');
            return;
        }
        this.inputStatus(true);

        try {
            const response = await fetch(`/api/client-input/?mode=${this.mode.value}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: this.mode.value,
                    type: this.type.value,
                    UID: this.UID, 
                    cno: this.cno,
                    PHPSESSID: this.PHPSESSID,
                    limit: this.limit, 
                    startPage: this.startPage,
                })
            });

            if(!response.ok) {
                alert('서버와의 통신이 원활하지 않음.');
                return;
            }
            
            const eventSource = new EventSource(`/api/my-post-comment`);
            
            eventSource.addEventListener('status', (event) => {
                const data = JSON.parse(event.data);
                this.statusDiv1.innerHTML = `
                <p> 현재 페이지: ${data.curPage}    </p>
                <p> 남은 페이지: ${data.restPage}  </p>`;
            });

            eventSource.addEventListener('no', (event) => {
                const data = JSON.parse(event.data);
                
                this.statusDiv2.innerHTML = `
                <p> 현재 번호: ${data.no}</p>
                <p> 상태: ${data.status}</p>`;
            });

            eventSource.addEventListener('complete', (event) => {
                eventSource.close();
                
                this.statusDiv2.innerHTML += `<p> 작업 완료. </p>`;
                this.inputStatus(false);
            });

            eventSource.onerror = () => {
                eventSource.close();
                
                this.statusDiv2.innerHTML = `<p> 연결 오류 발생. </p>`;
                this.inputStatus(false);
            };
        
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DeletePageClass();
});