/*
 *
 * @group 3rdPartyRewards
 */
import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import {
  getEnvironmentRequiredVars,
  stringToBN,
  waitIfSessionWillChangeInNblocks,
} from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { setupApi, setupUsers } from "../../utils/setup";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { ProofOfStake } from "../../utils/ProofOfStake";
import "jest-extended";
import {
  calculate_buy_price_local_no_fee,
  getBalanceOfAssetStr,
  getBalanceOfPool,
  getLiquidityAssetId,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import {
  getEventErrorFromSudo,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import { BN_MILLION } from "@mangata-finance/sdk";

let testUser1: User;
let testUser2: User;
let testUser3: User;
let sudo: User;

let keyring: Keyring;
let newToken: BN;
let newToken2: BN;
let newToken3: BN;

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
    [testUser1, testUser2, testUser3] = setupUsers();
    [newToken, newToken2, newToken3] = await Assets.setupUserWithCurrencies(
      sudo,
      [Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT],
      sudo,
      true,
    );

    await setupApi();
    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser2, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser3, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Sudo.sudoAs(
        testUser1,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
      Sudo.sudoAs(
        testUser2,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken2,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
      Sudo.sudoAs(
        testUser2,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken3,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
      Sudo.sudoAs(
        testUser3,
        Xyk.createPool(
          newToken2,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken3,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
    );
  });

  describe("Setup rewards scenarios", () => {
    test("Multiple users can reward the same pool - same tokens", async () => {
      await waitIfSessionWillChangeInNblocks(4);
      const liqId = await getLiquidityAssetId(MGA_ASSET_ID, newToken);
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          testUser1,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken,
            newToken,
            Assets.DEFAULT_AMOUNT.muln(10e6),
            3,
          ),
        ),
        Sudo.sudoAs(
          testUser2,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken,
            newToken,
            Assets.DEFAULT_AMOUNT.muln(10e6),
            2,
          ),
        ),
      );
      const rewardedPools = await ProofOfStake.rewardsSchedulesList([newToken]);
      expect(rewardedPools.length).toBe(2);
      expect(
        rewardedPools.filter(
          (x) =>
            stringToBN(x.amountPerSession.toString()).toString() ===
            //3 because is 3 sessions.
            Assets.DEFAULT_AMOUNT.muln(10e6).divn(3).toString(),
        ),
      ).toHaveLength(1);
      expect(
        rewardedPools.filter(
          (x) =>
            stringToBN(x.amountPerSession.toString()).toString() ===
            //2 because is 2 sessions.
            Assets.DEFAULT_AMOUNT.muln(10e6).divn(2).toString(),
        ),
      ).toHaveLength(1);

      expect(
        rewardedPools.filter(
          (x) =>
            stringToBN(x.liqToken.toString()).toString() === liqId.toString(),
        ),
      ).toHaveLength(2);
    });
    test("Multiple users can reward multiple pools - token does not belong to the promoted pool", async () => {
      // const liqId = await getLiquidityAssetId(MGA_ASSET_ID, newToken);
      const rewardsPalletAddress =
        "5EYCAe5j84jdabP3t3DW6E1ahTsWGVqf2nzgikxGJDM1CMyB";
      const balanceBefore = await getBalanceOfAssetStr(
        newToken2,
        rewardsPalletAddress,
      );
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          testUser2,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken,
            newToken2,
            Assets.DEFAULT_AMOUNT.muln(1e6),
            3,
          ),
        ),
        Sudo.sudoAs(
          testUser2,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken2,
            newToken2,
            Assets.DEFAULT_AMOUNT.muln(1e6),
            2,
          ),
        ),
      );
      const balanceAfter = await getBalanceOfAssetStr(
        newToken2,
        rewardsPalletAddress,
      );
      expect(
        balanceAfter.free.sub(Assets.DEFAULT_AMOUNT.muln(1e6).muln(2)),
      ).bnEqual(balanceBefore.free);
      const rewardedPools = await ProofOfStake.rewardsSchedulesList([
        newToken2,
      ]);
      expect(rewardedPools.length).toBe(2);
    });
    test("A user can reward a pool that is not directly paired with mgx", async () => {
      // const liqId = await getLiquidityAssetId(MGA_ASSET_ID, newToken);
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          testUser3,
          await ProofOfStake.rewardPool(
            newToken2,
            newToken3,
            newToken3,
            Assets.DEFAULT_AMOUNT.muln(1e6),
            3,
          ),
        ),
      ).then((x) => {
        const event = getEventResultFromMangataTx(x);
        expect(event.state).toBe(ExtrinsicResult.ExtrinsicSuccess);
      });
      const rewardedPools = await ProofOfStake.rewardsSchedulesList([
        newToken3,
      ]);
      expect(rewardedPools.length).toBe(1);
    });
    test("A user can reward in mgx", async () => {
      const liqId = await getLiquidityAssetId(newToken3, newToken2);
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          testUser3,
          await ProofOfStake.rewardPool(
            newToken3,
            newToken2,
            MGA_ASSET_ID,
            Assets.DEFAULT_AMOUNT.muln(1e6),
            3,
          ),
        ),
      ).then((x) => {
        const event = getEventResultFromMangataTx(x);
        expect(event.state).toBe(ExtrinsicResult.ExtrinsicSuccess);
      });
      const rewardedPools = await ProofOfStake.rewardsSchedulesList([
        MGA_ASSET_ID,
      ]);
      const filtered = rewardedPools.filter((x) =>
        stringToBN(x.liqToken.toString()).eq(liqId),
      );
      expect(filtered.length).toBe(1);
    });
    test("Rewards schedule must last at least 1 session ahead", async () => {
      await waitIfSessionWillChangeInNblocks(3);
      await Sudo.asSudoFinalized(
        Sudo.sudoAs(
          testUser3,
          await ProofOfStake.rewardPool(
            newToken2,
            newToken3,
            MGA_ASSET_ID,
            Assets.DEFAULT_AMOUNT.muln(1e6),
            0,
          ),
        ),
      ).then(async (x) => {
        // const event = getEventResultFromMangataTx(x);
        const sudoEvent = await getEventErrorFromSudo(x);
        expect(sudoEvent.state).toBe(ExtrinsicResult.ExtrinsicFailed);
      });
    });
    test("Min liq is required setup rewards", async () => {
      await waitIfSessionWillChangeInNblocks(4);
      await Sudo.asSudoFinalized(
        Sudo.sudoAs(
          testUser3,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken,
            MGA_ASSET_ID,
            new BN(3).mul(BN_MILLION).mul(Assets.MG_UNIT).addn(1),
            1,
          ),
        ),
      ).then(async (x) => {
        // const event = getEventResultFromMangataTx(x);
        const sudoEvent = await getEventErrorFromSudo(x);
        expect(sudoEvent.state).toBe(ExtrinsicResult.ExtrinsicSuccess);
      });
      await waitIfSessionWillChangeInNblocks(4);
      await Sudo.asSudoFinalized(
        Sudo.sudoAs(
          testUser3,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken,
            MGA_ASSET_ID,
            new BN(3).mul(BN_MILLION).mul(Assets.MG_UNIT).subn(1),
            2,
          ),
        ),
      ).then(async (x) => {
        // const event = getEventResultFromMangataTx(x);
        const sudoEvent = await getEventErrorFromSudo(x);
        expect(sudoEvent.state).toBe(ExtrinsicResult.ExtrinsicFailed);
        expect(sudoEvent.data).toBe("TooLittleRewards");
      });
    });
    test("Min liq valuation is required setup rewards", async () => {
      const pool = await getBalanceOfPool(MGA_ASSET_ID, newToken);
      const thresholdAmount = calculate_buy_price_local_no_fee(
        pool[0],
        pool[1],
        new BN(3).mul(BN_MILLION).mul(Assets.MG_UNIT),
      );
      await waitIfSessionWillChangeInNblocks(4);
      await Sudo.asSudoFinalized(
        Sudo.sudoAs(
          testUser3,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken,
            newToken,
            thresholdAmount.addn(1),
            1,
          ),
        ),
      ).then(async (x) => {
        // const event = getEventResultFromMangataTx(x);
        const sudoEvent = await getEventErrorFromSudo(x);
        expect(sudoEvent.state).toBe(ExtrinsicResult.ExtrinsicSuccess);
      });
      await waitIfSessionWillChangeInNblocks(4);
      await Sudo.asSudoFinalized(
        Sudo.sudoAs(
          testUser3,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken,
            newToken,
            thresholdAmount.subn(1),
            1,
          ),
        ),
      ).then(async (x) => {
        // const event = getEventResultFromMangataTx(x);
        const sudoEvent = await getEventErrorFromSudo(x);
        expect(sudoEvent.state).toBe(ExtrinsicResult.ExtrinsicFailed);
        expect(sudoEvent.data).toBe("TooLittleRewards");
      });
    });
  });
});
