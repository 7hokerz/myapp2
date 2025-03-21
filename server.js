const app = require('./src/app');
const port = 3000;

const server = app.listen(port, () => {
    console.log('server is running');
});

const gracefulShutdown = () => {
    console.log('Starting graceful shutdown...');
    if (server) {
        server.close(() => {
            try {
                console.log('graceful shutdown is successful!');
                process.exit(0);
            } catch (error) {
                console.error('Error during shutdown:', error);
                process.exit(1);
            }
        });
    } else {
        console.log('Server is not running.');
        process.exit(0);
    }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);