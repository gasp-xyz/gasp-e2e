/*
 *
 * @group xyk
 * @group poolliquidity
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
  activateLiquidity,
  deactivateLiquidity,
  getLiquidityAssetId,
  mintLiquidity,
} from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let liqIdPromPool: BN;
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

  [testUser1] = setupUsers();

  await setupApi();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
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
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  liqIdPromPool = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPromPool.toNumber(), 20),
    Assets.mintNative(testUser1)
  );

  testUser1.addAsset(liqIdPromPool);
});

test("Check that a user that deactivate some tokens, put liquidity tokens from frozen to free, then activate some tokens and put liquidity tokens from free to frozen", async () => {
  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  );

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await deactivateLiquidity(
    testUser1.keyRingPair,
    liqIdPromPool,
    defaultCurrencyValue
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const differenceDeactivLiqTokensReserved = testUser1
    .getAsset(liqIdPromPool)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(liqIdPromPool)?.amountAfter.reserved!
    );
  const differenceDeactivLiqTokensFree = testUser1
    .getAsset(liqIdPromPool)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(liqIdPromPool)?.amountBefore.free!
    );

  expect(differenceDeactivLiqTokensFree).bnEqual(defaultCurrencyValue);
  expect(differenceDeactivLiqTokensReserved).bnEqual(defaultCurrencyValue);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await activateLiquidity(
    testUser1.keyRingPair,
    liqIdPromPool,
    defaultCurrencyValue
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const differenceActivLiqTokensReserved = testUser1
    .getAsset(liqIdPromPool)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(liqIdPromPool)?.amountBefore.reserved!
    );
  const differenceActivLiqTokensFree = testUser1
    .getAsset(liqIdPromPool)
    ?.amountBefore.free!.sub(
      testUser1.getAsset(liqIdPromPool)?.amountAfter.free!
    );

  expect(differenceActivLiqTokensFree).bnEqual(defaultCurrencyValue);
  expect(differenceActivLiqTokensReserved).bnEqual(defaultCurrencyValue);
});
