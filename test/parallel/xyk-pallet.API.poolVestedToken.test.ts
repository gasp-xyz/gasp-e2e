/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group xyk
 * @group liquidity
 * @group parallel
 */
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  getEventResultFromMangataTx,
  sudoIssueAsset,
} from "../../utils/txHandler";
import { ExtrinsicResult, waitNewBlock } from "../../utils/eventListeners";
import { setupApi, setupUsers } from "../../utils/setup";
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
import { BN, toBN } from "@mangata-finance/sdk";
import { getEnvironmentRequiredVars, getBlockNumber } from "../../utils/utils";
import { User } from "../../utils/User";
import { Xyk } from "../../utils/xyk";
import { testLog } from "../../utils/Logger";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let createdToken: any;
let liquidityID: BN;
const defaultCurrencyValue = new BN(250000);
const defaultVestingValue = new BN(200000);

async function createPoolAndVestingToken(
  needPromotePool: boolean,
  lockedValue: BN,
  perBlockValue: BN
) {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(createdToken, sudo, defaultCurrencyValue),
    Assets.mintToken(createdToken, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultCurrencyValue,
        createdToken,
        defaultCurrencyValue
      )
    )
  );

  liquidityID = await getLiquidityAssetId(MGA_ASSET_ID, createdToken);

  if (needPromotePool === true) {
    const promotingPool = await promotePool(sudo.keyRingPair, liquidityID);
    expect(getEventResultFromMangataTx(promotingPool).state).toEqual(
      ExtrinsicResult.ExtrinsicSuccess
    );
  }
  const vestingStartBlockNumber = (await getBlockNumber()) + 5;
  await vestingTransfer(
    sudo,
    MGA_ASSET_ID,
    sudo,
    testUser1,
    vestingStartBlockNumber,
    lockedValue,
    perBlockValue
  );

  const mintingVestingToken = await mintLiquidityUsingVestingNativeTokens(
    testUser1.keyRingPair,
    defaultVestingValue,
    createdToken
  );

  const mintingVestingTokenEvent = mintingVestingToken;

  return {
    vestingStartBlockNumber: vestingStartBlockNumber,
    mintingVestingTokenEvent: mintingVestingTokenEvent,
  };
}

