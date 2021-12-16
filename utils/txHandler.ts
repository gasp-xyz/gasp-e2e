import {SubmittableExtrinsic} from "@polkadot/api/types";
import {AnyJson} from "@polkadot/types/types";
import {getApi} from "./api";
import {GenericEvent} from "@polkadot/types";
import {KeyringPair} from "@polkadot/keyring/types";
import BN from "bn.js";
import {SudoDB} from "./SudoDB";
import {env} from "process";
import {EventResult, ExtrinsicResult} from "./eventListeners";
import {testLog} from "./Logger";
import {User} from "./User";
import {MangataGenericEvent} from "mangata-sdk/build/";
import {signTx} from "mangata-sdk";

//let wait 7 blocks - 6000 * 7 = 42000; depends on the number of workers.

export async function getCurrentNonce(account?: string) {
  const api = getApi();
  if (account) {
    const {nonce} = await api.query.system.account(account);
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
      {nonce: new BN(nonce)}
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
  return results;
  //  return signAndWaitTx(
  //    api.tx.sudo.sudo(api.tx.tokens.create(targetAddress, total_balance)),
  //    sudoAccount,
  //    nonce
  //  );
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
  return createEventResultfromExtrinsic(extrinsicResult?.event as GenericEvent);
};
// From the events that a waitForTx, create an EventResponse filtering by search term or by extrinsic results.
export const getEventResultFromTxWait = function (
  relatedEvents: GenericEvent[],
  searchTerm: string[] = []
): EventResult {
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
    return createEventResultfromExtrinsic(extrinsicResult);
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

function createEventResultfromExtrinsic(extrinsicResult: GenericEvent) {
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

/// Do a Tx and expect a success. Good for setups.
export async function signSendAndWaitToFinishTx(
  fun: SubmittableExtrinsic<"promise"> | undefined,
  account: KeyringPair
) {
  const nonce = await getCurrentNonce(account.address);
  const api = getApi();
  const result = await signTx(api, fun!, account, {
    nonce: new BN(nonce),
  }).then((result) => {
    return getEventResultFromMangataTx(result);
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
  const result = await signTx(
    api,
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
    {nonce: new BN(nonce)}
  ).then((result) => {
    return getEventResultFromMangataTx(result);
  });

  return result;
}
