/*
 *
 * @group xyk
 * @group market
 * @group poolLiq
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { getLiquidityAssetId } from "../../utils/tx";
import { User } from "../../utils/User";
import { rpcCalculateNativeRewards } from "../../utils/utils";
import { waitForRewards } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Market } from "../../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser: User;
let testUser1: User;
let testUser2: User;
let sudo: User;
let token1: BN;
let token2: BN;
let liqIdPromPool: BN;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();

  [testUser, testUser1, testUser2] = setupUsers();

  await setupApi();

  [token1, token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT.muln(2)),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Assets.mintToken(token1, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
    Sudo.sudoAs(
      testUser,
      Market.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser,
      Market.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  testUser1.addAsset(liqIdPromPool);
  testUser1.addAsset(token1);
  testUser2.addAsset(liqIdPromPool);
  testUser2.addAsset(token1);
});

test("Users minted a different number of tokens THEN they receive an equivalent amount of rewards", async () => {
  await promotePool(token1);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser1,
      Market.mintLiquidity(
        liqIdPromPool,
        GASP_ASSET_ID,
        defaultCurrencyValue.mul(new BN(2)),
      ),
    ),
    Sudo.sudoAs(
      testUser2,
      Market.mintLiquidity(liqIdPromPool, GASP_ASSET_ID, defaultCurrencyValue),
    ),
  );

  await waitForRewards(testUser1, liqIdPromPool);

  const rewardsAmountUser1 = await rpcCalculateNativeRewards(
    testUser1.keyRingPair.address,
    liqIdPromPool,
  );

  const rewardsAmountUser2 = await rpcCalculateNativeRewards(
    testUser2,
    liqIdPromPool,
  );
  const rewardsDifference = rewardsAmountUser1.sub(
    rewardsAmountUser2.mul(new BN(2)),
  );

  expect(rewardsAmountUser1.div(rewardsDifference)).bnGt(new BN(10000));
});

test("One user mints X tokens, other mints those X tokens but splitted in 5 mints at the same block, rewards are equal", async () => {
  await promotePool(token2);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser1,
      Market.mintLiquidity(liqIdPromPool, GASP_ASSET_ID, defaultCurrencyValue),
    ),
    Sudo.sudoAs(
      testUser2,
      Market.mintLiquidity(
        liqIdPromPool,
        GASP_ASSET_ID,
        defaultCurrencyValue.div(new BN(5)),
      ),
    ),
    Sudo.sudoAs(
      testUser2,
      Market.mintLiquidity(
        liqIdPromPool,
        GASP_ASSET_ID,
        defaultCurrencyValue.div(new BN(5)),
      ),
    ),
    Sudo.sudoAs(
      testUser2,
      Market.mintLiquidity(
        liqIdPromPool,
        GASP_ASSET_ID,
        defaultCurrencyValue.div(new BN(5)),
      ),
    ),
    Sudo.sudoAs(
      testUser2,
      Market.mintLiquidity(
        liqIdPromPool,
        GASP_ASSET_ID,
        defaultCurrencyValue.div(new BN(5)),
      ),
    ),
    Sudo.sudoAs(
      testUser2,
      Market.mintLiquidity(
        liqIdPromPool,
        GASP_ASSET_ID,
        defaultCurrencyValue.div(new BN(5)),
      ),
    ),
  );

  await waitForRewards(testUser1, liqIdPromPool);

  const rewardsAmountUser1 = await rpcCalculateNativeRewards(
    testUser1,
    liqIdPromPool,
  );

  const rewardsAmountUser2 = await rpcCalculateNativeRewards(
    testUser2,
    liqIdPromPool,
  );

  expect(rewardsAmountUser1).bnEqual(rewardsAmountUser2);
});

async function promotePool(token: BN) {
  liqIdPromPool = await getLiquidityAssetId(GASP_ASSET_ID, token);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPromPool.toNumber(), 20),
  );
}
