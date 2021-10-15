import { SubmittableExtrinsic } from "@polkadot/api/types";
import { AnyJson } from "@polkadot/types/types";
import { getApi } from "./api";
import { GenericExtrinsic, GenericEvent } from "@polkadot/types";
import { KeyringPair } from "@polkadot/keyring/types";
import xoshiro from "xoshiro";
import BN from "bn.js";
import { SudoDB } from "./SudoDB";
import { env } from "process";
import { EventResult, ExtrinsicResult } from "./eventListeners";
import { testLog } from "./Logger";
import { User } from "./User";
//let wait 7 blocks - 6000 * 7 = 42000; depends on the number of workers.
const DEFAULT_TIME_OUT_MS = 42000;

export async function getCurrentNonce(account?: string) {
  const api = getApi();
  if (account) {
    const { nonce } = await api.query.system.account(account);
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

export async function getBalanceOfPool(assetId1: BN, assetId2: BN) {
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

  return [balance1, balance2];
}

export async function getSudoKey() {
  const api = getApi();

  const sudoKey = await api.query.sudo.key();

  return sudoKey;
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
): Promise<GenericEvent[]> => {
  const nonce = await SudoDB.getInstance().getSudoNonce(sudoAccount.address);
  testLog.getLog().info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);

  const api = getApi();
  return signAndWaitTx(
    api.tx.sudo.sudo(api.tx.tokens.create(targetAddress, total_balance)),
    sudoAccount,
    nonce
  );
};

export const transferAssets = async (
  from: any,
  to: any,
  asset_id: BN,
  amount: BN,
  nonce: number
): Promise<GenericEvent[]> => {
  const api = getApi();
  return signAndWaitTx(
    api.tx.tokens.transfer(to, asset_id, amount),
    from,
    nonce
  );
};

/**
 * shuffles input array in place using Fisher-Yates shuffling algorithm. Xoshiro-256+
 * is used as the source of of pseudo random number generator
 * @param objects - input array
 * @param seed - 32 bytes long seed for pseudo random number generator
 */
function fisher_yates_shuffle<K>(objects: K[], seed: Uint8Array) {
  const prng = xoshiro.create("256+", seed);
  for (let i = objects.length - 1; i > 0; i--) {
    const j = prng.roll() % i;
    const tmp = objects[i];
    objects[i] = objects[j];
    objects[j] = tmp;
  }
}

function recreateExtrinsicsOrder(
  extrinsics: GenericExtrinsic[],
  seed_bytes: Uint8Array
) {
  const slots = extrinsics.map((ev) => {
    if (ev.isSigned) {
      return ev.signer.toString();
    } else {
      return "None";
    }
  });

  fisher_yates_shuffle(slots, seed_bytes);

  const map = new Map();

  for (const e of extrinsics) {
    let who = "None";
    if (e.isSigned) {
      who = e.signer.toString();
    }

    if (map.has(who)) {
      map.get(who).push(e);
    } else {
      map.set(who, [e]);
    }
  }

  const shuffled_extrinsics = slots.map((who) => {
    return map.get(who).shift();
  });
  return shuffled_extrinsics;
}

export const signAndWaitTx = async (
  tx: SubmittableExtrinsic<"promise">,
  who: any,
  nonce: number,
  timeout_ms: number = DEFAULT_TIME_OUT_MS
): Promise<GenericEvent[]> => {
  testLog
    .getLog()
    .info(
      `W[${env.JEST_WORKER_ID}] - who: ${
        who.address
      } - nonce ${nonce} - tx : ${JSON.stringify(
        tx.toHuman()
      )} - timeout_ms : ${timeout_ms}`
    );

  return new Promise<GenericEvent[]>(async (resolve, reject) => {
    const api = getApi();
    let result: any[] = [];

    if (timeout_ms > 0) {
      setTimeout(() => {
        reject(
          `W[${env.JEST_WORKER_ID}] timeout in - signAndWaitTx - " + ${
            who.address
          } + " - " + ${nonce} + " - " + ${JSON.stringify(tx.toHuman())}`
        );
      }, timeout_ms);
    }

    const unsub = await tx.signAndSend(
      who,
      { nonce },
      async ({ events = [], status }) => {
        //testLog.getLog().warn((status);
        if (status.isInBlock) {
          const unsub_new_heads = await api.rpc.chain.subscribeNewHeads(
            async (lastHeader) => {
              if (
                lastHeader.parentHash.toString() === status.asInBlock.toString()
              ) {
                unsub_new_heads();
                const prev_block_extrinsics = (
                  await api.rpc.chain.getBlock(lastHeader.parentHash)
                ).block.extrinsics;
                const curr_block_events = await api.query.system.events.at(
                  lastHeader.hash
                );

                const json_response = JSON.parse(lastHeader.toString());
                const seed_bytes = Uint8Array.from(
                  Buffer.from(json_response["seed"]["seed"].substring(2), "hex")
                );

                const shuffled_extrinsics = recreateExtrinsicsOrder(
                  prev_block_extrinsics,
                  seed_bytes
                );

                // filter extrinsic triggered by current request
                const index = shuffled_extrinsics.findIndex((e) => {
                  return (
                    e.isSigned &&
                    e.signer.toString() === who.address &&
                    e.nonce.toString() === nonce.toString()
                  );
                });
                if (index < 0) {
                  return;
                }

                const req_events = curr_block_events
                  .filter((event) => {
                    return (
                      event.phase.isApplyExtrinsic &&
                      event.phase.asApplyExtrinsic.toNumber() === index
                    );
                  })
                  .map(({ phase, event }) => {
                    return event;
                  });
                testLog.getLog().info(
                  `W[${env.JEST_WORKER_ID}]` +
                    "--block - no " +
                    lastHeader.number +
                    " \n --curr_block " +
                    JSON.stringify(curr_block_events.toJSON()) +
                    " \n --curr_block[toHuman]: " +
                    curr_block_events
                      .map(({ event }) => {
                        return event;
                      })
                      .map(
                        (e) =>
                          JSON.stringify(e.toHuman()) +
                          JSON.stringify(e.toHuman().data)
                      )
                      .toString() +
                    " \n --req_events " +
                    req_events.toString() +
                    " \n --index: " +
                    index +
                    " \n --who.address: " +
                    who.address +
                    " \n --nonce: " +
                    nonce.toString() +
                    " \n --toHuman: " +
                    req_events
                      .map(
                        (e) =>
                          JSON.stringify(e.toHuman()) +
                          JSON.stringify(e.toHuman().data)
                      )
                      .toString()
                );
                result = result.concat(req_events);
              }
            }
          );
        } else if (status.isFinalized) {
          unsub();
          // resolve only if transaction has been finalized
          testLog
            .getLog()
            .info(
              `RESULT W[${env.JEST_WORKER_ID}]` +
                " \n --req_events " +
                result.toString() +
                " \n --who.address: " +
                who.address +
                " \n --nonce: " +
                nonce.toString() +
                " \n --toHuman: " +
                result
                  .map(
                    (e) =>
                      JSON.stringify(e.toHuman()) +
                      JSON.stringify(e.toHuman().data)
                  )
                  .toString()
            );
          resolve(result);
        }
      }
    );
  });
};
// From the events that a waitForTx, create an EventResponse filtering by search term or by extrinsic results.
export const getEventResultFromTxWait = function (
  relatedEvents: GenericEvent[],
  searchTerm: string[] = []
): EventResult {
  const extrinsicResultMethods = [
    "ExtrinsicSuccess",
    "ExtrinsicFailed",
    "ExtrinsicUndefined",
  ];
  let extrinsicResult;
  if (searchTerm.length > 0) {
    extrinsicResult = relatedEvents.find(
      (e) =>
        e.toHuman().method !== null &&
        searchTerm.every((filterTerm) =>
          (
            JSON.stringify(e.toHuman()) + JSON.stringify(e.toHuman().data)
          ).includes(filterTerm)
        )
    );
  } else {
    extrinsicResult = relatedEvents.find(
      (e) =>
        e.toHuman().method !== null &&
        extrinsicResultMethods.includes(e.toHuman().method!.toString())
    );
  }

  if (extrinsicResult) {
    const eventResult = extrinsicResult.toHuman();
    switch (eventResult.method) {
      case extrinsicResultMethods[1]:
        const data = eventResult.data as AnyJson[];
        const error = JSON.stringify(data[0]);
        const errorNumber = JSON.parse(error).Module.error;
        return new EventResult(
          ExtrinsicResult.ExtrinsicFailed,
          parseInt(errorNumber)
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
  testLog
    .getLog()
    .error(
      `W[${env.JEST_WORKER_ID}]` +
        relatedEvents +
        "<-found  --- Expected \n --->>" +
        searchTerm.toString() +
        "\n toHumanStr " +
        relatedEvents
          .map(
            (e) =>
              JSON.stringify(e.toHuman()) + JSON.stringify(e.toHuman().data)
          )
          .toString()
    );
  return new EventResult(-1, "ERROR: NO TX FOUND");
};

/// Do a Tx and expect a success. Good for setups.
export async function signSendAndWaitToFinishTx(
  fun: SubmittableExtrinsic<"promise"> | undefined,
  account: KeyringPair
) {
  const nonce = await getCurrentNonce(account.address);
  const result = await signAndWaitTx(fun!, account, nonce).then((result) => {
    return getEventResultFromTxWait(result);
  });
  expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  return result;
}

export async function setAssetInfo(
  sudo: User,
  id: BN,
  name: string,
  symbol: string,
  address: string,
  decimals: BN
) {
  const nonce = await SudoDB.getInstance().getSudoNonce(
    sudo.keyRingPair.address
  );
  testLog.getLog().info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);

  const api = getApi();
  const result = await signAndWaitTx(
    api.tx.sudo.sudo(
      api.tx.assetsInfo.setInfo(
        id,
        api.createType("Vec<u8>", name),
        api.createType("Vec<u8>", symbol),
        api.createType("Vec<u8>", address),
        api.createType("u32", decimals)
      )
    ),
    sudo.keyRingPair,
    nonce
  ).then((result) => {
    return getEventResultFromTxWait(result);
  });

  return result;
}
