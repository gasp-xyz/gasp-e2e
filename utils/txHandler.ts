import { SubmittableExtrinsic } from "@polkadot/api/types";
import { isHex } from "@polkadot/util";
import { getApi } from "./api";
import { GenericEvent } from "@polkadot/types";
import { KeyringPair } from "@polkadot/keyring/types";
import { BN, hexToU8a } from "@polkadot/util";
import { SudoDB } from "./SudoDB";
import { env } from "process";
import { EventResult, ExtrinsicResult } from "./eventListeners";
import { logEvent, testLog } from "./Logger";
import { User } from "./User";
import {
  MangataEventData,
  MangataGenericEvent,
  signTx,
  TxOptions,
} from "@mangata-finance/sdk";
import { AccountId32 } from "@polkadot/types/interfaces";
import _ from "lodash";
import { ApiPromise } from "@polkadot/api";

//let wait 7 blocks - 6000 * 7 = 42000; depends on the number of workers.

export async function getCurrentNonce(account?: string) {
  const api = getApi();
  if (account) {
    const { nonce } = (await api.query.system.account(account)) as any;
    return nonce.toNumber();
  }
  return -1;
}

export async function getBalanceOfAsset(assetId: BN, account: any) {
  const api = getApi();

  const balance = await api.query.assets.balances([assetId, account.address]);

  testLog
    .getLog()
    .info(
      account.address + " asset " + assetId + " balance: " + balance.toString()
    );

  return balance.toString();
}

export async function getBalanceOfPool(
  assetId1: BN,
  assetId2: BN
): Promise<BN[][]> {
  const api = getApi();

  const balance1 = await api.query.xyk.pools([assetId1, assetId2]);
  const balance2 = await api.query.xyk.pools([assetId2, assetId1]);

  testLog
    .getLog()
    .info(
      "pool " +
        assetId1 +
        "-" +
        assetId2 +
        " has balance of " +
        balance1 +
        "-" +
        balance2
    );

  return [
    [new BN(balance1[0]), new BN(balance1[1])],
    [new BN(balance2[0]), new BN(balance2[1])],
  ];
}

export async function getSudoKey(): Promise<AccountId32> {
  const api = getApi();

  const sudoKey = await api.query.sudo.key();

  return (sudoKey as any).unwrap();
}

export const getNextAssetId = async () => {
  const api = getApi();
  const asset_id = await api.query.tokens.nextCurrencyId();
  return new BN(asset_id.toString());
};

export const sudoIssueAsset = async (
  sudoAccount: KeyringPair,
  total_balance: BN,
  targetAddress: string
): Promise<MangataGenericEvent[]> => {
  const nonce = await SudoDB.getInstance().getSudoNonce(sudoAccount.address);
  testLog.getLog().info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);
  const api = getApi();
  let results: MangataGenericEvent[] = [];
  try {
    results = await signTx(
      api,
      api.tx.sudo.sudo(api.tx.tokens.create(targetAddress, total_balance)),
      sudoAccount,
      { nonce: new BN(nonce) }
    );
  } catch (e) {
    testLog.getLog().error(JSON.stringify(e));
  }
  testLog.getLog().info(JSON.stringify(results));
  return results;
};

export const transferAssets = async (
  from: any,
  to: any,
  asset_id: BN,
  amount: BN,
  nonce: number
): Promise<MangataGenericEvent[]> => {
  const api = getApi();
  return signTx(api, api.tx.tokens.transfer(to, asset_id, amount), from, {
    nonce: new BN(nonce),
  });
};

const extrinsicResultMethods = [
  "ExtrinsicSuccess",
  "ExtrinsicFailed",
  "ExtrinsicUndefined",
];

export const getEventResultFromMangataTx = function (
  relatedEvents: MangataGenericEvent[],
  searchTerm: string[] = []
): EventResult {
  let extrinsicResult;
  extrinsicResult = relatedEvents.find(
    (e) =>
      e.event.toHuman().method !== null &&
      extrinsicResultMethods.includes(e.event.toHuman().method!.toString())
  );
  if (searchTerm.length > 0) {
    extrinsicResult = relatedEvents.find(
      (e) =>
        e.event.toHuman().method !== null &&
        searchTerm.every((filterTerm) =>
          (
            JSON.stringify(e.event.toHuman()) +
            JSON.stringify(e.event.toHuman().data)
          ).includes(filterTerm)
        )
    );
  } else {
    extrinsicResult = relatedEvents.find(
      (e) =>
        e.event.toHuman().method !== null &&
        extrinsicResultMethods.includes(e.event.toHuman().method!.toString())
    );
  }
  if ((extrinsicResult?.event as GenericEvent) === undefined) {
    testLog.getLog().warn("WARN: Event is undefined.");
    testLog.getLog().warn(JSON.stringify(relatedEvents));
    testLog.getLog().warn(searchTerm);
    throw new Error("  --- TX Mapping issue --- ");
  }
  return createEventResultfromExtrinsic(extrinsicResult as MangataGenericEvent);
};

