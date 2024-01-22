/*
 *
 * @group sdksequential
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  claimRewardsAll,
  getLiquidityAssetId,
  getRewardsInfo,
  promotePool,
} from "../../utils/tx";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { BN_ZERO } from "@mangata-finance/sdk";
import { ProofOfStake } from "../../utils/ProofOfStake";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser: User;
let testUser1: User;
let sudo: User;
let keyring: Keyring;

let poolTokenIds: BN[];
let liqIds: BN[];
let tokenAmounts: BN[];
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

  await setupApi();
  [testUser] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(sudo),
    Assets.mintNative(testUser),
  );

  const batchPromisesMinting = [];
  const batchPromisesPromoting = [];
  poolTokenIds = [];
  liqIds = [];

  tokenAmounts = Array(13).fill(defaultCurrencyValue);
  [...poolTokenIds] = await Assets.setupUserWithCurrencies(
    testUser,
    [...tokenAmounts],
    sudo,
  );

  for (let i = 0; i < poolTokenIds.length; i++) {
    const newTokenId = poolTokenIds[i].toNumber();
    batchPromisesMinting.push(
      Sudo.sudoAs(
        testUser,
        Xyk.createPool(
          MGA_ASSET_ID,
          defaultCurrencyValue.divn(2),
          new BN(newTokenId),
          defaultCurrencyValue.divn(2),
        ),
      ),
    );
  }

  await Sudo.batchAsSudoFinalized(...batchPromisesMinting);

  for (let tokenNumber = 0; tokenNumber < poolTokenIds.length; tokenNumber++) {
    const liqId = await getLiquidityAssetId(
      MGA_ASSET_ID,
      poolTokenIds[tokenNumber],
    );
    liqIds.push(liqId);
  }

  for (let tokenNumber = 0; tokenNumber < poolTokenIds.length; tokenNumber++) {
    batchPromisesPromoting.push(
      Assets.promotePool(liqIds[tokenNumber].toNumber(), 20),
    );
    batchPromisesPromoting.push(
      Sudo.sudoAs(
        testUser,
        ProofOfStake.activateLiquidity(
          liqIds[tokenNumber],
          defaultCurrencyValue.divn(2),
        ),
      ),
    );
  }

  await Sudo.batchAsSudoFinalized(...batchPromisesPromoting);
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser1));
});

test("GIVEN an user has available some rewards in one pool WHEN claims all rewards THEN the user gets the rewards for that pool", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(poolTokenIds[0], testUser1, defaultCurrencyValue),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        poolTokenIds[0],
        defaultCurrencyValue.divn(2),
      ),
    ),
  );

  await waitForRewards(testUser1, liqIds[0]);

  const rewardsUserBefore = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIds[0],
  );

  await claimRewardsAll(testUser1).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const rewardsUserAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIds[0],
  );

  expect(rewardsUserBefore.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsUserAfter.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});

test("GIVEN an user has available some rewards in two pools WHEN claims all rewards THEN the user gets the rewards for thats pools", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(poolTokenIds[0], testUser1, defaultCurrencyValue),
    Assets.mintToken(poolTokenIds[1], testUser1, defaultCurrencyValue),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        poolTokenIds[0],
        defaultCurrencyValue.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        poolTokenIds[1],
        defaultCurrencyValue.divn(2),
      ),
    ),
  );

  await waitForRewards(testUser1, liqIds[1]);

  const rewardsLiqId1Before = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIds[0],
  );

  const rewardsLiqId2Before = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIds[1],
  );

  await claimRewardsAll(testUser1).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const rewardsLiqId1After = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIds[0],
  );

  const rewardsLiqId2After = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIds[1],
  );

  expect(rewardsLiqId1Before.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqId1After.rewardsAlreadyClaimed).bnGt(BN_ZERO);
  expect(rewardsLiqId2Before.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqId2After.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});

test("GIVEN an user has available some rewards in two pools one deactivated WHEN claims all rewards THEN the user gets the rewards for thats pools", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(poolTokenIds[0], testUser1, defaultCurrencyValue),
    Assets.mintToken(poolTokenIds[12], testUser1, defaultCurrencyValue),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        poolTokenIds[0],
        defaultCurrencyValue.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        poolTokenIds[12],
        defaultCurrencyValue.divn(2),
      ),
    ),
  );

  await waitForRewards(testUser1, liqIds[12]);

  await promotePool(sudo.keyRingPair, liqIds[12], 0);

  const rewardsLiqId1Before = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIds[0],
  );

  const rewardsLiqId2Before = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIds[12],
  );

  await claimRewardsAll(testUser1).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const rewardsLiqId1After = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIds[0],
  );

  const rewardsLiqId2After = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIds[12],
  );

  expect(rewardsLiqId1Before.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqId1After.rewardsAlreadyClaimed).bnGt(BN_ZERO);
  expect(rewardsLiqId2Before.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqId2After.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});

test("GIVEN a user that has available some rewards in ten pools max for automatically claiming WHEN claims all rewards THEN the user gets the rewards for thats pools", async () => {
  const rewardsLiqIdBefore = [];
  const rewardsLiqIdAfter = [];

  await createMultiplePoolsForUser(testUser1, 10);

  await waitForRewards(testUser1, liqIds[9]);

  for (let i = 0; i < 10; i++) {
    rewardsLiqIdBefore[i] = await getRewardsInfo(
      testUser1.keyRingPair.address,
      liqIds[i],
    );
  }

  await claimRewardsAll(testUser1).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  for (let i = 0; i < 10; i++) {
    rewardsLiqIdAfter[i] = await getRewardsInfo(
      testUser1.keyRingPair.address,
      liqIds[i],
    );

    expect(rewardsLiqIdBefore[i].rewardsAlreadyClaimed).bnEqual(BN_ZERO);
    expect(rewardsLiqIdAfter[i].rewardsAlreadyClaimed).bnGt(BN_ZERO);
  }
});

test("GIVEN a user has available some rewards in over ten pools WHEN claims all rewards THEN the error is received", async () => {
  liqIds = await createMultiplePoolsForUser(testUser1, 12);

  await waitForRewards(testUser1, liqIds[11]);

  let errorReason: any;

  await claimRewardsAll(testUser1).catch((error) => {
    errorReason = error.toString();
  });

  expect(errorReason).toContain(
    "Error: Only up to 10 can be claimed automatically, consider claiming rewards separately for each liquidity pool",
  );
});

test("GIVEN a user has available some rewards in over ten pools AND this user claims some pool manually WHEN claims all rewards THEN the user gets the rewards for all remaining pools", async () => {
  const rewardsLiqIdBefore = [];
  const rewardsLiqIdAfter = [];

  liqIds = await createMultiplePoolsForUser(testUser1, 12);

  await waitForRewards(testUser1, liqIds[11]);

  let errorReason: any;

  await claimRewardsAll(testUser1).catch((error) => {
    errorReason = error.toString();
  });

  expect(errorReason).toContain(
    "Error: Only up to 10 can be claimed automatically, consider claiming rewards separately for each liquidity pool",
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, ProofOfStake.claimRewardsAll(liqIds[0])),
    Sudo.sudoAs(testUser1, ProofOfStake.claimRewardsAll(liqIds[1])),
    Sudo.sudoAs(testUser1, ProofOfStake.claimRewardsAll(liqIds[2])),
  );

  for (let i = 3; i < 12; i++) {
    rewardsLiqIdBefore[i] = await getRewardsInfo(
      testUser1.keyRingPair.address,
      liqIds[i],
    );
  }

  await claimRewardsAll(testUser1).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  for (let i = 3; i < 12; i++) {
    rewardsLiqIdAfter[i] = await getRewardsInfo(
      testUser1.keyRingPair.address,
      liqIds[i],
    );

    expect(rewardsLiqIdBefore[i].rewardsAlreadyClaimed).bnEqual(BN_ZERO);
    expect(rewardsLiqIdAfter[i].rewardsAlreadyClaimed).bnGt(BN_ZERO);
  }
});

async function createMultiplePoolsForUser(user: User, numberPools: number) {
  let i: number;
  const batchPromisesMinting = [];

  for (i = 0; i < numberPools; i++) {
    batchPromisesMinting.push(
      Assets.mintToken(poolTokenIds[i], user, defaultCurrencyValue),
    );
    batchPromisesMinting.push(
      Sudo.sudoAs(
        user,
        Xyk.mintLiquidity(
          MGA_ASSET_ID,
          poolTokenIds[i],
          defaultCurrencyValue.divn(2),
        ),
      ),
    );
  }

  await Sudo.batchAsSudoFinalized(...batchPromisesMinting);
  return liqIds;
}
