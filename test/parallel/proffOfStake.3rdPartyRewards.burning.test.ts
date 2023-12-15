/*
 *
 * @group 3rdPartyRewards
 *
 */
import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { setupApi, setupUsers } from "../../utils/setup";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_ZERO, signTx } from "@mangata-finance/sdk";
import { ProofOfStake } from "../../utils/ProofOfStake";
import { getBalanceOfAsset, getLiquidityAssetId } from "../../utils/tx";
import { testLog } from "../../utils/Logger";
import { Staking } from "../../utils/Staking";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Vesting } from "../../utils/Vesting";
import { MPL } from "../../utils/MPL";

let testUser0: User;
let testUser1: User;
let testUser2: User;
let testUser3: User;
let testUser4: User;
let sudo: User;

let keyring: Keyring;
let newToken: BN;
let liqId: BN;

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
    [testUser0, testUser1, testUser2, testUser3, testUser4] = setupUsers();
    newToken = new BN(18);
    newToken = await Assets.issueAssetToUser(
      sudo,
      Assets.DEFAULT_AMOUNT,
      sudo,
      true,
    );

    await setupApi();
    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintToken(newToken, testUser0, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser2, Assets.DEFAULT_AMOUNT),
      Assets.mintToken(newToken, testUser3, Assets.DEFAULT_AMOUNT),
      Assets.mintToken(newToken, testUser4, Assets.DEFAULT_AMOUNT),
      Assets.mintNative(testUser0, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser2),
      Assets.mintNative(testUser3),
      Assets.mintNative(testUser4),
      Sudo.sudoAs(
        testUser1,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
    );
    liqId = await getLiquidityAssetId(MGA_ASSET_ID, newToken);
    await Sudo.batchAsSudoFinalized(
      Sudo.sudo(Staking.addStakingLiquidityToken(liqId)),
      Sudo.sudoAs(
        testUser2,
        Xyk.mintLiquidity(
          MGA_ASSET_ID,
          newToken,
          Assets.DEFAULT_AMOUNT.divn(2),
          Assets.DEFAULT_AMOUNT,
        ),
      ),
      Sudo.sudoAs(
        testUser3,
        Xyk.mintLiquidity(
          MGA_ASSET_ID,
          newToken,
          Assets.DEFAULT_AMOUNT.divn(2),
          Assets.DEFAULT_AMOUNT,
        ),
      ),
      Sudo.sudo(
        await Vesting.forceVested(
          sudo.keyRingPair.address,
          testUser4,
          Assets.DEFAULT_AMOUNT.divn(2),
          MGA_ASSET_ID,
          100,
        ),
      ),
      Assets.promotePool(liqId.toNumber(), 20),
      Sudo.sudoAs(
        testUser4,
        Xyk.mintLiquidityUsingVested(
          newToken,
          Assets.DEFAULT_AMOUNT.divn(2),
          Assets.DEFAULT_AMOUNT,
        ),
      ),
      Sudo.sudoAs(
        testUser4,
        MPL.reserveVestingLiquidityTokensByVestingIndex(liqId),
      ),
    );
    testLog.getLog().info("liqId: " + liqId.toString());
  });

  describe("Burn liquidity", () => {
    beforeAll(async () => {
      await Sudo.batchAsSudoFinalized(
        ...(await ProofOfStake.rewardAndActivatePool(
          newToken,
          testUser0,
          liqId,
          Assets.DEFAULT_AMOUNT,
          null,
        )),
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
    });
    test("GIVEN a user with N tokens activated for 3rd party, WHEN the user wants to burn ( all the existing - N ) THEN the operation works", async () => {
      const testUser = testUser1;
      const amountToActivate = Assets.DEFAULT_AMOUNT.divn(10);
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          amountToActivate,
          newToken,
          null,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      const amountToBurn = (await getBalanceOfAsset(liqId, testUser)).free.sub(
        amountToActivate,
      );
      await signTx(
        getApi(),
        Xyk.burnLiquidity(newToken, MGA_ASSET_ID, amountToBurn),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      expect(amountToBurn).bnGt(BN_ZERO);
      expect((await getBalanceOfAsset(liqId, testUser)).free).bnGt(BN_ZERO);
      expect((await getBalanceOfAsset(liqId, testUser)).reserved).bnEqual(
        amountToActivate,
      );
      expect(
        await ProofOfStake.activatedLiquidityForSchedules(
          liqId,
          testUser.keyRingPair.address,
          newToken,
        ),
      ).bnEqual(amountToActivate);
    });
  });
});
