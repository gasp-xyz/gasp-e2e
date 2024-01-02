/*
 *
 * @group 3rdPartyRewards
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
import { ProofOfStake } from "../../utils/ProofOfStake";
import "jest-extended";
import { getLiquidityAssetId } from "../../utils/tx";
import { signTx } from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";

let testUser: User;
let sudo: User;

let keyring: Keyring;
let newToken: BN;
let newToken2: BN;
let liqId: BN;
let liqId2: BN;

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  });

  beforeEach(async () => {
    [testUser] = setupUsers();
    [newToken, newToken2] = await Assets.setupUserWithCurrencies(
      sudo,
      [Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT],
      sudo,
      true,
    );

    await setupApi();
    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintToken(newToken2, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT.muln(2)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Sudo.sudoAs(
        sudo,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken2,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
    );
    liqId = await getLiquidityAssetId(MGA_ASSET_ID, newToken2);
  });

  describe("Activation rewards scenarios", () => {
    test("GIVEN promoted pool MGX-Token2 AND user with liquidity tokens for MGX-Token2 WHEN user tries to activate 3rd party rewards for Token1 THEN receive error", async () => {
      await Sudo.batchAsSudoFinalized(
        Assets.promotePool(liqId.toNumber(), 20),
        Assets.mintToken(liqId, testUser, Assets.DEFAULT_AMOUNT),
      );

      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotAPromotedPool");
      });
    });

    test("GIVEN promoted pool MGX-Token2, pool MGX-Token1 AND user without liquidity tokens for MGX-Token2 WHEN  user tries to activate 3rd party rewards for Token1 THEN receive error", async () => {
      await Sudo.batchAsSudoFinalized(
        Assets.mintToken(newToken, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
        Sudo.sudoAs(
          sudo,
          Xyk.createPool(
            MGA_ASSET_ID,
            Assets.DEFAULT_AMOUNT.muln(20e6),
            newToken,
            Assets.DEFAULT_AMOUNT.muln(20e6),
          ),
        ),
        Assets.promotePool(liqId.toNumber(), 20),
      );
      liqId2 = await getLiquidityAssetId(MGA_ASSET_ID, newToken);
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          sudo,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken2,
            newToken,
            Assets.DEFAULT_AMOUNT.muln(10e6),
            5,
          ),
        ),
        Assets.promotePool(liqId2.toNumber(), 20),
      );
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotEnoughAssets");
      });
    });

    test("GIVEN promoted pool MGX-Token2, pool MGX-Token1 AND user with liquidity tokens for MGX-Token2 WHEN user activates 3rd party rewards for Token1, waits and claims all rewards THEN operation is successful", async () => {
      await Sudo.batchAsSudoFinalized(
        Assets.mintToken(newToken, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
        Assets.mintToken(liqId, testUser, Assets.DEFAULT_AMOUNT.muln(2)),
        Sudo.sudoAs(
          sudo,
          Xyk.createPool(
            MGA_ASSET_ID,
            Assets.DEFAULT_AMOUNT.muln(20e6),
            newToken,
            Assets.DEFAULT_AMOUNT.muln(20e6),
          ),
        ),
        Assets.promotePool(liqId.toNumber(), 20),
      );
      liqId2 = await getLiquidityAssetId(MGA_ASSET_ID, newToken);
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          sudo,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken2,
            newToken,
            Assets.DEFAULT_AMOUNT.muln(10e6),
            5,
          ),
        ),
        Assets.promotePool(liqId2.toNumber(), 20),
      );
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotAPromotedPool");
      });
    });
  });
});
