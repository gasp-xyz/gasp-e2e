/* eslint-disable no-loop-func */
import { getApi } from "./api";
import { testLog } from "./Logger";
import { api, Extrinsic } from "./setup";
import { User } from "./User";
import { BN } from "@polkadot/util";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "./txHandler";

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

// @ts-ignore
export const logEvent = (phase, data, method, section) => {
  testLog
    .getLog()
    .info(
      phase.toString() + " : " + section + "." + method + " " + data.toString()
    );
};

export const signSendFinalized = async (
  tx: Extrinsic,
  user: User,
  nonce: BN | undefined = undefined
): Promise<MangataGenericEvent[]> => {
  return signTx(api, tx, user.keyRingPair, {
    nonce: nonce,
    statusCallback: ({ events = [], status }) => {
      testLog.getLog().info(status);
      events.forEach(({ phase, event: { data, method, section } }) => {
        logEvent(phase, data, method, section);
      });
    },
  })
    .catch((reason) => {
      testLog.getLog().error(reason.data || reason);
      throw reason;
    })
    .then((result) => {
      const event = getEventResultFromMangataTx(result);
      if (event.state === ExtrinsicResult.ExtrinsicFailed) {
        throw event;
      }
      return result;
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
