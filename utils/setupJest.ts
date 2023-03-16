/* eslint-disable no-console */
import { BN } from "@polkadot/util";
import { removeSudoDb } from "./lock";
import { Codec } from "@polkadot/types/types";
import { ApiPromise } from "@polkadot/api";
import { testLog } from "./Logger";

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

// data & event matchers
export type CodecOrArray = Codec | Codec[];

const processCodecOrArray = (codec: CodecOrArray, fn: (c: Codec) => any) =>
  Array.isArray(codec) ? codec.map(fn) : fn(codec);

const toHuman = (codec: CodecOrArray) =>
  processCodecOrArray(codec, (c) => c?.toHuman?.() ?? c);
const toJson = (codec: CodecOrArray) =>
  processCodecOrArray(codec, (c) => c?.toJSON?.() ?? c);
const toHex = (codec: CodecOrArray) =>
  processCodecOrArray(codec, (c) => c?.toHex?.() ?? c);

export const matchSnapshot = (
  codec: CodecOrArray | Promise<CodecOrArray>,
  message?: string
) => {
  return expect(Promise.resolve(codec).then(toHuman)).resolves.toMatchSnapshot(
    message
  );
};

export const expectEvent = (codec: CodecOrArray, event: any) => {
  return expect(toHuman(codec)).toEqual(
    expect.arrayContaining([expect.objectContaining(event)])
  );
};

export const expectHuman = (codec: CodecOrArray) => {
  return expect(toHuman(codec));
};

export const expectJson = (codec: CodecOrArray) => {
  return expect(toJson(codec));
};

export const expectHex = (codec: CodecOrArray) => {
  return expect(toHex(codec));
};

type EventFilter = string | { method: string; section: string };

const _matchEvents = async (
  msg: string,
  events: Promise<Codec[] | Codec>,
  ...filters: EventFilter[]
) => {
  let data = toHuman(await events).map(
    ({ event: { index: _, ...event } }: any) => event
  );
  if (filters) {
    const filtersArr = Array.isArray(filters) ? filters : [filters];
    data = data.filter((evt: any) => {
      return filtersArr.some((filter) => {
        if (typeof filter === "string") {
          return evt.section === filter;
        }
        const { section, method } = filter;
        return evt.section === section && evt.method === method;
      });
    });
  }
  return expect(data).toMatchSnapshot(msg);
};

export const matchEvents = async (
  events: Promise<Codec[] | Codec>,
  ...filters: EventFilter[]
) => {
  return _matchEvents("events", redact(events), ...filters);
};

export const matchSystemEvents = async (
  { api }: { api: ApiPromise },
  ...filters: EventFilter[]
) => {
  await _matchEvents(
    "system events",
    redact(api.query.system.events()),
    ...filters
  );
};

export const matchUmp = async ({ api }: { api: ApiPromise }) => {
  expect(await api.query.parachainSystem.upwardMessages()).toMatchSnapshot(
    "ump"
  );
};

export const redact = async (data: any | Promise<any>) => {
  const json = toHuman(await data);

  const process = (obj: any): any => {
    if (obj == null) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(process);
    }
    if (typeof obj === "number") {
      return "(redacted)";
    }
    if (typeof obj === "string") {
      if (obj.match(/^[\d,]+$/) || obj.match(/0x[0-9a-f]{64}/)) {
        return "(redacted)";
      }
      return obj;
    }
    if (typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, process(v)])
      );
    }
    return obj;
  };

  return process(json);
};

export const expectExtrinsicSuccess = (events: Codec[]) => {
  expectEvent(events, {
    event: expect.objectContaining({
      method: "ExtrinsicSuccess",
      section: "system",
    }),
  });
};

// @ts-ignore
export const logEvent = (chain, event) => {
  const obj = toHuman(event).event;
  testLog
    .getLog()
    .info(
      `${chain} -> ${obj.section}.${obj.method}: ${JSON.stringify(obj.data)}`
    );
};
