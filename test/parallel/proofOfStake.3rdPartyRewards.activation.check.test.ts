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
      Assets.mintToken(newToken, sudo, Assets.DEFAULT_AMOUNT.muln(2)),
      Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT.muln(2)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(2)),
      Sudo.sudoAs(
        sudo,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT,
          newToken,
          Assets.DEFAULT_AMOUNT,
        ),
      ),
    );
    liqId = await getLiquidityAssetId(MGA_ASSET_ID, newToken);
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
          newToken2,
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