async function waitNecessaryBlock(FinishBlockNumberBN: BN) {
  const lastBlock = (await getBlockNumber()) + 50;
  let currentBlock = await getBlockNumber();
  const FinishBlockNumber = FinishBlockNumberBN.toNumber();
  while (lastBlock > currentBlock && FinishBlockNumber > currentBlock) {
    await waitNewBlock();
    currentBlock = await getBlockNumber();
  }
  testLog.getLog().info("... Done waiting " + FinishBlockNumber);
  if (FinishBlockNumber > lastBlock) {
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
    keyring = new Keyring({ type: "sr25519" });

    // setup users
    sudo = new User(keyring, sudoUserName);

    [testUser1] = setupUsers();

    await setupApi();

    const poolCurrencyIssue = await sudoIssueAsset(
      sudo.keyRingPair,
      toBN("1", 20),
      sudo.keyRingPair.address
    );
    const poolEventResult = await getEventResultFromMangataTx(
      poolCurrencyIssue,
      ["tokens", "Issued", sudo.keyRingPair.address]
    );
    const poolAssetId = poolEventResult.data[0].split(",").join("");
    createdToken = new BN(poolAssetId);
  });

  test("xyk-pallet- check that vested liqidity tokens can not be used for burning or transfering", async () => {
    await createPoolAndVestingToken(true, toBN("1", 20), new BN(100));

    const burnLiudityResult = await burnLiquidity(
      testUser1.keyRingPair,
      MGA_ASSET_ID,
      createdToken,
      new BN(150000)
    );
    expect(getEventResultFromMangataTx(burnLiudityResult).state).toEqual(
      ExtrinsicResult.ExtrinsicFailed
    );
    expect(getEventResultFromMangataTx(burnLiudityResult).data).toContain(
      "NotEnoughAssets"
    );

    const transferAssetResult = await transferAsset(
      testUser1.keyRingPair,
      liquidityID,
      sudo.keyRingPair.address.toString(),
      new BN(150000)
    );
    expect(getEventResultFromMangataTx(transferAssetResult).state).toEqual(
      ExtrinsicResult.ExtrinsicFailed
    );
    expect(getEventResultFromMangataTx(transferAssetResult).data).toContain(
      "LiquidityRestrictions"
    );
  });

  test("xyk-pallet- check that unlocking tokens are free to use when the relock time is done", async () => {
    const api = getApi();

    await createPoolAndVestingToken(true, toBN("1", 20), new BN(100));

    const UserBalanceBeforeAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID
    );

    expect(
      UserBalanceBeforeAmount.free.sub(UserBalanceBeforeAmount.frozen)
    ).bnEqual(new BN(0));

    const unlockSomeVestedToken = await unlockVestedToken(
      testUser1,
      liquidityID
    );
    expect(getEventResultFromMangataTx(unlockSomeVestedToken).state).toEqual(
      ExtrinsicResult.ExtrinsicSuccess
    );

    const UserBalanceAfterUnlockingAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID
    );
    expect(
      UserBalanceAfterUnlockingAmount.free.sub(
        UserBalanceAfterUnlockingAmount.frozen
      )
    ).bnGt(new BN(0));

    //@ts-ignore
    const queryInfoResult = await api.rpc.xyk.get_max_instant_burn_amount(
      testUser1.keyRingPair.address,
      liquidityID
    );

    const burnUnlockedToken = await burnLiquidity(
      testUser1.keyRingPair,
      MGA_ASSET_ID,
      createdToken,
      queryInfoResult
    );
    expect(getEventResultFromMangataTx(burnUnlockedToken).state).toEqual(
      ExtrinsicResult.ExtrinsicSuccess
    );

    const UserBalanceAfterBurningAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID
    );
    expect(
      UserBalanceAfterBurningAmount.free.sub(
        UserBalanceAfterBurningAmount.frozen
      )
    ).bnEqual(new BN(0));

    expect(
      UserBalanceBeforeAmount.frozen.sub(UserBalanceAfterBurningAmount.frozen)
    ).bnGt(new BN(0));
  });

  test("xyk-pallet- check that all unlocking vesting tokens can be burned", async () => {
    const api = getApi();
    const poolLockedValue = toBN("1", 20);
    const poolBlockValue = toBN("5", 18);

    const VestingTokenFunction = await createPoolAndVestingToken(
      true,
      poolLockedValue,
      poolBlockValue
    );

    const vestingStartBlockNumber = new BN(
      VestingTokenFunction.vestingStartBlockNumber
    );

    const vestingFinishBlockNumber = new BN(
      vestingStartBlockNumber.add(
        poolLockedValue.sub(poolBlockValue).div(poolBlockValue)
      )
    );

    await waitNecessaryBlock(vestingFinishBlockNumber);

    const UserBalanceBeforeAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID
    );

    expect(
      UserBalanceBeforeAmount.free.sub(UserBalanceBeforeAmount.frozen)
    ).bnEqual(new BN(0));

    const unlockSomeVestedToken = await unlockVestedToken(
      testUser1,
      liquidityID
    );
    expect(getEventResultFromMangataTx(unlockSomeVestedToken).state).toEqual(
      ExtrinsicResult.ExtrinsicSuccess
    );

    const UserBalanceAfterUnlockingAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID
    );
    expect(
      UserBalanceAfterUnlockingAmount.free.sub(
        UserBalanceAfterUnlockingAmount.frozen
      )
    ).bnGt(new BN(0));

    //@ts-ignore
    const queryInfoResult = await api.rpc.xyk.get_max_instant_burn_amount(
      testUser1.keyRingPair.address,
      liquidityID
    );

    const burnUnlockedToken = await burnLiquidity(
      testUser1.keyRingPair,
      MGA_ASSET_ID,
      createdToken,
      queryInfoResult
    );
    expect(getEventResultFromMangataTx(burnUnlockedToken).state).toEqual(
      ExtrinsicResult.ExtrinsicSuccess
    );

    const UserBalanceAfterBurningAmount = await api.query.tokens.accounts(
      testUser1.keyRingPair.address,
      liquidityID
    );

    expect(UserBalanceAfterBurningAmount.free).bnEqual(new BN(0));

    expect(
      UserBalanceBeforeAmount.frozen.sub(UserBalanceAfterBurningAmount.frozen)
    ).bnGt(new BN(0));
  });

  test("xyk-pallet- check that if pool not promoted then the extrinsic failed", async () => {
    const poolMintingVestingToken = await createPoolAndVestingToken(
      false,
      toBN("1", 20),
      new BN(100)
    );

    expect(
      getEventResultFromMangataTx(
        poolMintingVestingToken.mintingVestingTokenEvent
      ).state
    ).toEqual(ExtrinsicResult.ExtrinsicFailed);

    expect(
      getEventResultFromMangataTx(
        poolMintingVestingToken.mintingVestingTokenEvent
      ).data
    ).toContain("NotAPromotedPool");
  });
});
