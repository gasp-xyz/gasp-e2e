/*
 *
 * @group xyk
 * @group poolliquidity
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { BN_ZERO } from "@mangata-finance/sdk";
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
} from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser: User;
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

  [testUser] = setupUsers();

  await setupApi();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser),
    Sudo.sudoAs(
      testUser,
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
    Assets.promotePool(liqIdPromPool.toNumber(), 20)
  );
});

beforeEach(async () => {
  testUser1 = new User(keyring);
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser1));
});

test("Given a user hame some liquidity token THEN he activate them THEN deactivate", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(liqIdPromPool, testUser1, Assets.DEFAULT_AMOUNT.divn(2))
  );

  testUser1.addAssets([MGA_ASSET_ID, liqIdPromPool]);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  const userTokenBeforeActivating =
    testUser1.getAsset(liqIdPromPool)?.amountBefore.reserved!;

  await activateLiquidity(
    testUser1.keyRingPair,
    liqIdPromPool,
    Assets.DEFAULT_AMOUNT.divn(2)
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userTokenBeforeDeactivating =
    testUser1.getAsset(liqIdPromPool)?.amountAfter.reserved!;

  await deactivateLiquidity(
    testUser1.keyRingPair,
    liqIdPromPool,
    Assets.DEFAULT_AMOUNT.divn(2)
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userTokenAfterDeactivating =
    testUser1.getAsset(liqIdPromPool)?.amountAfter.reserved!;

  expect(userTokenBeforeActivating).bnEqual(BN_ZERO);
  expect(userTokenBeforeDeactivating).bnGt(Assets.DEFAULT_AMOUNT.divn(2));
  expect(userTokenAfterDeactivating).bnEqual(BN_ZERO);
});
