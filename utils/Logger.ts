import { env } from "process";
import "setimmediate";
import winston, { format, Logger } from "winston";
import { toHuman } from "./setup";
import { getEnvironmentRequiredVars } from "./utils";
const { combine, timestamp, printf } = format;

export class testLog {
  private static instance: Logger;

  private static initializeLogger(): Logger {
    const id = env.JEST_WORKER_ID || env.VITEST_WORKER_ID;
    const myFormat = printf(({ level, message, timestamp }) => {
      return `[${timestamp}] - W[${id}] - [${level}]: ${message}`;
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

//@ts-ignore
export const logEvent = (chain, event) => {
  const obj = toHuman(event.event);
  testLog
    .getLog()
    .info(
      `${chain} -> ${obj.section}.${obj.method}: ${JSON.stringify(obj.data)}`,
    );
};
