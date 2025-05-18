
const jobStore = new Map();

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function addJob(parameters) {
    const jobId = generateUniqueId();
    const jobData = { parameters, instance: null, status: 'pending', createdAt: new Date() };
    jobStore.set(jobId, jobData);
    //console.log(`Job added: ${jobId}, Total jobs: ${jobStore.size}`); // 로그 추가
    return jobId;
}

function getJob(jobId) {
    return jobStore.get(jobId);
}

function updateJobStatus(jobId, instance, status) {
    const jobData = jobStore.get(jobId);
    if (jobData) {
        jobData.instance = instance;
        jobData.status = status;
        jobData.updatedAt = new Date();
        //console.log(`Job status updated: ${jobId} -> ${status}`); // 로그 추가
        return true;
    }
    return false;
}

function deleteJob(jobId) {
    const deleted = jobStore.delete(jobId);
    if (deleted) {
        //console.log(`Job deleted: ${jobId}, Remaining jobs: ${jobStore.size}`); // 로그 추가
    }
    return deleted;
}

module.exports = {
    addJob,
    getJob,
    updateJobStatus,
    deleteJob
};