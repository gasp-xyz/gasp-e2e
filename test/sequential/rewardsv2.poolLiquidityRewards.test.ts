/*
 *
 * @group rewardsV2Sequential
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { AssetWallet, User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getEnvironmentRequiredVars, stringToBN } from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import {
  mintLiquidity,
  activateLiquidity,
  getLiquidityAssetId,
  burnLiquidity,
  getRewardsInfo,
  claimRewards,
} from "../../utils/tx";
import { setupApi, setupUsers } from "../../utils/setup";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  BN_ZERO,
  MangataGenericEvent,
  MangataInstance,
} from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

const defaultCurrencyValue = new BN(10000000);
const assetAmount = new BN("1000000000000000");

let testUser1: User;
let testUser2: User;
let testUser3: User;
let sudo: User;

let keyring: Keyring;
let secondCurrency: BN;
let liqId: BN;

describe("rewards v2 tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
    [testUser1, testUser2, testUser3] = setupUsers();

    secondCurrency = await Assets.issueAssetToUser(
      sudo,
      defaultCurrencyValue,
      sudo,
      true,
    );

    await setupApi();

    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintToken(secondCurrency, testUser1, Assets.DEFAULT_AMOUNT),
      Assets.mintToken(secondCurrency, testUser2, Assets.DEFAULT_AMOUNT),
      Assets.mintToken(secondCurrency, testUser3, Assets.DEFAULT_AMOUNT),
      Assets.mintNative(testUser1),
      Assets.mintNative(testUser2),
      Assets.mintNative(testUser3),
      Sudo.sudoAs(
        testUser1,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.divn(2),
          secondCurrency,
          Assets.DEFAULT_AMOUNT.divn(2),
        ),
      ),
    );

    liqId = await getLiquidityAssetId(MGA_ASSET_ID, secondCurrency);
  });

  describe("Error cases", () => {
    test("Given a user with Liquidity on non promoted pool When tries to activate Then extrinsic fail", async () => {
      await mintLiquidity(
        testUser1.keyRingPair,
        MGA_ASSET_ID,
        secondCurrency,
        assetAmount,
      );

      await activateLiquidity(testUser1.keyRingPair, liqId, assetAmount).then(
        (result) => {
          const eventResponse = getEventResultFromMangataTx(result);
          expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
          expect(eventResponse.data).toEqual("NotAPromotedPool");
        },
      );
    });
  });

  describe("A user can get rewards", () => {
    let mangata: MangataInstance;
    beforeAll(async () => {
      const { chainUri } = getEnvironmentRequiredVars();
      mangata = await getMangataInstance(chainUri);

      const liqBalance = await mangata.query.getTokenBalance(
        liqId.toString(),
        testUser1.keyRingPair.address,
      );

      await Sudo.batchAsSudoFinalized(
        Assets.promotePool(liqId.toNumber(), 20),
        Sudo.sudoAs(
          testUser1,
          Xyk.mintLiquidity(MGA_ASSET_ID, secondCurrency, assetAmount),
        ),
        Sudo.sudoAs(
          testUser2,
          Xyk.mintLiquidity(MGA_ASSET_ID, secondCurrency, assetAmount),
        ),
        Sudo.sudoAs(
          testUser3,
          Xyk.mintLiquidity(MGA_ASSET_ID, secondCurrency, assetAmount),
        ),
        Sudo.sudoAs(testUser1, Xyk.activateLiquidity(liqId, liqBalance.free)),
      );

      await waitForRewards(testUser1, liqId);
    });
    test("Given a user with Liquidity activated When tries to deactivate Then the user gets all tokens burn and rewards amount are readable in RPC THEN the user can claim them", async () => {
      const availableRewardsBefore = await mangata.rpc.calculateRewardsAmount({
        address: testUser1.keyRingPair.address,
        liquidityTokenId: liqId.toString(),
      });
      const reservedTokens = (
        await mangata.query.getTokenBalance(
          liqId.toString(),
          testUser1.keyRingPair.address,
        )
      ).reserved;

      await burnLiquidity(
        testUser1.keyRingPair,
        MGA_ASSET_ID,
        secondCurrency,
        reservedTokens,
      );
      testUser1.addAsset(MGA_ASSET_ID);
      await testUser1.refreshAmounts(AssetWallet.BEFORE);
      const rewardsAfterBurning = await getRewardsInfo(
        testUser1.keyRingPair.address,
        liqId,
      );
      const events = await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqId)),
      );
      const { claimedAmount } = getClaimedAmount(events);
      await testUser1.refreshAmounts(AssetWallet.AFTER);
      const incrementedMGAs = testUser1
        .getAsset(MGA_ASSET_ID)
        ?.amountAfter.free.sub(
          testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
        );
      expect(incrementedMGAs!).bnGt(BN_ZERO);
      expect(claimedAmount).bnEqual(availableRewardsBefore);
      expect(rewardsAfterBurning.rewardsNotYetClaimed).bnEqual(claimedAmount);
    });
    test("Given a user with Liquidity activated When tries to burn some Then the user gets automatically deactivated that amount And rewards are stored in NotYetClaimed section in rewards info", async () => {
      const availableRewardsBefore = await mangata.rpc.calculateRewardsAmount({
        address: testUser2.keyRingPair.address,
        liquidityTokenId: liqId.toString(),
      });
      const reservedTokens = (
        await mangata.query.getTokenBalance(
          liqId.toString(),
          testUser2.keyRingPair.address,
        )
      ).reserved;

      await burnLiquidity(
        testUser2.keyRingPair,
        MGA_ASSET_ID,
        secondCurrency,
        reservedTokens.divn(2),
      );
      testUser2.addAsset(MGA_ASSET_ID);
      await testUser2.refreshAmounts(AssetWallet.BEFORE);

      const rewardsInfo = await getRewardsInfo(
        testUser2.keyRingPair.address,
        liqId,
      );
      expect(rewardsInfo.activatedAmount).bnEqual(assetAmount.divn(2));
      expect(rewardsInfo.rewardsNotYetClaimed).bnEqual(availableRewardsBefore);
      const events = await claimRewards(testUser2, liqId);
      const { claimedAmount } = getClaimedAmount(events);
      await testUser2.refreshAmounts(AssetWallet.AFTER);
      const incrementedMGAs = testUser2
        .getAsset(MGA_ASSET_ID)
        ?.amountAfter.free.sub(
          testUser2.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
        );
      expect(incrementedMGAs!.abs()).bnGt(BN_ZERO);
      expect(claimedAmount).bnGt(BN_ZERO);
      expect(availableRewardsBefore).bnGt(BN_ZERO);
      expect(availableRewardsBefore).bnLte(claimedAmount);
      const rewardsInfoAfterClaim = await getRewardsInfo(
        testUser2.keyRingPair.address,
        liqId,
      );
      expect(rewardsInfoAfterClaim.rewardsNotYetClaimed).bnEqual(BN_ZERO);
      expect(rewardsInfoAfterClaim.activatedAmount).bnEqual(
        assetAmount.divn(2),
      );
    });

    test("Given a user with Liquidity activated When tries to mint some more Then the user activated amount will grow on that value", async () => {
      testUser3.addAsset(liqId);
      await testUser3.refreshAmounts(AssetWallet.BEFORE);

      const mintingLiquidity = await mintLiquidity(
        testUser3.keyRingPair,
        MGA_ASSET_ID,
        secondCurrency,
        defaultCurrencyValue,
      );

      const tokensReservedValue: BN[] = mintingLiquidity
        .filter(
          (item) =>
            item.method === "LiquidityActivated" &&
            item.section === "proofOfStake",
        )
        .map((x) => new BN(x.eventData[2].data.toString()));

      await testUser3.refreshAmounts(AssetWallet.AFTER);

      const reservedValueBefore =
        testUser3.getAsset(liqId)?.amountBefore.reserved!;
      const reservedValueAfter =
        testUser3.getAsset(liqId)?.amountAfter.reserved!;

      expect(reservedValueBefore.add(tokensReservedValue[0])).bnEqual(
        reservedValueAfter,
      );
    });
  });
});

function getClaimedAmount(events: MangataGenericEvent[]) {
  const data = events.filter((x) => x.method === "RewardsClaimed")[0].eventData;
  const address = data[0].data.toString();
  const token = stringToBN(data[1].data.toString());
  const claimedAmount = stringToBN(data[2].data.toString());
  return { claimedAmount, token, address };
}
