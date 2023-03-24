import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  activateLiquidity,
  burnLiquidity,
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
let testUser: User;
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

  [testUser] = setupUsers();

  await setupApi();

  [token1, token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser, Assets.DEFAULT_AMOUNT),
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
    Assets.mintNative(testUser)
  );

  testUser.addAsset(MGA_ASSET_ID);
  testUser.addAsset(token1);
  testUser.addAsset(token2);
  testUser.addAsset(liqIdPromPool);
  testUser.addAsset(liqIdNonPromPool);
});

test("Check that a user that mints on a non-promoted pool liquidity tokens are free", async () => {
  await testUser.refreshAmounts(AssetWallet.BEFORE);
  await mintLiquidity(
    testUser.keyRingPair,
    MGA_ASSET_ID,
    token2,
    defaultCurrencyValue
  );
  await testUser.refreshAmounts(AssetWallet.AFTER);
  const differenceLiqTokensFree = testUser
    .getAsset(liqIdNonPromPool)
    ?.amountAfter.free!.sub(
      testUser.getAsset(liqIdNonPromPool)?.amountBefore.free!
    );
  const differenceLiqTokensReserved = testUser
    .getAsset(liqIdNonPromPool)
    ?.amountAfter.reserved!.sub(
      testUser.getAsset(liqIdNonPromPool)?.amountBefore.reserved!
    );

  expect(differenceLiqTokensFree).bnEqual(defaultCurrencyValue);
  expect(differenceLiqTokensReserved).bnEqual(new BN(0));
});

test("Check that a user that mints on a promoted pool liquidity tokens are reserved", async () => {
  await testUser.refreshAmounts(AssetWallet.BEFORE);
  await mintLiquidity(
    testUser.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  );
  await testUser.refreshAmounts(AssetWallet.AFTER);
  const differenceLiqTokensFree = testUser
    .getAsset(liqIdPromPool)
    ?.amountAfter.free!.sub(
      testUser.getAsset(liqIdPromPool)?.amountBefore.free!
    );
  const differenceLiqTokensReserved = testUser
    .getAsset(liqIdPromPool)
    ?.amountAfter.reserved!.sub(
      testUser.getAsset(liqIdPromPool)?.amountBefore.reserved!
    );

  expect(differenceLiqTokensFree).bnEqual(new BN(0));
  expect(differenceLiqTokensReserved).bnEqual(defaultCurrencyValue);
});

test("Check that a user that deactivate some tokens, put liquidity tokens from frozen to free, then activate some tokens and put liquidity tokens from free to frozen", async () => {
  await mintLiquidity(
    testUser.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  );

  await testUser.refreshAmounts(AssetWallet.BEFORE);

  await deactivateLiquidity(
    testUser.keyRingPair,
    liqIdPromPool,
    defaultCurrencyValue
  );

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const differenceDeactivLiqTokensReserved = testUser
    .getAsset(liqIdPromPool)
    ?.amountBefore.reserved!.sub(
      testUser.getAsset(liqIdPromPool)?.amountAfter.reserved!
    );
  const differenceDeactivLiqTokensFree = testUser
    .getAsset(liqIdPromPool)
    ?.amountAfter.free!.sub(
      testUser.getAsset(liqIdPromPool)?.amountBefore.free!
    );

  expect(differenceDeactivLiqTokensFree).bnEqual(defaultCurrencyValue);
  expect(differenceDeactivLiqTokensReserved).bnEqual(defaultCurrencyValue);

  await testUser.refreshAmounts(AssetWallet.BEFORE);

  await activateLiquidity(
    testUser.keyRingPair,
    liqIdPromPool,
    defaultCurrencyValue
  );

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const differenceActivLiqTokensReserved = testUser
    .getAsset(liqIdPromPool)
    ?.amountAfter.reserved!.sub(
      testUser.getAsset(liqIdPromPool)?.amountBefore.reserved!
    );
  const differenceActivLiqTokensFree = testUser
    .getAsset(liqIdPromPool)
    ?.amountBefore.free!.sub(
      testUser.getAsset(liqIdPromPool)?.amountAfter.free!
    );

  expect(differenceActivLiqTokensFree).bnEqual(defaultCurrencyValue);
  expect(differenceActivLiqTokensReserved).bnEqual(defaultCurrencyValue);
});

test("Check that a user can burn some tokens on a non-promoted pool", async () => {
  await mintLiquidity(
    testUser.keyRingPair,
    MGA_ASSET_ID,
    token2,
    defaultCurrencyValue
  );
  await testUser.refreshAmounts(AssetWallet.BEFORE);

  await burnLiquidity(
    testUser.keyRingPair,
    MGA_ASSET_ID,
    token2,
    defaultCurrencyValue
  );

  await testUser.refreshAmounts(AssetWallet.AFTER);
  const differenceLiqTokensFree = testUser
    .getAsset(liqIdNonPromPool)
    ?.amountBefore.free!.sub(
      testUser.getAsset(liqIdNonPromPool)?.amountAfter.free!
    );
  const differenceAssetTokenReserved = testUser
    .getAsset(token2)
    ?.amountAfter.free!.sub(testUser.getAsset(token2)?.amountBefore.free!);

  expect(differenceLiqTokensFree).bnEqual(defaultCurrencyValue);
  expect(differenceAssetTokenReserved).bnEqual(defaultCurrencyValue);
});

test("Check that a user can burn  tokens when they are activated and when burining the free are subtracted first", async () => {
  const api = getApi();

  await mintLiquidity(
    testUser.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  );
  await testUser.refreshAmounts(AssetWallet.BEFORE);

  const userBalanceBeforeBurning = await api.query.tokens.accounts(
    testUser.keyRingPair.address,
    liqIdPromPool
  );

  const valueBurningTokens = userBalanceBeforeBurning.free.add(
    userBalanceBeforeBurning.reserved.div(new BN(10))
  );

  await burnLiquidity(
    testUser.keyRingPair,
    MGA_ASSET_ID,
    token1,
    new BN(valueBurningTokens)
  );

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const differenceLiqTokensReserved = testUser
    .getAsset(liqIdPromPool)
    ?.amountBefore.reserved!.sub(
      testUser.getAsset(liqIdPromPool)?.amountAfter.reserved!
    );

  expect(userBalanceBeforeBurning.free).bnGt(new BN(0));
  expect(userBalanceBeforeBurning.reserved).bnGt(new BN(0));
  expect(testUser.getAsset(liqIdPromPool)?.amountAfter.free!).bnEqual(
    new BN(0)
  );
  expect(differenceLiqTokensReserved).bnGt(new BN(0));
});
