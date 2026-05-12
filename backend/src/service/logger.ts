import winston from 'winston';

const logger = winston.createLogger({
  level: 'debug', // isProduction ? 'info' : 'debug',
});

logger.add(new winston.transports.Console({
  format: winston.format.simple(),
}));

if (process.env.LOG_PATH) {
  logger.add(new winston.transports.File({
    filename: process.env.LOG_PATH,
    format: winston.format.simple(),
  }));
}

const dbLogger = winston.createLogger({
  level: 'debug',
  transports: [
    new winston.transports.File({ filename: process.env.DB_LOG_PATH ?? 'logs/db.log' }),
  ],
});

export { logger, dbLogger }
