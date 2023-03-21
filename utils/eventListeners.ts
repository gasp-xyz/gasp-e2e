/* eslint-disable no-loop-func */
import { MangataGenericEvent } from "@mangata-finance/sdk";
import { ApiPromise } from "@polkadot/api";
import { BN } from "@polkadot/util";
import _, { reject } from "lodash";
import { getApi, getMangataInstance } from "./api";
import { logEvent, testLog } from "./Logger";
import { api, CodecOrArray } from "./setup";
import { getEventErrorfromSudo } from "./txHandler";
import { User } from "./User";
import { getEnvironmentRequiredVars } from "./utils";

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
    data: any
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
  module_index: any
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
              JSON.parse(event.data.toString())
            )
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
              JSON.parse(event.data.toString())[0].Module.error
            )
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
  method: string
): any[] {
  return result
    .filter((event) => `${event.section}.${event.method}` === method)
    .map((event) => event.event.toHuman().data);
}

export function findEventData(result: MangataGenericEvent[], method: string) {
  return filterEventData(result, method)[0];
}

export async function waitSudoOperationSuccess(
  checkingEvent: MangataGenericEvent[]
) {
  const filterBootstrapEvent = checkingEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid"
  );

  const userBootstrapCall = filterBootstrapEvent[0].event.data[0].toString();

  expect(userBootstrapCall).toContain("Ok");
}

export async function waitSudoOperationFail(
  checkingEvent: MangataGenericEvent[],
  expectedError: string
) {
  const filterBootstrapEvent = checkingEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid"
  );

  const BootstrapError = await getEventErrorfromSudo(filterBootstrapEvent);

  expect(BootstrapError.method).toContain(expectedError);
}

export const waitForEvents = async (
  api: ApiPromise,
  method: string,
  blocks: number = 10
): Promise<CodecOrArray> => {
  return new Promise(async (resolve, reject) => {
    let counter = 0;
    const unsub = await api.rpc.chain.subscribeFinalizedHeads(async (head) => {
      const events = await api.query.system.events.at(head.hash);
      counter++;
      testLog
        .getLog()
        .info(
          `→ find on ${api.runtimeChain} for '${method}' event, attempt ${counter}, head ${head.hash}`
        );

      events.forEach((e) => logEvent(api.runtimeChain, e));

      const filtered = _.filter(
        events,
        ({ event }) => `${event.section}.${event.method}` === method
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

export const waitForRewards = async (
  user: User,
  liquidityAssetId: BN,
  max: number = 20
) =>
  new Promise(async (resolve) => {
    let numblocks = max;
    const unsub = await api.rpc.chain.subscribeNewHeads(async (header) => {
      numblocks--;
      const { chainUri } = getEnvironmentRequiredVars();
      const mangata = await getMangataInstance(chainUri);
      const price = await mangata.calculateRewardsAmount(
        user.keyRingPair.address,
        liquidityAssetId.toString()
      );

      if (price.gtn(0)) {
        unsub();
        resolve({});
      } else {
        testLog
          .getLog()
          .info(
            `#${header.number}  ${user.keyRingPair.address} (LP${liquidityAssetId}) - no rewards yet`
          );
      }
      if (numblocks < 0) {
        reject(
          `Waited too long for rewards :( #${header.number}  ${user.keyRingPair.address} (LP${liquidityAssetId} `
        );
      }
    });
  });