export async function getEventErrorfromSudo(sudoEvent: MangataGenericEvent[]) {
  const api = getApi();

  const filteredEvent = sudoEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid"
  );

  if (filteredEvent[1] !== undefined) {
    testLog.getLog().warn("WARN: Received more than one errors");
    //throw new Error("  --- TX Mapping issue --- ");
  }

  const eventErrorValue = hexToU8a(
    JSON.parse(JSON.stringify(filteredEvent[0].event.data[0])).err.module.error
  );

  const eventErrorIndex = JSON.parse(
    JSON.stringify(filteredEvent[0].event.data[0])
  ).err.module.index;

  const sudoEventError = api?.registry.findMetaError({
    error: eventErrorValue,
    index: new BN(eventErrorIndex),
  });
  return sudoEventError;
}

function createEventResultfromExtrinsic(extrinsicResult: MangataGenericEvent) {
  const eventResult = extrinsicResult.event.toHuman();
  switch (eventResult.method) {
    case extrinsicResultMethods[1]:
      return new EventResult(
        ExtrinsicResult.ExtrinsicFailed,
        JSON.parse(JSON.stringify(extrinsicResult.error!)).name
      );

    case extrinsicResultMethods[2]:
      return new EventResult(
        ExtrinsicResult.ExtrinsicUndefined,
        eventResult.data
      );

    default:
      return new EventResult(
        ExtrinsicResult.ExtrinsicSuccess,
        eventResult.data
      );
  }
}

/// Do a Tx and expect a success. Good for setups.
export async function signSendAndWaitToFinishTx(
  fun: SubmittableExtrinsic<"promise"> | undefined,
  account: KeyringPair,
  strictSuccess: boolean = true
) {
  const nonce = await getCurrentNonce(account.address);
  const api = getApi();
  const result = await signTx(api, fun!, account, {
    nonce: new BN(nonce),
  }).then((result) => {
    return getEventResultFromMangataTx(result);
  });
  if (strictSuccess) {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  }

  return result;
}

export async function setAssetInfo(
  sudo: User,
  id: BN,
  name: string,
  symbol: string,
  _address: string,
  decimals: BN
) {
  const nonce = await SudoDB.getInstance().getSudoNonce(
    sudo.keyRingPair.address
  );
  testLog.getLog().info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);

  const api = getApi();
  return await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.assetRegistry.registerAsset(
        {
          decimals: decimals,
          name: api.createType("Vec<u8>", name),
          symbol: api.createType("Vec<u8>", symbol),
          existentialDeposit: 0,
        },
        // @ts-ignore, todo remove after sdk update
        id
      )
    ),
    sudo.keyRingPair,
    { nonce: new BN(nonce) }
  ).then((result) => {
    return getEventResultFromMangataTx(result);
  });
}

export async function signTxAndGetEvents(
  api: ApiPromise,
  tx: SubmittableExtrinsic<"promise">,
  account: string | KeyringPair,
  txOptions?: TxOptions
): Promise<MangataGenericEvent[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const unsub = await tx.signAndSend(
        account,
        { nonce: txOptions?.nonce },
        ({ events, status, dispatchError }) => {
          testLog
            .getLog()
            .info(`→ events on ${api.runtimeChain} for ${status}`);

          events.forEach((e) => logEvent(api.runtimeChain, e));

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
            const eventsAsMGAEventData = events.map((eventRecord) => {
              const { event, phase } = eventRecord;
              const types = event.typeDef;
              const eventData: MangataEventData[] = event.data.map(
                (d: any, i: any) => {
                  return {
                    lookupName: types[i].lookupName!,
                    data: d,
                  };
                }
              );

              return {
                event,
                phase,
                section: event.section,
                method: event.method,
                metaDocumentation: event.meta.docs.toString(),
                eventData,
                error: getError(api, event.method, eventData),
              } as MangataGenericEvent;
            });
            resolve(eventsAsMGAEventData);
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
}
const getError = (
  api: ApiPromise,
  method: string,
  eventData: MangataEventData[]
): {
  documentation: string[];
  name: string;
} | null => {
  const failedEvent = method === "ExtrinsicFailed";

  if (failedEvent) {
    const error = eventData.find((item) =>
      item.lookupName.includes("DispatchError")
    );
    const errorData = error?.data?.toHuman?.() as TErrorData | undefined;
    const errorIdx = errorData?.Module?.error;
    const moduleIdx = errorData?.Module?.index;

    if (errorIdx && moduleIdx) {
      try {
        const decode = api.registry.findMetaError({
          error: isHex(errorIdx) ? hexToU8a(errorIdx) : new BN(errorIdx),
          index: new BN(moduleIdx),
        });
        return {
          documentation: decode.docs,
          name: decode.name,
        };
      } catch (error) {
        return {
          documentation: ["Unknown error"],
          name: "UnknownError",
        };
      }
    } else {
      return {
        documentation: ["Unknown error"],
        name: "UnknownError",
      };
    }
  }

  return null;
};
type TErrorData = {
  Module?: {
    index?: string;
    error?: string;
  };
};
