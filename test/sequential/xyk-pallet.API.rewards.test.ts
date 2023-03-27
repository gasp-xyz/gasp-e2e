import { Keyring } from "@polkadot/api";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
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
  getRewardsInfo,
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
let rewardsInfoBefore: any;
let rewardsInfoAfter: any;
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
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Assets.mintToken(token1, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
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
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        token1,
        defaultCurrencyValue,
        defaultCurrencyValue.muln(2)
      )
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        token2,
        defaultCurrencyValue,
        defaultCurrencyValue.muln(2)
      )
    )
  );
  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(token1);
  testUser1.addAsset(token2);
  testUser1.addAsset(liqIdPromPool);
  testUser1.addAsset(liqIdNonPromPool);

  testUser2.addAsset(MGA_ASSET_ID);
  testUser2.addAsset(token1);
  testUser2.addAsset(token2);
  testUser2.addAsset(liqIdPromPool);
  testUser2.addAsset(liqIdNonPromPool);
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

test("Check that a user can burn some tokens on a non-promoted pool", async () => {
  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token2,
    defaultCurrencyValue
  );
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await burnLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token2,
    defaultCurrencyValue
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const differenceLiqTokensFree = testUser1
    .getAsset(liqIdNonPromPool)
    ?.amountBefore.free!.sub(
      testUser1.getAsset(liqIdNonPromPool)?.amountAfter.free!
    );
  const differenceAssetTokenReserved = testUser1
    .getAsset(token2)
    ?.amountAfter.free!.sub(testUser1.getAsset(token2)?.amountBefore.free!);

  expect(differenceLiqTokensFree).bnEqual(defaultCurrencyValue);
  expect(differenceAssetTokenReserved).bnEqual(defaultCurrencyValue);
});

test("Check that a user can burn  tokens when they are activated and when burining the free are subtracted first", async () => {
  const api = getApi();
  let userBalanceBeforeBurning: any;
  let valueBurningTokens: any;

  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  );
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await waitForRewards(testUser2, liqIdPromPool);

  userBalanceBeforeBurning = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    liqIdPromPool
  );

  valueBurningTokens = userBalanceBeforeBurning.free.add(
    userBalanceBeforeBurning.reserved.div(new BN(10))
  );

  await burnLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    new BN(valueBurningTokens)
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  await waitForRewards(testUser2, liqIdPromPool);

  const differenceLiqTokensReserved = testUser1
    .getAsset(liqIdPromPool)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(liqIdPromPool)?.amountAfter.reserved!
    );

  expect(userBalanceBeforeBurning.free).bnGt(new BN(0));
  expect(userBalanceBeforeBurning.reserved).bnGt(new BN(0));
  expect(testUser1.getAsset(liqIdPromPool)?.amountAfter.free!).bnEqual(
    new BN(0)
  );
  expect(differenceLiqTokensReserved).bnGt(new BN(0));

  userBalanceBeforeBurning = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    liqIdPromPool
  );

  valueBurningTokens = userBalanceBeforeBurning.free.add(
    userBalanceBeforeBurning.reserved
  );

  await burnLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    new BN(valueBurningTokens)
  );

  await waitForRewards(testUser2, liqIdPromPool);
});

test("Check that rewards are generated and can be claimed on each session, then burn all tokens and rewards wont be available", async () => {
  const api = getApi();
  const { chainUri } = getEnvironmentRequiredVars();
  const mangata = await getMangataInstance(chainUri);

  for (let index = 1; index < 3; index++) {
    await waitForRewards(testUser2, liqIdPromPool);

    rewardsInfoBefore = await getRewardsInfo(
      testUser2.keyRingPair.address,
      liqIdPromPool
    );

    await mangata.claimRewards(
      testUser2.keyRingPair,
      liqIdPromPool.toString(),
      defaultCurrencyValue
    );

    rewardsInfoAfter = await getRewardsInfo(
      testUser2.keyRingPair.address,
      liqIdPromPool
    );

    expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnGt(
      rewardsInfoBefore.rewardsAlreadyClaimed
    );
  }

  const userBalanceBeforeBurning = await api.query.tokens.accounts(
    testUser2.keyRingPair.address,
    liqIdPromPool
  );

  const valueBurningTokens = userBalanceBeforeBurning.free.add(
    userBalanceBeforeBurning.reserved
  );

  await burnLiquidity(
    testUser2.keyRingPair,
    MGA_ASSET_ID,
    token1,
    new BN(valueBurningTokens)
  );

  rewardsInfoAfter = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqIdPromPool
  );

  expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnEqual(new BN(0));
});
