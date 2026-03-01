const winston = require('winston');
const path = require('path');

const logLevel = process.env.LOG_LEVEL || 'info';
const logFile = process.env.LOG_FILE || 'logs/app.log';

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = path.dirname(logFile);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Create logger
const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: { service: 'velo-custom-ui-backend' },
    transports: [
        // Write all logs to file
        new winston.transports.File({ 
            filename: logFile,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Write errors to separate file
        new winston.transports.File({ 
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
        }),
    ],
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

// Create a stream for Morgan HTTP logging
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    },
};

module.exports = logger;
