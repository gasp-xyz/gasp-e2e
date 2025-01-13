import { jest } from "@jest/globals";
import { BN } from "ethereumjs-util";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { FoundationMembers } from "../../utils/FoundationMembers";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { AssetWallet, User } from "../../utils/User";
import { BN_BILLION } from "@polkadot/util";
import { Sudo } from "../../utils/sudo";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Market } from "../../utils/market";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  BN_MILLION,
  BN_TEN_THOUSAND,
  BN_ZERO,
  isMultiSwapAssetTransactionSuccessful,
  MangataGenericEvent,
  signTx,
} from "gasp-sdk";
import { getLiquidityAssetId } from "../../utils/tx";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let sudo: User;
let token1: BN;
let token2: BN;
let token3: BN;
let token4: BN;
let token5: BN;
let token6: BN;
let liqIds: BN[];

async function getStablePoolId(events: MangataGenericEvent[]) {
  const poolIds: BN[] = [];
  let poolId: BN;
  let i = 0;
  const poolCreatedEvents = JSON.parse(
    JSON.stringify(events.filter((events) => events.method === "PoolCreated")),
  );
  const length = poolCreatedEvents.length;
  while (i < length - 1) {
    poolId = new BN(poolCreatedEvents[i].event.data[1]);
    poolIds.push(poolId);
    i++;
  }
  return poolIds;
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  await setupApi();
  await setupUsers();
  sudo = getSudoUser();
});

beforeEach(async () => {
  let foundationMembers: any;

  foundationMembers = await FoundationMembers.getFoundationMembers();

  [token1, token2, token3, token4, token5, token6] =
    await Assets.setupUserWithCurrencies(
      sudo,
      [BN_BILLION, BN_BILLION, BN_BILLION, BN_BILLION, BN_BILLION, BN_BILLION],
      sudo,
    );

  const oldFounder = foundationMembers[2];

  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(oldFounder, FoundationMembers.changeKey(sudo)),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  foundationMembers = await FoundationMembers.getFoundationMembers();
  expect(foundationMembers).toContain(sudo.keyRingPair.address);

  const poolEvents = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      sudo,
      Market.createPool(token1, BN_MILLION, token2, BN_MILLION, "StableSwap"),
    ),
    Sudo.sudoAs(
      sudo,
      Market.createPool(
        token2,
        BN_MILLION,
        GASP_ASSET_ID,
        BN_MILLION,
        "StableSwap",
      ),
    ),
    Sudo.sudoAs(
      sudo,
      Market.createPool(
        GASP_ASSET_ID,
        BN_MILLION,
        token3,
        BN_MILLION,
        "StableSwap",
      ),
    ),
    Sudo.sudoAs(
      sudo,
      Market.createPool(token3, BN_MILLION, token4, BN_MILLION, "StableSwap"),
    ),
    Sudo.sudoAs(
      sudo,
      Market.createPool(token4, BN_MILLION, token5, BN_MILLION, "StableSwap"),
    ),
    Sudo.sudoAs(
      sudo,
      Market.createPool(token5, BN_MILLION, token6, BN_MILLION),
    ),
  );
  const eventResponse = getEventResultFromMangataTx(poolEvents);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  liqIds = await getStablePoolId(poolEvents);
  await Sudo.asSudoFinalized(
    Sudo.sudoAs(sudo, getApi().tx.foundationMembers.changeKey(oldFounder)),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  sudo.addAsset(token1);
  sudo.addAsset(token3);
  sudo.addAsset(token4);
  sudo.addAsset(token5);
  sudo.addAsset(token6);
});

test("User can buy GASP in multiswap operation", async () => {
  await sudo.refreshAmounts(AssetWallet.BEFORE);
  await signTx(
    getApi(),
    Market.multiswapAssetSell(
      [liqIds[0], liqIds[1]],
      token1,
      BN_TEN_THOUSAND,
      GASP_ASSET_ID,
      BN_ZERO,
    ),
    sudo.keyRingPair,
  ).then((result) => {
    const eventResult = isMultiSwapAssetTransactionSuccessful(result);
    expect(eventResult).toEqual(true);
  });
  await sudo.refreshAmounts(AssetWallet.AFTER);
  expect(sudo.getAsset(token1)?.amountBefore.free!).bnGt(
    sudo.getAsset(token1)?.amountAfter.free!,
  );
});

test("User can't sell GASP in multiswap operation (GASP token at the beginning)", async () => {
  await signTx(
    getApi(),
    Market.multiswapAssetSell(
      [liqIds[1], liqIds[0]],
      GASP_ASSET_ID,
      BN_TEN_THOUSAND,
      token1,
      BN_ZERO,
    ),
    sudo.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("NontransferableToken");
  });
});

test("User can't sell GASP in multiswap operation (GASP token in the middle)", async () => {
  await signTx(
    getApi(),
    Market.multiswapAssetSell(
      [liqIds[1], liqIds[2]],
      token2,
      BN_TEN_THOUSAND,
      token3,
      BN_ZERO,
    ),
    sudo.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("NontransferableToken");
  });
});

test("Happy path - multiswap with only stable pools", async () => {
  await sudo.refreshAmounts(AssetWallet.BEFORE);
  await signTx(
    getApi(),
    Market.multiswapAssetSell(
      [liqIds[3], liqIds[4]],
      token3,
      BN_TEN_THOUSAND,
      token5,
      BN_ZERO,
    ),
    sudo.keyRingPair,
  ).then((result) => {
    const eventResult = isMultiSwapAssetTransactionSuccessful(result);
    expect(eventResult).toEqual(true);
  });
  await sudo.refreshAmounts(AssetWallet.AFTER);
  expect(sudo.getAsset(token3)?.amountBefore.free!).bnGt(
    sudo.getAsset(token3)?.amountAfter.free!,
  );
  expect(sudo.getAsset(token5)?.amountBefore.free!).bnLt(
    sudo.getAsset(token5)?.amountAfter.free!,
  );
});

test("Happy path - multiswap with stable and xyk pools", async () => {
  liqIds[5] = await getLiquidityAssetId(token5, token6);
  await sudo.refreshAmounts(AssetWallet.BEFORE);
  await signTx(
    getApi(),
    Market.multiswapAssetSell(
      [liqIds[4], liqIds[5]],
      token4,
      BN_TEN_THOUSAND,
      token6,
      BN_ZERO,
    ),
    sudo.keyRingPair,
  ).then((result) => {
    const eventResult = isMultiSwapAssetTransactionSuccessful(result);
    expect(eventResult).toEqual(true);
  });
  await sudo.refreshAmounts(AssetWallet.AFTER);
  expect(sudo.getAsset(token4)?.amountBefore.free!).bnGt(
    sudo.getAsset(token4)?.amountAfter.free!,
  );
  expect(sudo.getAsset(token6)?.amountBefore.free!).bnLt(
    sudo.getAsset(token6)?.amountAfter.free!,
  );
});
