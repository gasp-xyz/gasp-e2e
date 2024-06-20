/*
 *
 * @group 3rdPartyRewards
 */
import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { BN } from "@polkadot/util";
import {
  getThirdPartyRewards,
  getUserBalanceOfToken,
  stringToBN,
} from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { ProofOfStake } from "../../utils/ProofOfStake";
import "jest-extended";
import { getLiquidityAssetId } from "../../utils/tx";
import {
  waitForRewards,
  waitForSessionChange,
} from "../../utils/eventListeners";
import { BN_ZERO, signTx } from "@mangata-finance/sdk";

let testUser1: User;
let testUser2: User;
let testUser3: User;
let testUser4: User;
let sudo: User;

let newToken: BN;
let newToken2: BN;
let newToken3: BN;
let newToken4: BN;

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    sudo = getSudoUser();
    [testUser1, testUser2, testUser3, testUser4] = setupUsers();
    [newToken, newToken2, newToken3, newToken4] =
      await Assets.setupUserWithCurrencies(
        sudo,
        [
          Assets.DEFAULT_AMOUNT,
          Assets.DEFAULT_AMOUNT,
          Assets.DEFAULT_AMOUNT,
          Assets.DEFAULT_AMOUNT,
        ],
        sudo,
        true,
      );

    await setupApi();
    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken4, testUser4, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken4, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken4, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken4, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser2, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser3, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser4, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
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
          newToken,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken2,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
      Sudo.sudoAs(
        testUser3,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken3,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
      Sudo.sudoAs(
        testUser4,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken4,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
    );
  });

  describe("Claim rewards scenarios", () => {
    it("When rewards not available, should return error", async () => {
      const liquidityAssetId = await getLiquidityAssetId(
        MGA_ASSET_ID,
        newToken,
      );
      let events = await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liquidityAssetId, MGA_ASSET_ID),
        testUser1.keyRingPair,
      );
      let errors = events.filter(
        (x) => x.method === "ExtrinsicFailed" && x.section === "system",
      );
      expect(errors.length).toBe(1);
      expect(errors[0].error!.name).toBe("NotAPromotedPool");

      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          testUser1,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken,
            MGA_ASSET_ID,
            Assets.DEFAULT_AMOUNT.muln(10e6),
            2,
          ),
        ),
      );
      events = await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liquidityAssetId, MGA_ASSET_ID),
        testUser1.keyRingPair,
      );
      errors = events.filter(
        (x) => x.method === "ExtrinsicFailed" && x.section === "system",
      );
      expect(errors.length).toBe(1);
      expect(errors[0].error!.name).toBe("NoThirdPartyPartyRewardsToClaim");
    });
    it("Rewards are divided in n-sessions", async () => {
      const testUser = testUser2;
      const liquidityAssetId = await getLiquidityAssetId(newToken, newToken2);
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          testUser,
          await ProofOfStake.rewardPool(
            newToken,
            newToken2,
            MGA_ASSET_ID,
            Assets.DEFAULT_AMOUNT.muln(10e6),
            2,
          ),
        ),
        Sudo.sudoAs(
          testUser,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liquidityAssetId,
            Assets.DEFAULT_AMOUNT,
            MGA_ASSET_ID,
          ),
        ),
      );

      await waitForRewards(testUser, liquidityAssetId, 80, MGA_ASSET_ID);
      // its 2 sessions, so 50% of rewards should be available
      const expectedRewards = Assets.DEFAULT_AMOUNT.muln(10e6).divn(2);
      const avl = await getThirdPartyRewards(
        testUser.keyRingPair.address,
        liquidityAssetId,
        MGA_ASSET_ID,
      );
      expect(avl).bnEqual(expectedRewards);
    });
    it("Two users activated, one in one exec, other in two - check balances", async () => {
      const oneUser = testUser2;
      const otherUser = testUser3; //testUser3 already have some mgx-token3 minted.
      const liquidityAssetId = await getLiquidityAssetId(
        MGA_ASSET_ID,
        newToken3,
      );
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          oneUser,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken3,
            MGA_ASSET_ID,
            Assets.DEFAULT_AMOUNT.muln(1e6),
            5,
          ),
        ),
        Sudo.sudoAs(
          oneUser,
          Xyk.mintLiquidity(
            MGA_ASSET_ID,
            newToken3,
            Assets.DEFAULT_AMOUNT,
            Assets.DEFAULT_AMOUNT.muln(2),
          ),
        ),
        Sudo.sudoAs(
          oneUser,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liquidityAssetId,
            Assets.DEFAULT_AMOUNT,
            MGA_ASSET_ID,
          ),
        ),
        Sudo.sudoAs(
          otherUser,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liquidityAssetId,
            Assets.DEFAULT_AMOUNT.divn(2),
            MGA_ASSET_ID,
          ),
        ),
        Sudo.sudoAs(
          otherUser,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liquidityAssetId,
            Assets.DEFAULT_AMOUNT.divn(2),
            MGA_ASSET_ID,
          ),
        ),
      );
      await waitForRewards(oneUser, liquidityAssetId, 40, MGA_ASSET_ID);
      const rewardsOne = await getThirdPartyRewards(
        oneUser.keyRingPair.address,
        liquidityAssetId,
        MGA_ASSET_ID,
      );
      const rewardsOther = await getThirdPartyRewards(
        otherUser.keyRingPair.address,
        liquidityAssetId,
        MGA_ASSET_ID,
      );
      expect(rewardsOne).bnGt(BN_ZERO);
      expect(rewardsOther).bnGt(BN_ZERO);
      expect(rewardsOne).bnEqual(rewardsOther);
      const events = await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          oneUser,
          await ProofOfStake.claim3rdpartyRewards(
            liquidityAssetId,
            MGA_ASSET_ID,
          ),
        ),
        Sudo.sudoAs(
          otherUser,
          await ProofOfStake.claim3rdpartyRewards(
            liquidityAssetId,
            MGA_ASSET_ID,
          ),
        ),
      );
      const filtered = events.filter(
        (x) => x.method === "ThirdPartyRewardsClaimed",
      );
      expect(filtered.length).toBe(2);
      filtered.forEach((event) => {
        expect(event.section).toBe("proofOfStake");
        expect(event.method).toBe("ThirdPartyRewardsClaimed");
        expect(
          stringToBN(event.eventData[1].data.toHuman()!.toString()),
        ).bnEqual(liquidityAssetId);
        expect(
          stringToBN(event.eventData[2].data.toHuman()!.toString()),
        ).bnEqual(MGA_ASSET_ID);
        expect(
          stringToBN(event.eventData[3].data.toHuman()!.toString()),
        ).bnEqual(rewardsOne);
      });

      // now another user activates some more, so the rewards should be split

      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          otherUser,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liquidityAssetId,
            Assets.DEFAULT_AMOUNT,
            MGA_ASSET_ID,
          ),
        ),
      );
      await waitForRewards(otherUser, liquidityAssetId, 40, MGA_ASSET_ID);
      const balanceOne = await getUserBalanceOfToken(MGA_ASSET_ID, oneUser);
      const balanceOther = await getUserBalanceOfToken(MGA_ASSET_ID, otherUser);
      const rewardsOne2 = await getThirdPartyRewards(
        oneUser.keyRingPair.address,
        liquidityAssetId,
        MGA_ASSET_ID,
      );
      const rewardsOther2 = await getThirdPartyRewards(
        otherUser.keyRingPair.address,
        liquidityAssetId,
        MGA_ASSET_ID,
      );
      expect(rewardsOne2).bnEqual(rewardsOther2.divn(2));
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          oneUser,
          await ProofOfStake.claim3rdpartyRewards(
            liquidityAssetId,
            MGA_ASSET_ID,
          ),
        ),
        Sudo.sudoAs(
          otherUser,
          await ProofOfStake.claim3rdpartyRewards(
            liquidityAssetId,
            MGA_ASSET_ID,
          ),
        ),
      );
      expect((await getUserBalanceOfToken(MGA_ASSET_ID, oneUser)).free).bnEqual(
        balanceOne.free.add(rewardsOne2),
      );
      expect(
        (await getUserBalanceOfToken(MGA_ASSET_ID, otherUser)).free,
      ).bnEqual(balanceOther.free.add(rewardsOther2));
    });
    it("Rewards are not given for the ongoing session it got scheduled", async () => {
      const eve = testUser4;
      const alice = testUser1;
      const bob = testUser2;
      const testToken = newToken4;
      const liquidityAssetId = await getLiquidityAssetId(
        MGA_ASSET_ID,
        testToken,
      );
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          alice,
          Xyk.mintLiquidity(
            MGA_ASSET_ID,
            testToken,
            Assets.DEFAULT_AMOUNT,
            Assets.DEFAULT_AMOUNT.muln(2),
          ),
        ),
        Sudo.sudoAs(
          bob,
          Xyk.mintLiquidity(
            MGA_ASSET_ID,
            testToken,
            Assets.DEFAULT_AMOUNT,
            Assets.DEFAULT_AMOUNT.muln(2),
          ),
        ),
        Sudo.sudoAs(
          eve,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            testToken,
            MGA_ASSET_ID,
            Assets.DEFAULT_AMOUNT.muln(1e6),
            5,
          ),
        ),
        Sudo.sudoAs(
          bob,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liquidityAssetId,
            Assets.DEFAULT_AMOUNT,
            MGA_ASSET_ID,
          ),
        ),
        Sudo.sudoAs(
          alice,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liquidityAssetId,
            Assets.DEFAULT_AMOUNT,
            MGA_ASSET_ID,
          ),
        ),
      );
      await waitForSessionChange();

      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          eve,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            testToken,
            MGA_ASSET_ID,
            Assets.DEFAULT_AMOUNT.muln(1e6),
            5,
          ),
        ),
        Sudo.sudoAs(
          eve,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liquidityAssetId,
            Assets.DEFAULT_AMOUNT,
            MGA_ASSET_ID,
          ),
        ),
      );
      await waitForSessionChange();
      const rewardsAlice = await getThirdPartyRewards(
        alice.keyRingPair.address,
        liquidityAssetId,
        MGA_ASSET_ID,
      );
      const rewardsBob = await getThirdPartyRewards(
        bob.keyRingPair.address,
        liquidityAssetId,
        MGA_ASSET_ID,
      );
      const rewardsEve = await getThirdPartyRewards(
        eve.keyRingPair.address,
        liquidityAssetId,
        MGA_ASSET_ID,
      );
      // here we test that rewards are not given for the ongoing session it got scheduled,
      // alice and bob activated in the same session, but eve activated in the next one
      // so alice and bob should have the same rewards, and eve has the same rewards as alice and bob
      expect(rewardsAlice).bnGt(BN_ZERO);
      expect(rewardsAlice).bnEqual(rewardsBob);
      expect(rewardsAlice).bnEqual(rewardsEve);

      await waitForSessionChange();
      const rewardsAlice2 = await getThirdPartyRewards(
        alice.keyRingPair.address,
        liquidityAssetId,
        MGA_ASSET_ID,
      );
      const rewardsBob2 = await getThirdPartyRewards(
        bob.keyRingPair.address,
        liquidityAssetId,
        MGA_ASSET_ID,
      );
      const rewardsEve2 = await getThirdPartyRewards(
        eve.keyRingPair.address,
        liquidityAssetId,
        MGA_ASSET_ID,
      );
      expect(rewardsAlice2).bnGt(BN_ZERO);
      expect(rewardsAlice2).bnEqual(rewardsBob2);
      expect(rewardsAlice2).bnEqual(rewardsEve2);
    });
  });
});
