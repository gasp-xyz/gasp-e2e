/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group xyk
 * @group liquidity
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  getEventResultFromMangataTx,
  sudoIssueAsset,
} from "../../utils/txHandler";
import { ExtrinsicResult, waitNewBlock } from "../../utils/eventListeners";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  promotePool,
  vestingTransfer,
  mintLiquidityUsingVestingNativeTokens,
  getLiquidityAssetId,
  burnLiquidity,
  transferAsset,
  unlockVestedToken,
} from "../../utils/tx";
import { BN_ZERO, toBN } from "@mangata-finance/sdk";
import { getBlockNumber } from "../../utils/utils";
import { User } from "../../utils/User";
import { Xyk } from "../../utils/xyk";
import { testLog } from "../../utils/Logger";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let createdToken: BN;
let liquidityID: BN;
const defaultCurrencyValue = new BN(250000);
const defaultVestingValue = new BN(200000);

async function createPoolAndVestingToken(
  needPromotePool: boolean,
  lockedValue: BN,
  perBlockValue: BN,
) {
  const api = getApi();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(createdToken, sudo, defaultCurrencyValue),
    Assets.mintToken(createdToken, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        GASP_ASSET_ID,
        defaultCurrencyValue,
        createdToken,
        defaultCurrencyValue,
      ),
    ),
  );

  liquidityID = await getLiquidityAssetId(GASP_ASSET_ID, createdToken);

  if (needPromotePool) {
    const promotingPool = await promotePool(sudo.keyRingPair, liquidityID);
    expect(getEventResultFromMangataTx(promotingPool).state).toEqual(
      ExtrinsicResult.ExtrinsicSuccess,
    );
  }
  const vestingStartBlockNumber = (await getBlockNumber()) + 5;
  await vestingTransfer(
    sudo,
    GASP_ASSET_ID,
    sudo,
    testUser1,
    vestingStartBlockNumber,
    lockedValue,
    perBlockValue,
  );

  const mintingVestingToken = await mintLiquidityUsingVestingNativeTokens(
    testUser1.keyRingPair,
    defaultVestingValue,
    createdToken,
  );

  if (needPromotePool) {
    const userBalanceAfterMinting = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID,
    );

    expect(userBalanceAfterMinting.frozen).bnEqual(defaultVestingValue);
  }

  return {
    vestingStartBlockNumber: vestingStartBlockNumber,
    mintingVestingTokenEvent: mintingVestingToken,
  };
}

async function waitNecessaryBlock(finishBlockNumberBN: BN) {
  const lastBlock = (await getBlockNumber()) + 10;
  let currentBlock = await getBlockNumber();
  const finishBlockNumber = finishBlockNumberBN.toNumber() + 1;
  while (lastBlock > currentBlock && finishBlockNumber > currentBlock) {
    await waitNewBlock();
    currentBlock = await getBlockNumber();
  }
  testLog.getLog().info("... Done waiting " + finishBlockNumber);
  if (finishBlockNumber > lastBlock) {
    testLog
      .getLog()
      .warn("TIMEOUT ERROR. Function finished with using watchdog limit");
  }
}

