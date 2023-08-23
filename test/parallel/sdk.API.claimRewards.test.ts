/*
 *
 * @group sdk
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
  activateLiquidity,
  claimRewardsAll,
  getLiquidityAssetId,
  getRewardsInfo,
  promotePool,
} from "../../utils/tx";
import {
  getEventResultFromMangataTx,
  getNextAssetId,
} from "../../utils/txHandler";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { BN_ZERO } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let token2: BN;
let tokenIds: BN[];
let liqIds: BN[];
let tokenValues: BN[];
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
  await setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(sudo)
  );

  [testUser] = setupUsers();

  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
});

beforeEach(async () => {
  [testUser] = setupUsers();

  [token1, token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
});

test("GIVEN an user has available some rewards in one pool WHEN claims all rewards THEN the user gets the rewards for that pool", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser, defaultCurrencyValue),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultCurrencyValue.divn(2),
        token1,
        defaultCurrencyValue.divn(2)
      )
    )
  );

  const liqId = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await promotePool(sudo.keyRingPair, liqId, 20);

  await activateLiquidity(
    testUser.keyRingPair,
    liqId,
    defaultCurrencyValue.divn(2)
  );
  await waitForRewards(testUser, liqId);

  const rewardsUserBefore = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId
  );

  await claimRewardsAll(testUser).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const rewardsUserAfter = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId
  );

  expect(rewardsUserBefore.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsUserAfter.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});

test("GIVEN an user has available some rewards in two pools WHEN claims all rewards THEN the user gets the rewards for that's pools", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser, defaultCurrencyValue),
    Assets.mintToken(token2, testUser, defaultCurrencyValue),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultCurrencyValue.divn(2),
        token1,
        defaultCurrencyValue.divn(2)
      )
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultCurrencyValue.divn(2),
        token2,
        defaultCurrencyValue.divn(2)
      )
    )
  );

  const liqId1 = await getLiquidityAssetId(MGA_ASSET_ID, token1);
  const liqId2 = await getLiquidityAssetId(MGA_ASSET_ID, token2);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId1.toNumber(), 20),
    Assets.promotePool(liqId2.toNumber(), 20),
    Sudo.sudoAs(
      testUser,
      Xyk.activateLiquidity(liqId1, defaultCurrencyValue.divn(2))
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.activateLiquidity(liqId2, defaultCurrencyValue.divn(2))
    )
  );

  await waitForRewards(testUser, liqId1);

  const rewardsLiqId1Before = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId1
  );

  const rewardsLiqId2Before = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId2
  );

  await claimRewardsAll(testUser).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const rewardsLiqId1After = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId1
  );

  const rewardsLiqId2After = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId2
  );

  expect(rewardsLiqId1Before.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqId1After.rewardsAlreadyClaimed).bnGt(BN_ZERO);
  expect(rewardsLiqId2Before.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqId2After.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});

test("GIVEN an user has available some rewards in two pools ( one deactivated ) WHEN claims all rewards THEN the user gets the rewards for that's pools", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser, defaultCurrencyValue),
    Assets.mintToken(token2, testUser, defaultCurrencyValue),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultCurrencyValue.divn(2),
        token1,
        defaultCurrencyValue.divn(2)
      )
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultCurrencyValue.divn(2),
        token2,
        defaultCurrencyValue.divn(2)
      )
    )
  );

  const liqId1 = await getLiquidityAssetId(MGA_ASSET_ID, token1);
  const liqId2 = await getLiquidityAssetId(MGA_ASSET_ID, token2);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId1.toNumber(), 20),
    Assets.promotePool(liqId2.toNumber(), 20),
    Sudo.sudoAs(
      testUser,
      Xyk.activateLiquidity(liqId1, defaultCurrencyValue.divn(2))
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.activateLiquidity(liqId2, defaultCurrencyValue.divn(2))
    )
  );

  await waitForRewards(testUser, liqId1);

  await promotePool(sudo.keyRingPair, liqId1, 0);

  await waitForRewards(testUser, liqId1);

  const rewardsLiqId1Before = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId1
  );

  const rewardsLiqId2Before = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId2
  );

  await claimRewardsAll(testUser).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const rewardsLiqId1After = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId1
  );

  const rewardsLiqId2After = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId2
  );

  expect(rewardsLiqId1Before.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqId1After.rewardsAlreadyClaimed).bnGt(BN_ZERO);
  expect(rewardsLiqId2Before.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqId2After.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});

test("GIVEN an user has available some rewards in two “pools” ( one solo token, one pool ) WHEN claims all rewards THEN the user gets the rewards for that's pools", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser, defaultCurrencyValue),
    Assets.mintToken(token2, testUser, defaultCurrencyValue),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultCurrencyValue.divn(2),
        token1,
        defaultCurrencyValue.divn(2)
      )
    )
  );

  const liqId = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Assets.promotePool(token2.toNumber(), 20),
    Sudo.sudoAs(
      testUser,
      Xyk.activateLiquidity(liqId, defaultCurrencyValue.divn(2))
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.activateLiquidity(token2, defaultCurrencyValue.divn(2))
    )
  );

  await waitForRewards(testUser, token2);

  const rewardsLiqId1Before = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId
  );

  const rewardsLiqId2Before = await getRewardsInfo(
    testUser.keyRingPair.address,
    token2
  );

  await claimRewardsAll(testUser).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const rewardsLiqId1After = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId
  );

  const rewardsLiqId2After = await getRewardsInfo(
    testUser.keyRingPair.address,
    token2
  );

  expect(rewardsLiqId1Before.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqId1After.rewardsAlreadyClaimed).bnGt(BN_ZERO);
  expect(rewardsLiqId2Before.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqId2After.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});

test("GIVEN a user that has available some rewards in ten pools (max for automatically claiming) WHEN claims all rewards THEN the user gets the rewards for that's pools", async () => {
  liqIds = await createSeveralPoolsForUser(testUser, 10);

  const liqIdLast = liqIds.length - 1;

  await waitForRewards(testUser, liqIds[liqIdLast]);

  const rewardsLiqIdBefore = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqIds[liqIdLast]
  );

  await claimRewardsAll(testUser).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const rewardsLiqIdAfter = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqIds[liqIdLast]
  );

  expect(rewardsLiqIdBefore.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqIdAfter.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});

test("GIVEN a user has available some rewards in over ten pools WHEN claims all rewards THEN the error is received", async () => {
  liqIds = await createSeveralPoolsForUser(testUser, 12);

  const liqIdLast = liqIds.length - 1;

  await waitForRewards(testUser, liqIds[liqIdLast]);

  let errorReason: any;

  await claimRewardsAll(testUser).catch((error) => {
    errorReason = error.toString();
  });

  expect(errorReason).toContain(
    "Error: Only up to 10 can be claimed automatically, consider claiming rewards separately for each liquidity pool"
  );
});

test("GIVEN a user has available some rewards in over ten pools AND this user claims some pool manually WHEN claims all rewards THEN the user gets the rewards for all remaining pools", async () => {
  liqIds = await createSeveralPoolsForUser(testUser, 12);

  const liqIdLast = liqIds.length - 1;

  await waitForRewards(testUser, liqIds[liqIdLast]);

  let errorReason: any;

  await claimRewardsAll(testUser).catch((error) => {
    errorReason = error.toString();
  });

  expect(errorReason).toContain(
    "Error: Only up to 10 can be claimed automatically, consider claiming rewards separately for each liquidity pool"
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser, Xyk.claimRewardsAll(liqIds[0])),
    Sudo.sudoAs(testUser, Xyk.claimRewardsAll(liqIds[1])),
    Sudo.sudoAs(testUser, Xyk.claimRewardsAll(liqIds[2]))
  );

  const rewardsLiqIdBefore = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqIds[liqIdLast]
  );

  await claimRewardsAll(testUser).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const rewardsLiqIdAfter = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqIds[liqIdLast]
  );

  expect(rewardsLiqIdBefore.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsLiqIdAfter.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});

async function createSeveralPoolsForUser(user: User, numberPools: number) {
  const batchPromisesMinting = [];
  const batchPromisesPromoting = [];
  tokenIds = [];
  tokenValues = [];
  liqIds = [];

  const nextTokenId = (await getNextAssetId()).toNumber();

  for (
    let newTokenId = nextTokenId;
    newTokenId < nextTokenId + numberPools;
    newTokenId++
  ) {
    tokenIds.push(new BN(newTokenId));

    tokenValues.push(defaultCurrencyValue);

    batchPromisesMinting.push(
      Assets.mintToken(new BN(newTokenId), user, defaultCurrencyValue)
    );

    batchPromisesMinting.push(
      Sudo.sudoAs(
        user,
        Xyk.createPool(
          MGA_ASSET_ID,
          defaultCurrencyValue.divn(2),
          new BN(newTokenId),
          defaultCurrencyValue.divn(2)
        )
      )
    );
  }

  [...tokenIds] = await Assets.setupUserWithCurrencies(
    user,
    [...tokenValues],
    sudo
  );

  await Sudo.batchAsSudoFinalized(...batchPromisesMinting);

  for (let tokenNumber = 0; tokenNumber < tokenIds.length; tokenNumber++) {
    const liqId = await getLiquidityAssetId(
      MGA_ASSET_ID,
      tokenIds[tokenNumber]
    );
    liqIds.push(liqId);
  }

  for (let tokenNumber = 0; tokenNumber < tokenIds.length; tokenNumber++) {
    batchPromisesPromoting.push(
      Assets.promotePool(liqIds[tokenNumber].toNumber(), 20)
    );
    batchPromisesPromoting.push(
      Sudo.sudoAs(
        user,
        Xyk.activateLiquidity(liqIds[tokenNumber], defaultCurrencyValue.divn(2))
      )
    );
  }

  await Sudo.batchAsSudoFinalized(...batchPromisesPromoting);

  return liqIds;
}
