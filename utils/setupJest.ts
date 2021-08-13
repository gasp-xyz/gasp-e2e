import BN from "bn.js";

export {};
declare global {
  namespace jest {
    interface Matchers<R> {
        bnEqual(expected:BN): R;
        bnEqual(expected:BN, message : string): R;
        collectionBnEqual(expected:BN[]): R;
        collectionBnEqual(expected:BN[], message : string): R;
    }
  }
}

expect.extend({
    bnEqual(expected : BN, received : BN, message = '') {
      const pass = expected.eq(received);
      const [expectedMsg, receivedMsg ] = expected.bitLength() < 53 &&  received.bitLength() < 53 ? [ expected.toNumber(), received.toNumber() ] : [ expected.toString(), received.toString() ];

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
    collectionBnEqual(expected : BN[], received : BN[], message = '') {
      const pass = expected.length === received.length && expected.every( (value, index) => value.eq(received[index])  );

      const [expectedMsg, receivedMsg ] = [ expected.toString(), received.toString() ];

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