
module.exports = class BaseClass {
    constructor() {

    }

    init() {
        this.stopBtn = document.getElementById('stop');
        this.mode = document.getElementById('mode');
        this.saveOptions = document.getElementById('save-options');
        this.inputStatus(false);
    }

    addEvents() {
        this.mode.addEventListener('change', () => {
            location.href = `/?mode=${this.mode.value}`;
        });

        this.stopBtn.addEventListener('click', () => {
            this.stopSearch();
        })
    }

    inputStatus(v) {
        this.searchBtn.disabled = v;
        this.stopBtn.disabled = !v;
    }

    getValueFromUsers() {

    }

    async stopSearch() {
        try {
            await fetch(`/api/user/stop?mode=${this.mode.value}`); // 서버에 중지 요청
        } catch (error) {
            console.error('Error:', error);
        }
    }
}