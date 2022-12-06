/* eslint-disable no-loop-func */
import { getApi } from "./api";
import { testLog } from "./Logger";
import { api, Extrinsic } from "./setup";
import { User } from "./User";
import { BN } from "@polkadot/util";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import {
  getEventErrorfromSudo,
  getEventResultFromMangataTx,
} from "./txHandler";
import _ from "lodash";
import { ApiPromise } from "@polkadot/api";

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

// wrap SDK signTx to allow verbose logs
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

export async function waitSudoOperataionSuccess(
  checkingEvent: MangataGenericEvent[]
) {
  const filterBootstrapEvent = checkingEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid"
  );

  const userBootstrapCall = filterBootstrapEvent[0].event.data[0].toString();

  expect(userBootstrapCall).toContain("Ok");
}

export async function waitSudoOperataionFail(
  checkingEvent: MangataGenericEvent[],
  expectedError: string
) {
  const filterBootstrapEvent = checkingEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid"
  );

  const BootstrapError = await getEventErrorfromSudo(filterBootstrapEvent);

  expect(BootstrapError.method).toContain(expectedError);
}

// works most of the time, avoid using in the CI, used only in manual tests for now; or FIX please :)
export const waitForEvent = async (
  api: ApiPromise,
  method: string,
  blocks: number = 3
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    let counter = 0;
    const unsub = await api.rpc.chain.getFinalizedHead(async (head) => {
      await api.query.system.events((events) => {
        counter++;
        testLog
          .getLog()
          .info(
            `await event check for '${method}', attempt ${counter}, head ${head}`
          );
        events.forEach(({ phase, event: { data, method, section } }) => {
          logEvent(phase, data, method, section);
        });
        const event = _.find(
          events,
          ({ event }) => `${event.section}.${event.method}` === method
        );
        if (event) {
          resolve();
          unsub();
          // } else {
          //   reject(new Error("event not found"));
        }
        if (counter === blocks) {
          reject(`method ${method} not found within blocks limit`);
        }
      });
    });
  });
};

// used for APIs other than mangata
export const signSendSuccess = async (
  api: ApiPromise,
  tx: Extrinsic,
  user: User
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const unsub = await tx.signAndSend(
        user.keyRingPair,
        ({ events, status, dispatchError }) => {
          testLog.getLog().info(status);
          events.forEach(({ phase, event: { data, method, section } }) => {
            logEvent(phase, data, method, section);
          });

          if (!_.isNil(dispatchError)) {
            if (dispatchError.isModule) {
              const metaError = api.registry.findMetaError(
                dispatchError.asModule
              );
              const { name, section } = metaError;
              reject(new Error(`${section}.${name}`));
              return;
            } else {
              reject(new Error(dispatchError.toString()));
              return;
            }
          }

          const event = _.find(events, ({ event }) =>
            api.events.system.ExtrinsicSuccess.is(event)
          );
          if (event) {
            resolve();
            unsub();
          }

          if (status.isFinalized) {
            reject(new Error("The event.ExtrinsicSuccess is not found"));
            unsub();
          }
        }
      );
    } catch (error) {
      reject(error);
    }
  });
};
