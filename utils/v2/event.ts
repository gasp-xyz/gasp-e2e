import { api, Extrinsic } from "./setup";
import { testLog } from "../Logger";
import { User } from "../User";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";
import { getEventResultFromMangataTx } from "../txHandler";
import { ExtrinsicResult } from "../eventListeners";

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

export function findEventData(
  result: MangataGenericEvent[],
  method: string
): any[] {
  return result
    .filter((event) => `${event.section}.${event.method}` === method)
    .map((event) => event.event.toHuman().data);
}
