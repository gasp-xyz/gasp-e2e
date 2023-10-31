// wrap SDK signTx to allow verbose logs
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { ApiPromise } from "@polkadot/api";
import { Codec } from "@polkadot/types/types";
import { BN } from "@polkadot/util";
import _ from "lodash";
import { ExtrinsicResult } from "./eventListeners";
import { logEvent, testLog } from "./Logger";
import { api, Extrinsic } from "./setup";
import { getEventResultFromMangataTx } from "./txHandler";
import { User } from "./User";

export const signSendFinalized = async (
  tx: Extrinsic,
  user: User,
  nonce: BN | undefined = undefined,
): Promise<MangataGenericEvent[]> => {
  return signTx(api, tx, user.keyRingPair, {
    nonce: nonce,
    statusCallback: ({ events = [], status }) => {
      testLog.getLog().info(status);
      events.forEach((e) => logEvent("mangata", e));
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

// used for APIs other than mangata
export const signSendSuccess = async (
  api: ApiPromise,
  tx: Extrinsic,
  user: User,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const unsub = await tx.signAndSend(
        user.keyRingPair,
        ({ events, status, dispatchError }) => {
          testLog
            .getLog()
            .info(`→ events on ${api.runtimeChain} for ${status}`);

          events.forEach((e) => logEvent(api.runtimeChain, e));

          if (!_.isNil(dispatchError)) {
            if (dispatchError.isModule) {
              const metaError = api.registry.findMetaError(
                dispatchError.asModule,
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
            api.events.system.ExtrinsicSuccess.is(event),
          );
          if (event) {
            resolve();
            unsub();
          }

          if (status.isFinalized) {
            reject(new Error("The event.ExtrinsicSuccess is not found"));
            unsub();
          }
        },
      );
    } catch (error) {
      reject(error);
    }
  });
};

export function defer<T>() {
  const deferred = {} as {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    promise: Promise<T>;
  };
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}

export const sendTransaction = async (tx: Promise<Extrinsic>) => {
  const signed = await tx;
  const deferred = defer<Codec[]>();
  await signed.send((status) => {
    if (status.isCompleted) {
      deferred.resolve(status.events);
    }
    if (status.isError) {
      deferred.reject(status.status);
    }
  });

  return {
    events: deferred.promise,
  };
};
