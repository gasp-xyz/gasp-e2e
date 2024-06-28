/*
 *
 * @group xyk
 * @group liquidity
 * @group parallel
 */
import { jest } from "@jest/globals";
import "jest-extended";
import { joinCandidate } from "../../utils/tx";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { hexToBn, BN } from "@polkadot/util";
import {
  getBlockNumber,
  getMultiPurposeLiquidityReLockStatus,
  getMultiPurposeLiquidityStatus,
  getVestingStatus,
  stringToBN,
} from "../../utils/utils";
import { BN_ZERO, signTx } from "gasp-sdk";
import {
  ExtrinsicResult,
  expectMGAExtrinsicSuDidSuccess,
} from "../../utils/eventListeners";
import { setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { Vesting } from "../../utils/Vesting";
import { getApi } from "../../utils/api";
import { MPL } from "../../utils/MPL";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Staking, tokenOriginEnum } from "../../utils/Staking";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let user1: User;
let user2: User;
let user3: User;
let user4: User;

describe("Vesting-native", () => {
  beforeAll(async () => {
    await setupApi();
    [user1, user2, user3, user4] = await setupUsers();
    const minStk = new BN(
      (await getApi()).consts.parachainStaking.minCandidateStk.toString(),
    );

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user1, minStk.muln(30)),
      Assets.mintNative(user2, minStk.muln(10)),
      Assets.mintNative(user3, minStk.muln(10)),
      Assets.mintNative(user4, minStk.muln(10)),
      Sudo.sudo(
        await Vesting.forceVested(user1, user2, minStk.muln(5), MGA_ASSET_ID),
      ),
      Sudo.sudo(
        await Vesting.forceVested(user1, user3, minStk.muln(5), MGA_ASSET_ID),
      ),
      Sudo.sudo(
        await Vesting.forceVested(user1, user4, minStk.muln(5), MGA_ASSET_ID),
      ),
    ).then((events) => {
      expectMGAExtrinsicSuDidSuccess(events);
    });
  });
  test("As a user, I can use MGX vested to move tokens to MPL pallet", async () => {
    let vesting = await getVestingStatus(
      user2.keyRingPair.address,
      MGA_ASSET_ID,
    );
    expect(vesting).not.toBeUndefined();
    const reservedAmount = await signTx(
      await getApi(),
      MPL.reserveVestingNativeTokensByVestingIndex(MGA_ASSET_ID),
      user2.keyRingPair,
    ).then((value) => {
      const event = getEventResultFromMangataTx(value, [
        "multiPurposeLiquidity",
        "VestingTokensReserved",
      ]);
      expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      return event.data;
    });
    const mplStorage = await getMultiPurposeLiquidityStatus(
      user2.keyRingPair.address,
      MGA_ASSET_ID,
    );
    const relockStatus = await getMultiPurposeLiquidityReLockStatus(
      user2.keyRingPair.address,
      MGA_ASSET_ID,
    );

    const reservedTotalAmount = stringToBN(
      reservedAmount[2].toString().split(",").join(""),
    );
    expect(stringToBN(mplStorage.stakedUnactivatedReserves)).bnEqual(BN_ZERO);
    expect(stringToBN(mplStorage.activatedUnstakedReserves)).bnEqual(BN_ZERO);
    expect(stringToBN(mplStorage.stakedAndActivatedReserves)).bnEqual(BN_ZERO);
    expect(stringToBN(mplStorage.unspentReserves.toString())).bnEqual(
      reservedTotalAmount,
    );
    expect(hexToBn(mplStorage.relockAmount)).bnEqual(reservedTotalAmount);

    const relockItem = relockStatus[0];
    expect(stringToBN(relockItem.amount.toString())).bnEqual(
      reservedTotalAmount,
    );
    const bn = await getBlockNumber();
    expect(stringToBN(relockItem.startingBlock.toString())).bnEqual(new BN(bn));
    expect(stringToBN(relockItem.endingBlockAsBalance.toString())).bnGt(
      new BN(bn),
    );
    vesting = await getVestingStatus(user2.keyRingPair.address, MGA_ASSET_ID);
    expect(vesting.toString()).toEqual("");
  });
  test("As a user, I can use MGX vested from MPL to staking", async () => {
    const reservedAmount = await signTx(
      await getApi(),
      MPL.reserveVestingNativeTokensByVestingIndex(MGA_ASSET_ID),
      user3.keyRingPair,
    ).then((value) => {
      const event = getEventResultFromMangataTx(value, [
        "multiPurposeLiquidity",
        "VestingTokensReserved",
      ]);
      expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      return event.data;
    });
    const reservedTotalAmount = stringToBN(
      reservedAmount[2].toString().split(",").join(""),
    );
    const result = await joinCandidate(
      user3.keyRingPair,
      MGA_ASSET_ID,
      reservedTotalAmount,
      tokenOriginEnum.UnspentReserves,
    );
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const isUserInCandidate = await Staking.isUserInCandidateList(
      user3.keyRingPair.address,
    );
    expect(isUserInCandidate).toBeTruthy();
  });
  test("As a user, I can revert MGX vested from MPL to vesting pallet", async () => {
    const vestingBefore = await getVestingStatus(
      user4.keyRingPair.address,
      MGA_ASSET_ID,
    );
    expect(vestingBefore).not.toBeUndefined();
    const reservedAmount = await signTx(
      await getApi(),
      MPL.reserveVestingNativeTokensByVestingIndex(MGA_ASSET_ID),
      user4.keyRingPair,
    ).then((value) => {
      const event = getEventResultFromMangataTx(value, [
        "multiPurposeLiquidity",
        "VestingTokensReserved",
      ]);
      expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      return event.data;
    });
    const reservedTotalAmount = stringToBN(
      reservedAmount[2].toString().split(",").join(""),
    );
    expect(reservedTotalAmount).bnGt(BN_ZERO);
    const vestingStatus = await getVestingStatus(
      user4.keyRingPair.address,
      MGA_ASSET_ID,
    );
    expect(vestingStatus.toString()).toBeEmpty();

    await signTx(
      await getApi(),
      MPL.unreserveAndRelockInstance(MGA_ASSET_ID, BN_ZERO),
      user4.keyRingPair,
    ).then((events) => {
      const event = getEventResultFromMangataTx(events, [
        "multiPurposeLiquidity",
        "TokensRelockedFromReserve",
      ]);
      expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      return event.data;
    });
    const vestingAfter = await getVestingStatus(
      user4.keyRingPair.address,
      MGA_ASSET_ID,
    );
    expect(vestingAfter).not.toBeUndefined();
    const vestingAfterAsJson = JSON.parse(JSON.stringify(vestingAfter))[0];
    const vestingBeforeAsJson = JSON.parse(JSON.stringify(vestingBefore))[0];
    expect(vestingAfterAsJson.perBlock).toEqual(vestingBeforeAsJson.perBlock);
    expect(vestingBeforeAsJson.startingBlock).toBeLessThan(
      vestingAfterAsJson.startingBlock,
    );
    expect(stringToBN(vestingBeforeAsJson.locked.toString())).bnGt(
      stringToBN(vestingAfterAsJson.locked.toString()),
    );
  });
});
