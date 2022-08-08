import { api, Extrinsic } from "./setup";
import { testLog } from "../Logger";
import { User } from "../User";
import { getSystemErrorName } from "util";

// @ts-ignore
export const logEvent = (phase, data, method, section) => {
  testLog
    .getLog()
    .info(
      phase.toString() + " : " + section + "." + method + " " + data.toString()
    );
};

export const awaitEvent = (lookup: string) => {
  return new Promise<any>(async (resolve) => {
    const unsubscribe = await api.query.system.events((events) => {
      events.forEach(({ phase, event: { data, method, section } }) => {
        logEvent(phase, data, method, section);
        if (lookup === section + "." + method) {
          unsubscribe();
          resolve({});
        }
      });
    });
  });
};

export const awaitEventWithSend = async (
  tx: Extrinsic,
  user: User,
  lookup: string
) => {
  await tx.signAndSend(user.keyRingPair);
  await awaitEvent(lookup);
};

export const signSendFinalized = async (tx: Extrinsic, user: User) => {
  await new Promise((resolve, reject) => {
    tx.signAndSend(
      user.keyRingPair,
      ({ events = [], status, dispatchError }) => {
        testLog.getLog().info(status);
        events.forEach(({ phase, event: { data, method, section } }) => {
          logEvent(phase, data, method, section);
        });
        const err = checkError(dispatchError);
        if (err) {
          reject(err);
        }
        if (status.isFinalized) {
          resolve({});
        }
      }
    );
  });
};

const checkError = (dispatchError: any) => {
  if (dispatchError) {
    if (dispatchError.isModule) {
      // for module errors, we have the section indexed, lookup
      const decoded = api.registry.findMetaError(dispatchError.asModule);
      const { docs, name, section } = decoded;

      return new Error(`${section}.${name}: ${docs.join(" ")}`);
    } else {
      // Other, CannotLookup, BadOrigin, no extra info
      return new Error(dispatchError.toString());
    }
  }
  return null;
};
