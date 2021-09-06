import { env } from "process";
import winston, { Logger, format } from "winston";
import { getEnvironmentRequiredVars } from "./utils";
import "setimmediate";
const { combine, timestamp, printf } = format;

export class testLog {
  private static instance: Logger;

  private static initializeLogger(): Logger {
    const myFormat = printf(({ level, message, timestamp }) => {
      return `[${timestamp}] - W[${env.JEST_WORKER_ID}] - [${level}]: ${message}`;
    });

    const files = new winston.transports.File({
      filename: "reports/testLog.log",
    });
    const logger = winston.createLogger({
      format: combine(timestamp(), myFormat),
      level: getEnvironmentRequiredVars().logLevel,
      transports: [new winston.transports.Console()],
    });
    logger.add(files);
    return logger;
  }

  // build the singleton.
  public static getLog(): Logger {
    if (!testLog.instance) {
      testLog.instance = testLog.initializeLogger();
    }
    return testLog.instance;
  }
}
