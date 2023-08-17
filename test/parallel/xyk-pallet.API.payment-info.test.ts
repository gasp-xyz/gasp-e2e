/*
 *
 * @group rewardsV2Parallel
 */
import { jest } from "@jest/globals";
import { ApiPromise, Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { getLiquidityAssetId } from "../../utils/tx";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { BN } from "@polkadot/util";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_HUNDRED, BN_MILLION, BN_ZERO } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let api: ApiPromise;
let testUser: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let token2: BN;
let liqId1: BN;
let liqId2: BN;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);

  [testUser] = setupUsers();

  await setupApi();
  api = getApi();

  [token1, token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT.muln(2)),
    Assets.mintToken(token2, testUser, Assets.DEFAULT_AMOUNT.muln(2)),
    Assets.mintNative(testUser),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  liqId1 = await getLiquidityAssetId(MGA_ASSET_ID, token1);
  liqId2 = await getLiquidityAssetId(token1, token2);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId1.toNumber(), 20),
    Assets.promotePool(liqId2.toNumber(), 20)
  );
});

test("GIVEN a paymentInfo request, WHEN extrinsic is sellAsset  THEN zero is returned.", async () => {
  const sellAssetEvent = api.tx.xyk.sellAsset(
    MGA_ASSET_ID,
    token1,
    new BN(1000),
    BN_ZERO
  );

  const sellAssetPaymentInfo = await sellAssetEvent.paymentInfo(
    testUser.keyRingPair
  );
  expect(sellAssetPaymentInfo.partialFee).bnEqual(BN_ZERO);
});

test("GIVEN a paymentInfo request, WHEN extrinsic is multiswapBuyAsset THEN  zero is returned", async () => {
  const multiswapBuyEvent = api.tx.xyk.multiswapBuyAsset(
    [MGA_ASSET_ID, token2],
    BN_HUNDRED,
    BN_MILLION
  );

  const multiswapBuyPaymentInfo = await multiswapBuyEvent.paymentInfo(
    testUser.keyRingPair
  );

  expect(multiswapBuyPaymentInfo.partialFee).bnEqual(BN_ZERO);
});

test("GIVEN a paymentInfo request, WHEN extrinsic is mintLiquidityEvent THEN non-zero is returned", async () => {
  const mintLiquidityEvent = api.tx.xyk.mintLiquidity(
    MGA_ASSET_ID,
    token1,
    BN_HUNDRED,
    new BN(Number.MAX_SAFE_INTEGER)
  );

  const mintLiquidityPaymentInfo = await mintLiquidityEvent.paymentInfo(
    testUser.keyRingPair
  );

  expect(mintLiquidityPaymentInfo.partialFee).bnGt(BN_ZERO);
});

test("GIVEN a paymentInfo request, WHEN extrinsic is compoundRewards THEN non-zero is returned", async () => {
  const compoundRewardsEvent = api.tx.xyk.compoundRewards(liqId1, 1000000);

  const compoundRewardsPaymentInfo = await compoundRewardsEvent.paymentInfo(
    testUser.keyRingPair
  );

  expect(compoundRewardsPaymentInfo.partialFee).bnGt(BN_ZERO);
});
