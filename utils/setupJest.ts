import BN from "bn.js";
import {renameExtraLogs} from "./frontend/utils/Helper";
module.exports = {
  runner: "groups",
};

declare global {
  namespace jest {
    interface Matchers<R> {
      bnEqual(expected: BN): R;
      bnEqual(expected: BN, message: string): R;
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
});

export const registerScreenshotReporter = () => {
  /**
   * jasmine reporter does not support async.
   * So we store the screenshot promise and wait for it before each test
   */
  const screenshotPromise = Promise.resolve();
  beforeEach(() => screenshotPromise);
  afterAll(() => screenshotPromise);

  (jasmine as any).getEnv().addReporter({
    specDone: async (result: any) => {
      if (result.status === "failed") {
        try {
          await renameExtraLogs(result.fullName, result.status);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          // Lets only log the error, so tno want any side effect.
        }
      }
    },
  });
};
registerScreenshotReporter();
