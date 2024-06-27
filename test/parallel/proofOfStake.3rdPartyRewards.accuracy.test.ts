/*
 *
 * @group 3rdPartyRewards
 */
import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { BN } from "@polkadot/util";
import {
  getThirdPartyRewards,
  waitIfSessionWillChangeInNblocks,
} from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { ProofOfStake } from "../../utils/ProofOfStake";
import "jest-extended";
import { getLiquidityAssetId } from "../../utils/tx";
import {
  waitForRewards,
  waitForSessionChange,
} from "../../utils/eventListeners";
import { BN_ZERO } from "@mangata-finance/sdk";

let testUser1: User;
let testUser2: User;
let testUser3: User;
let sudo: User;

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

    sudo = getSudoUser();
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
      Assets.mintToken(newToken, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser2, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser3, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Sudo.sudoAs(
        testUser1,
        Xyk.createPool(
          GASP_ASSET_ID,
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
          GASP_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken3,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
    );
  });

  describe("Accuracy rewards scenarios", () => {
    it("User liq. is considered on the ongoing session", async () => {
      const testUser = testUser2;
      const liquidityAssetId = await getLiquidityAssetId(newToken, newToken2);
      await waitIfSessionWillChangeInNblocks(6);
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          testUser,
          await ProofOfStake.rewardPool(
            newToken,
            newToken2,
            GASP_ASSET_ID,
            Assets.DEFAULT_AMOUNT.muln(10e6),
            3,
          ),
        ),
        Sudo.sudoAs(
          testUser,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liquidityAssetId,
            Assets.DEFAULT_AMOUNT,
            GASP_ASSET_ID,
          ),
        ),
      );
      await waitForSessionChange();
      // tokens must last one session.
      // corner case about rewarding and activating on the same session
      await waitForSessionChange();
      await Sudo.asSudoFinalized(
        Sudo.sudoAs(
          testUser,
          await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
            liquidityAssetId,
            Assets.DEFAULT_AMOUNT,
            GASP_ASSET_ID,
          ),
        ),
      );
      await waitForRewards(testUser, liquidityAssetId, 40, GASP_ASSET_ID);
      const expectedRewards = BN_ZERO;
      const avl = await getThirdPartyRewards(
        testUser.keyRingPair.address,
        liquidityAssetId,
        GASP_ASSET_ID,
      );
      expect(avl).bnGt(expectedRewards);
    });
  });
});
