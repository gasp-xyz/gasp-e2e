/*
 *
 * @group xyk
 * @group poolLiq
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  burnLiquidity,
  getLiquidityAssetId,
  mintLiquidity,
} from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { waitForRewards } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let testUser2: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let token2: BN;
let liqIdPromPool: BN;
let liqIdNonPromPool: BN;
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

  [testUser1, testUser2] = setupUsers();

  await setupApi();

  [token1, token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Assets.mintToken(token2, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqIdPromPool = await getLiquidityAssetId(MGA_ASSET_ID, token1);
  liqIdNonPromPool = await getLiquidityAssetId(MGA_ASSET_ID, token2);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPromPool.toNumber(), 20),
    Assets.mintNative(testUser1),
  );

  testUser1.addAsset(liqIdPromPool);
  testUser2.addAsset(token2);
  testUser2.addAsset(liqIdNonPromPool);
});

test("Check that a user can burn tokens when they are activated, and when burning the free, those subtracted first", async () => {
  const api = getApi();

  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue,
  );
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await waitForRewards(testUser1, liqIdPromPool);

  const userBalanceBeforeBurning = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    liqIdPromPool,
  );

  const valueBurningTokens = userBalanceBeforeBurning.free.add(
    userBalanceBeforeBurning.reserved.div(new BN(10)),
  );

  await burnLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    new BN(valueBurningTokens),
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const differenceLiqTokensReserved = testUser1
    .getAsset(liqIdPromPool)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(liqIdPromPool)?.amountAfter.reserved!,
    );

  expect(userBalanceBeforeBurning.free).bnGt(new BN(0));
  expect(userBalanceBeforeBurning.reserved).bnGt(new BN(0));
  expect(testUser1.getAsset(liqIdPromPool)?.amountAfter.free!).bnEqual(
    new BN(0),
  );
  expect(differenceLiqTokensReserved).bnGt(new BN(0));
});

test("Check that a user can burn some tokens on a non-promoted pool", async () => {
  await mintLiquidity(
    testUser2.keyRingPair,
    MGA_ASSET_ID,
    token2,
    defaultCurrencyValue,
  );
  await testUser2.refreshAmounts(AssetWallet.BEFORE);

  await burnLiquidity(
    testUser2.keyRingPair,
    MGA_ASSET_ID,
    token2,
    defaultCurrencyValue,
  );

  await testUser2.refreshAmounts(AssetWallet.AFTER);
  const differenceLiqTokensFree = testUser2
    .getAsset(liqIdNonPromPool)
    ?.amountBefore.free!.sub(
      testUser2.getAsset(liqIdNonPromPool)?.amountAfter.free!,
    );
  const differenceAssetTokenReserved = testUser2
    .getAsset(token2)
    ?.amountAfter.free!.sub(testUser2.getAsset(token2)?.amountBefore.free!);

  expect(differenceLiqTokensFree).bnEqual(defaultCurrencyValue);
  expect(differenceAssetTokenReserved).bnEqual(defaultCurrencyValue);
});
