/* eslint-disable no-loop-func */
import { BN_ONE, BN_ZERO, MangataGenericEvent } from "@mangata-finance/sdk";
import { ApiPromise } from "@polkadot/api";
import { BN } from "@polkadot/util";
import _ from "lodash-es";
import { getApi, getMangataInstance } from "./api";
import { logEvent, testLog } from "./Logger";
import { api } from "./setup";
import { getEventErrorFromSudo } from "./txHandler";
import { User } from "./User";
import { getEnvironmentRequiredVars, getThirdPartyRewards } from "./utils";
import { Codec } from "@polkadot/types/types";

// lets create a enum for different status.
export enum ExtrinsicResult {
  ExtrinsicSuccess,
  ExtrinsicFailed,
  ExtrinsicUndefined,
}

///Class that stores the event result.
export class EventResult {
  /**
   *
   */
  constructor(
    state: ExtrinsicResult = ExtrinsicResult.ExtrinsicUndefined,
    data: any,
  ) {
    this.state = state;
    this.data = data;
  }

  state: ExtrinsicResult;
  data: String;
}

// for testing
export const getEventResult = (
  section: any,
  method: any,
  module_index: any,
) => {
  const api = getApi();

  return new Promise<EventResult>(async (resolve) => {
    const unsubscribe = (await api.query.system.events((events: any) => {
      events.forEach((record: any) => {
        const { event } = record;
        if (event.section === section && event.method === method) {
          unsubscribe();
          resolve(
            new EventResult(
              ExtrinsicResult.ExtrinsicSuccess,
              JSON.parse(event.data.toString()),
            ),
          );
        } else if (
          event.section === "system" &&
          event.method === "ExtrinsicFailed" &&
          (JSON.parse(event.data.toString())[0].Module.index = module_index)
        ) {
          unsubscribe();
          resolve(
            new EventResult(
              ExtrinsicResult.ExtrinsicFailed,
              JSON.parse(event.data.toString())[0].Module.error,
            ),
          );
        }
      });
    })) as any;
  });
};

export const waitNewBlock = () => {
  const api = getApi();
  let count = 0;
  return new Promise(async (resolve) => {
    const unsubscribe = await api.rpc.chain.subscribeNewHeads((header: any) => {
      if (++count === 2) {
        testLog.getLog().info(`Chain is at block: #${header.number}`);
        unsubscribe();
        resolve(true);
      }
    });
  });
};

export function filterEventData(
  result: MangataGenericEvent[],
  method: string,
): any[] {
  return result
    .filter((event) => `${event.section}.${event.method}` === method)
    .map((event) => event.event.toHuman().data);
}

export function findEventData(result: MangataGenericEvent[], method: string) {
  return filterEventData(result, method)[0];
}

export async function waitSudoOperationSuccess(
  checkingEvent: MangataGenericEvent[],
) {
  const filterBootstrapEvent = checkingEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid",
  );

  const userBootstrapCall = filterBootstrapEvent[0].event.data[0].toString();

  expect(userBootstrapCall).toContain("Ok");
}

export async function waitSudoOperationFail(
  checkingEvent: MangataGenericEvent[],
  expectedErrors: string[],
) {
  const filterBootstrapEvent = checkingEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid",
  );

  const BootstrapError = await getEventErrorFromSudo(filterBootstrapEvent);

  expect(expectedErrors).toContain(BootstrapError.data);
}

