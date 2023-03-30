/*
 *
 * @group xyk
 * @group poolliquidity
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { getLiquidityAssetId, mintLiquidity } from "../../utils/tx";
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

  [testUser1] = setupUsers();

  await setupApi();

  [token1, token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    ),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  liqIdPromPool = await getLiquidityAssetId(MGA_ASSET_ID, token1);
  liqIdNonPromPool = await getLiquidityAssetId(MGA_ASSET_ID, token2);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPromPool.toNumber(), 20),
    Assets.mintNative(testUser1)
  );

  testUser1.addAsset(liqIdPromPool);
  testUser1.addAsset(liqIdNonPromPool);
});

test("Check that a user that mints on a promoted pool liquidity tokens are reserved", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  );
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const differenceLiqTokensFree = testUser1
    .getAsset(liqIdPromPool)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(liqIdPromPool)?.amountBefore.free!
    );
  const differenceLiqTokensReserved = testUser1
    .getAsset(liqIdPromPool)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(liqIdPromPool)?.amountBefore.reserved!
    );

  expect(differenceLiqTokensFree).bnEqual(new BN(0));
  expect(differenceLiqTokensReserved).bnEqual(defaultCurrencyValue);
});

test("Check that a user that mints on a non-promoted pool liquidity tokens are free", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token2,
    defaultCurrencyValue
  );
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const differenceLiqTokensFree = testUser1
    .getAsset(liqIdNonPromPool)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(liqIdNonPromPool)?.amountBefore.free!
    );
  const differenceLiqTokensReserved = testUser1
    .getAsset(liqIdNonPromPool)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(liqIdNonPromPool)?.amountBefore.reserved!
    );

  expect(differenceLiqTokensFree).bnEqual(defaultCurrencyValue);
  expect(differenceLiqTokensReserved).bnEqual(new BN(0));
});
