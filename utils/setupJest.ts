import { BN } from "@polkadot/util";
import { removeSudoDb } from "./lock"  ;

require("dotenv").config();
//TODO: This must be temporal, but lets retry test failures to avoid Tx issues.
jest.retryTimes(2);
beforeAll(async () => {
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

  // bump jest to 29.
  //  (jasmine as any).getEnv().addReporter({
  //    specDone: async (result: any) => {
  //      if (result.status === "failed") {
  //        try {
  //          await renameExtraLogs(result.fullName, result.status);
  //        } catch (e) {
  //          // eslint-disable-next-line no-console
  //          console.error(e);
  //          // Lets only log the error, so tno want any side effect.
  //        }
  //      }
  //    },
  //  });
};
registerScreenshotReporter();