export const waitForEvents = async (
  api: ApiPromise,
  method: string,
  blocks: number = 10,
  withData: string = "",
): Promise<CodecOrArray> => {
  return new Promise(async (resolve, reject) => {
    let counter = 0;
    const unsub = await api.rpc.chain.subscribeFinalizedHeads(async (head) => {
      const events = await (await api.at(head.hash)).query.system.events();
      counter++;
      testLog
        .getLog()
        .info(
          `→ find on ${api.runtimeChain} for '${method}' event, attempt ${counter}, head ${head.hash}`,
        );

      events.forEach((e) => logEvent(api.runtimeChain, e));

      const filtered = _.filter(
        events,
        ({ event }) =>
          `${event.section}.${event.method}` === method &&
          (withData.length > 0
            ? JSON.stringify(event.data.toHuman()).includes(withData)
            : true),
      );
      if (filtered.length > 0) {
        resolve(filtered);
        unsub();
      }
      if (counter === blocks) {
        reject(`method ${method} not found within blocks limit`);
      }
    });
  });
};
export const waitForSessionChange = async (): Promise<number> => {
  const currSession = await api.query.session.currentIndex();
  return new Promise(async (resolve) => {
    const unsub = await api.rpc.chain.subscribeNewHeads(async () => {
      const sessionNo = await api.query.session.currentIndex();
      if (sessionNo.toNumber() > currSession.toNumber()) {
        resolve(sessionNo.toNumber());
        unsub();
      }
    });
  });
};
export const waitForRewards = async (
  user: User,
  liquidityAssetId: BN,
  max: number = 20,
  thirdPartyRewardToken: BN = BN_ONE.neg(),
) =>
  new Promise(async (resolve) => {
    let numblocks = max;
    let rewardAmount = BN_ZERO;
    const unsub = await api.rpc.chain.subscribeNewHeads(async (header) => {
      numblocks--;
      const { chainUri } = getEnvironmentRequiredVars();
      const mangata = await getMangataInstance(chainUri);
      if (thirdPartyRewardToken.gten(0)) {
        rewardAmount = await getThirdPartyRewards(
          user.keyRingPair.address,
          liquidityAssetId,
          thirdPartyRewardToken,
        );
      } else {
        rewardAmount = await mangata.rpc.calculateRewardsAmount({
          address: user.keyRingPair.address,
          liquidityTokenId: liquidityAssetId.toString(),
        });
      }
      if (rewardAmount.gtn(0)) {
        unsub();
        resolve({});
      } else {
        testLog
          .getLog()
          .info(
            `#${header.number}  ${user.keyRingPair.address} (LP${liquidityAssetId}) - no rewards yet`,
          );
      }
      if (numblocks < 0) {
        unsub();
        testLog
          .getLog()
          .error(
            `Waited too long for rewards :( #${header.number}  ${user.keyRingPair.address} (LP${liquidityAssetId} `,
          );
        resolve(false);
      }
    });
  });

type CodecOrArray = Codec | Codec[];

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
  message?: string,
) => {
  return expect(Promise.resolve(codec).then(toHuman)).resolves.toMatchSnapshot(
    message,
  );
};

export const expectEvent = (codec: CodecOrArray, event: any) => {
  return expect(toHuman(codec)).toEqual(
    expect.arrayContaining([expect.objectContaining(event)]),
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
    ({ event: { index: _, ...event } }: any) => event,
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
  events: Promise<Codec[] | Codec> | Codec[],
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
    ...filters,
  );
};

export const matchUmp = async ({ api }: { api: ApiPromise }) => {
  expect(await api.query.parachainSystem.upwardMessages()).toMatchSnapshot(
    "ump",
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
        Object.entries(obj).map(([k, v]) => [k, process(v)]),
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
export const expectMGAExtrinsicSuDidSuccess = (
  events: MangataGenericEvent[],
) => {
  const anyError = events
    .filter((x) => x.method === "SudoAsDone" && x.section === "sudo")
    .some((x) => JSON.parse(JSON.stringify(x.eventData[0].data)).err);
  if (!anyError) {
    testLog.getLog().warn(JSON.stringify(events));
  }
  expect(anyError).toBeFalsy();
  return events!;
};
export const expectMGAExtrinsicSuDidFailed = (
  events: MangataGenericEvent[],
) => {
  const sudoErrorEvent = events.find(
    (x) =>
      x.method === "SudoAsDone" &&
      x.section === "sudo" &&
      JSON.parse(JSON.stringify(x.eventData[0].data)).err !== undefined,
  );
  expect(sudoErrorEvent).not.toBeNull();
  return sudoErrorEvent!;
};
