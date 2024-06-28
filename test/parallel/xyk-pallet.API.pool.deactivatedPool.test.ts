/*
 *
 * @group poolLiq
 */
import { jest } from "@jest/globals";
import { getApi, initApi, mangata } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import { stringToBN } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { BN } from "@polkadot/util";
import "jest-extended";
import {
  activateLiquidity,
  createPool,
  getLiquidityAssetId,
  mintLiquidity,
  promotePool,
  sellAsset,
} from "../../utils/tx";
import {
  getBalanceOfPool,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import {
  ExtrinsicResult,
  waitSudoOperationFail,
} from "../../utils/eventListeners";
import { BN_ZERO } from "gasp-sdk";
import {
  checkLastBootstrapFinalized,
  scheduleBootstrap,
  setupBootstrapTokensBalance,
} from "../../utils/Bootstrap";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);

process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let sudo: User;
let token1: BN;
let liquidityId: BN;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();

  await setupApi();
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultCurrencyValue,
        token1,
        defaultCurrencyValue,
      ),
    ),
    Sudo.sudoAs(
      testUser1,
      Xyk.burnLiquidity(MGA_ASSET_ID, token1, defaultCurrencyValue),
    ),
  );

  liquidityId = await getLiquidityAssetId(MGA_ASSET_ID, token1);
  const deactivatedPoolBalance = await getBalanceOfPool(MGA_ASSET_ID, token1);

  expect(deactivatedPoolBalance[0][0]).bnEqual(BN_ZERO);
});

test("GIVEN deactivated pool WHEN another user tries to create an equal pool THEN error returns", async () => {
  [testUser2] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
  );

  await createPool(
    testUser2.keyRingPair,
    MGA_ASSET_ID,
    defaultCurrencyValue,
    token1,
    defaultCurrencyValue,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("PoolAlreadyExists");
  });
});

test("GIVEN deactivated pool WHEN another user tries to mint liquidity in the pool THEN user can do this", async () => {
  [testUser2] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
  );

  await mintLiquidity(
    testUser2.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const deactivatedPoolBalance = await getBalanceOfPool(MGA_ASSET_ID, token1);

  expect(deactivatedPoolBalance[0][0]).bnGt(BN_ZERO);
});

test("GIVEN deactivated pool WHEN the user mints liquidity in the pool again THEN liquidity IDs are equal", async () => {
  [testUser2] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
  );

  await mintLiquidity(
    testUser2.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const liquidityIdAfter = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  expect(liquidityIdAfter).bnEqual(liquidityId);
});

test("GIVEN deactivated pool WHEN the user tries to swap/multiswap tokens on the deactivated pool THEN error returns", async () => {
  let swapError: any = [];
  try {
    await sellAsset(
      testUser1.keyRingPair,
      MGA_ASSET_ID,
      token1,
      defaultCurrencyValue,
      new BN(1),
    );
  } catch (error) {
    swapError = error;
  }
  expect(swapError.data).toEqual(
    "1010: Invalid Transaction: The swap prevalidation has failed",
  );
});

test("GIVEN deactivated pool WHEN sudo try to promote a pool THEN poolPromotion is updated", async () => {
  const api = getApi();

  await promotePool(sudo.keyRingPair, liquidityId, 35).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const poolRewards = JSON.parse(
    JSON.stringify(await api.query.proofOfStake.promotedPoolRewards()),
  );
  const poolWeight = stringToBN(poolRewards[liquidityId.toString()].weight);

  expect(poolWeight).bnEqual(new BN(35));
});

test("GIVEN deactivated pool WHEN a bootstrap is scheduled for the existing pair THEN the operation fail with pool already exist.", async () => {
  await setupApi();

  await checkLastBootstrapFinalized(sudo);
  await setupBootstrapTokensBalance(token1, sudo, [testUser1]);

  const sudoBootstrap = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    token1,
    5,
    5,
    5,
  );
  await waitSudoOperationFail(sudoBootstrap, ["PoolAlreadyExists"]);
});

test("GIVEN deactivated pool WHEN call RPCs that work with the pools (e.g., calculate_buy_price_id) THEN zero returns", async () => {
  const priceAmount = await mangata?.rpc.calculateBuyPriceId(
    MGA_ASSET_ID.toString(),
    token1.toString(),
    defaultCurrencyValue,
  );

  expect(priceAmount).bnEqual(BN_ZERO);
});

test("GIVEN deactivated pool WHEN user tries to activate the pool THEN error returns", async () => {
  await promotePool(sudo.keyRingPair, liquidityId, 20);

  await activateLiquidity(
    testUser1.keyRingPair,
    liquidityId,
    defaultCurrencyValue,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("NotEnoughAssets");
  });
});
