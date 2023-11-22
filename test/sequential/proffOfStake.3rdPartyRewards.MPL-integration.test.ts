/*
 *
 * @group rewardsV2Sequential
 */
import { getApi, initApi } from "../../utils/api";
import { PalletProofOfStakeThirdPartyActivationKind } from "@polkadot/types/lookup";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import {
  getEnvironmentRequiredVars,
  getMultiPurposeLiquidityStatus,
} from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { setupApi, setupUsers } from "../../utils/setup";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_ONE, signTx } from "@mangata-finance/sdk";
import { ProofOfStake } from "../../utils/ProofOfStake";
import { getLiquidityAssetId } from "../../utils/tx";
import { testLog } from "../../utils/Logger";
import { Staking, tokenOriginEnum } from "../../utils/Staking";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";

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
    [testUser1, testUser2, testUser3, testUser4] = setupUsers();
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
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser2, Assets.DEFAULT_AMOUNT),
      Assets.mintToken(newToken, testUser3, Assets.DEFAULT_AMOUNT),
      Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser2),
      Assets.mintNative(testUser3),
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
    );
    testLog.getLog().info("liqId: " + liqId.toString());
  });

  describe("MPL integration", () => {
    test("User with: stakedUnactivatedReserves", async () => {
      await Staking.joinAsCandidateWithUser(testUser4, liqId);
      const amountToDelegate = new BN(
        await getApi()!.consts.parachainStaking.minDelegation,
      ).addn(1234567);
      await signTx(
        getApi(),
        await Staking.delegate(
          testUser4.keyRingPair.address,
          amountToDelegate,
          tokenOriginEnum.AvailableBalance,
        ),
        testUser1.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      const from: PalletProofOfStakeThirdPartyActivationKind = {
        activatekind: "StakedUnactivatedReserves",
      } as any as PalletProofOfStakeThirdPartyActivationKind;

      await Sudo.batchAsSudoFinalized(
        ...(await rewardAndActivatePool(
          newToken,
          testUser1,
          liqId,
          amountToDelegate.sub(BN_ONE),
          from,
        )),
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      const mpl = await getMultiPurposeLiquidityStatus(
        testUser1.keyRingPair.address,
        liqId,
      );
      expect(mpl.stakedAndActivatedReserves).toEqual(amountToDelegate.subn(1));
      expect(mpl.stakedUnactivatedReserves).toEqual(BN_ONE);
    });
  });
});
async function rewardAndActivatePool(
  newToken: BN,
  testUser1: User,
  liqId: BN,
  amountToActivate: BN = Assets.DEFAULT_AMOUNT.divn(10),
  from: PalletProofOfStakeThirdPartyActivationKind | null | string = null,
) {
  return [
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
      testUser1,
      await ProofOfStake.activateLiquidityFor3rdpartyRewards(
        liqId,
        amountToActivate,
        newToken,
        from,
      ),
    ),
  ];
}
