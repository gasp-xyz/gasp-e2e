// wrap SDK signTx to allow verbose logs
import { api, Extrinsic } from "./setup";
import { User } from "./User";
import { BN } from "@polkadot/util";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { testLog } from "./Logger";
import { getEventResultFromMangataTx } from "./txHandler";
import { ExtrinsicResult, logEvent } from "./eventListeners";
import { ApiPromise } from "@polkadot/api";
import _ from "lodash";

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