describe("xyk-pallet - Vested token tests: which action you can do with vesting token", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    // setup users
    sudo = getSudoUser();

    [testUser1] = setupUsers();

    await setupApi();

    const poolCurrencyIssue = await sudoIssueAsset(
      sudo.keyRingPair,
      toBN("1", 20),
      sudo.keyRingPair.address,
    );
    const poolEventResult = await getEventResultFromMangataTx(
      poolCurrencyIssue,
      ["tokens", "Created", sudo.keyRingPair.address],
    );
    const poolAssetId = poolEventResult.data[0].split(",").join("");
    createdToken = new BN(poolAssetId);
  });

  test("xyk-pallet- check that vested liqidity tokens can not be used for burning or transfering", async () => {
    await createPoolAndVestingToken(true, toBN("1", 20), new BN(100));

    const burnLiudityResult = await burnLiquidity(
      testUser1.keyRingPair,
      GASP_ASSET_ID,
      createdToken,
      new BN(150000),
    );
    expect(getEventResultFromMangataTx(burnLiudityResult).state).toEqual(
      ExtrinsicResult.ExtrinsicFailed,
    );
    expect(getEventResultFromMangataTx(burnLiudityResult).data).toContain(
      "NotEnoughAssets",
    );

    const transferAssetResult = await transferAsset(
      testUser1.keyRingPair,
      liquidityID,
      sudo.keyRingPair.address.toString(),
      new BN(150000),
    );
    expect(getEventResultFromMangataTx(transferAssetResult).state).toEqual(
      ExtrinsicResult.ExtrinsicFailed,
    );
    expect(getEventResultFromMangataTx(transferAssetResult).data).toContain(
      "LiquidityRestrictions",
    );
  });

  test("xyk-pallet- check that unlocking tokens are free to use when the relock time is done", async () => {
    const api = getApi();

    await createPoolAndVestingToken(true, toBN("1", 20), new BN(100));

    const userBalanceBeforeAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID,
    );
    expect(
      userBalanceBeforeAmount.free.sub(userBalanceBeforeAmount.frozen),
    ).bnEqual(new BN(0));

    const unlockSomeVestedToken = await unlockVestedToken(
      testUser1,
      liquidityID,
    );
    expect(getEventResultFromMangataTx(unlockSomeVestedToken).state).toEqual(
      ExtrinsicResult.ExtrinsicSuccess,
    );

    const userBalanceAfterUnlockingAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID,
    );
    expect(
      userBalanceAfterUnlockingAmount.free.sub(
        userBalanceAfterUnlockingAmount.frozen,
      ),
    ).bnGt(new BN(0));

    const howManyCanBeUnReserved =
      // @ts-ignore
      await api.rpc.xyk.get_max_instant_unreserve_amount(
        testUser1.keyRingPair.address,
        liquidityID.toString(),
      );
    expect(howManyCanBeUnReserved).bnEqual(BN_ZERO);

    const maxInstantBurnAmount =
      //@ts-ignore
      await api.rpc.xyk.get_max_instant_burn_amount(
        testUser1.keyRingPair.address,
        liquidityID,
      );

    const burnUnlockedToken = await burnLiquidity(
      testUser1.keyRingPair,
      GASP_ASSET_ID,
      createdToken,
      new BN(maxInstantBurnAmount),
    );
    expect(getEventResultFromMangataTx(burnUnlockedToken).state).toEqual(
      ExtrinsicResult.ExtrinsicSuccess,
    );

    const userBalanceAfterBurningAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID,
    );
    expect(
      userBalanceAfterBurningAmount.free.sub(
        userBalanceAfterBurningAmount.frozen,
      ),
    ).bnEqual(new BN(0));

    expect(
      userBalanceBeforeAmount.frozen.sub(userBalanceAfterBurningAmount.frozen),
    ).bnGt(new BN(0));
  });

  test("xyk-pallet- check that all unlocking vesting tokens can be burned", async () => {
    const api = getApi();
    const amountVestingToken = toBN("1", 20);
    const amountUnlockedPerBlock = toBN("2", 19);

    const vestingTokenFunction = await createPoolAndVestingToken(
      true,
      amountVestingToken,
      amountUnlockedPerBlock,
    );

    const vestingStartBlockNumber = new BN(
      vestingTokenFunction.vestingStartBlockNumber,
    );

    const vestingFinishBlockNumber = new BN(
      vestingStartBlockNumber.add(
        amountVestingToken.div(amountUnlockedPerBlock),
      ),
    );

    await waitNecessaryBlock(vestingFinishBlockNumber);

    const userBalanceBeforeAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID,
    );

    expect(
      userBalanceBeforeAmount.free.sub(userBalanceBeforeAmount.frozen),
    ).bnEqual(new BN(0));

    const unlockSomeVestedToken = await unlockVestedToken(
      testUser1,
      liquidityID,
    );
    expect(getEventResultFromMangataTx(unlockSomeVestedToken).state).toEqual(
      ExtrinsicResult.ExtrinsicSuccess,
    );

    const userBalanceAfterUnlockingAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID,
    );

    expect(
      userBalanceAfterUnlockingAmount.free.sub(
        userBalanceAfterUnlockingAmount.frozen,
      ),
    ).bnGt(new BN(0));

    expect(userBalanceAfterUnlockingAmount.frozen).bnEqual(new BN(0));

    // eslint-disable-next-line prettier/prettier
    const maxInstantBurnAmount =
      //@ts-ignore
      await api.rpc.xyk.get_max_instant_burn_amount(
        testUser1.keyRingPair.address,
        liquidityID,
      );

    const burnUnlockedToken = await burnLiquidity(
      testUser1.keyRingPair,
      GASP_ASSET_ID,
      createdToken,
      new BN(maxInstantBurnAmount),
    );
    expect(getEventResultFromMangataTx(burnUnlockedToken).state).toEqual(
      ExtrinsicResult.ExtrinsicSuccess,
    );

    const userBalanceAfterBurningAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID,
    );

    const UserBalanceNewTokAfterBurning = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      createdToken,
    );

    expect(userBalanceAfterBurningAmount.free).bnEqual(new BN(0));
    expect(userBalanceAfterBurningAmount.frozen).bnEqual(new BN(0));

    expect(UserBalanceNewTokAfterBurning.free).bnEqual(
      defaultCurrencyValue.sub(new BN(1)),
    );

    expect(
      userBalanceBeforeAmount.frozen.sub(userBalanceAfterBurningAmount.frozen),
    ).bnGt(new BN(0));
  });

  test("xyk-pallet- check that if pool not promoted then the extrinsic failed", async () => {
    const poolMintingVestingToken = await createPoolAndVestingToken(
      false,
      toBN("1", 20),
      new BN(100),
    );

    expect(
      getEventResultFromMangataTx(
        poolMintingVestingToken.mintingVestingTokenEvent,
      ).state,
    ).toEqual(ExtrinsicResult.ExtrinsicFailed);

    expect(
      getEventResultFromMangataTx(
        poolMintingVestingToken.mintingVestingTokenEvent,
      ).data,
    ).toContain("NotAPromotedPool");
  });
});
