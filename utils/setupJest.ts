/* eslint-disable no-console */
import { BN } from "@polkadot/util";
import { removeSudoDb } from "./lock";
import "jest-extended/all";
import { jest } from "@jest/globals";
beforeAll(async () => {
  //  if (
  //    process.argv.includes("--runInBand") ||
  //    process.env.JEST_GROUP_SEQUENTIAL
  //  ) {
  //    console.warn("BeforeAll::setting up gasless...");
  //    await setupGasLess(true);
  //    console.warn("BeforeAll...Done");
  //  }
  await removeSudoDb();
  //   const child = await execFile(
  //     `node`,
  //     [`${__dirname}/NonceManager.js`],
  //     (error: any, stdout: any) => {
  //       if (error) {
  //         testLog.getLog().error(error);
  //         throw error;
  //       }
  //       // eslint-disable-next-line no-console
  //       testLog.getLog().info(stdout);
  //     }
  //   );
});
declare global {
  namespace jest {
    interface Matchers<R> {
      bnEqual(expected: BN): R;
      bnEqual(expected: BN, message: string): R;
      bnLte(expected: BN): R;
      bnLte(expected: BN, message: string): R;
      bnLt(expected: BN): R;
      bnLt(expected: BN, message: string): R;
      bnGte(expected: BN): R;
      bnGte(expected: BN, message: string): R;
      bnGt(expected: BN): R;
      bnGt(expected: BN, message: string): R;
      collectionBnEqual(expected: BN[]): R;
      collectionBnEqual(expected: BN[], message: string): R;
    }
  }
}

expect.extend({
  bnEqual(expected: BN, received: BN, message = "") {
    const pass = expected.eq(received);
    const [expectedMsg, receivedMsg] =
      expected.bitLength() < 53 && received.bitLength() < 53
        ? [expected.toNumber(), received.toNumber()]
        : [expected.toString(), received.toString()];

    if (pass) {
      return {
        message: () =>
          `Expected: ${expectedMsg} \n  Actual: ${receivedMsg} \n ${message}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected: ${expectedMsg} \n  Actual: ${receivedMsg} \n ${message}`,
        pass: false,
      };
    }
  },
  bnLte(expected: BN, received: BN, message = "") {
    const pass = expected.lte(received);
    const [expectedMsg, receivedMsg] =
      expected.bitLength() < 53 && received.bitLength() < 53
        ? [expected.toNumber(), received.toNumber()]
        : [expected.toString(), received.toString()];

    if (pass) {
      return {
        message: () =>
          `Expected: ${expectedMsg} \n  Actual: ${receivedMsg} \n ${message}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected: ${expectedMsg} \n  Actual: ${receivedMsg} \n ${message}`,
        pass: false,
      };
    }
  },
  bnLt(expected: BN, received: BN, message = "") {
    const pass = expected.lt(received);
    const [expectedMsg, receivedMsg] =
      expected.bitLength() < 53 && received.bitLength() < 53
        ? [expected.toNumber(), received.toNumber()]
        : [expected.toString(), received.toString()];

    if (pass) {
      return {
        message: () =>
          `Expected: ${expectedMsg} \n lt Actual: ${receivedMsg} \n ${message}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected: ${expectedMsg} \n lt Actual: ${receivedMsg} \n ${message}`,
        pass: false,
      };
    }
  },
  collectionBnEqual(expected: BN[], received: BN[], message = "") {
    const pass =
      expected.length === received.length &&
      expected.every((value, index) => value.eq(received[index]));

    const [expectedMsg, receivedMsg] = [
      expected.toString(),
      received.toString(),
    ];

    if (pass) {
      return {
        message: () =>
          `Expected: [ ${expectedMsg} ] \n  Actual: [ ${receivedMsg} ] \n ${message}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected: [ ${expectedMsg} ] \n  Actual: [ ${receivedMsg} ] \n ${message}`,
        pass: false,
      };
    }
  },
  bnGte(expected: BN, received: BN, message = "") {
    const pass = expected.gte(received);
    const [expectedMsg, receivedMsg] =
      expected.bitLength() < 53 && received.bitLength() < 53
        ? [expected.toNumber(), received.toNumber()]
        : [expected.toString(), received.toString()];

    if (pass) {
      return {
        message: () =>
          `Expected: ${expectedMsg} \n  Actual: ${receivedMsg} \n ${message}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected: ${expectedMsg} \n  Actual: ${receivedMsg} \n ${message}`,
        pass: false,
      };
    }
  },
  bnGt(expected: BN, received: BN, message = "") {
    const pass = expected.gt(received);
    const [expectedMsg, receivedMsg] =
      expected.bitLength() < 53 && received.bitLength() < 53
        ? [expected.toNumber(), received.toNumber()]
        : [expected.toString(), received.toString()];

    if (pass) {
      return {
        message: () =>
          `Expected: ${expectedMsg} \n lt Actual: ${receivedMsg} \n ${message}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected: ${expectedMsg} \n lt Actual: ${receivedMsg} \n ${message}`,
        pass: false,
      };
    }
  },
});

export const registerScreenshotReporter = () => {
  /**
   * jasmine reporter does not support async.
   * So we store the screenshot promise and wait for it before each test
   */
  const screenshotPromise = Promise.resolve();
  beforeEach(() => screenshotPromise);
  afterAll(() => screenshotPromise);
};
registerScreenshotReporter();

global.console = {
  ...console,
  // uncomment to ignore a specific log level
  log: jest.fn(),
  debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
