import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  calculate_buy_price_id_rpc,
  calculate_buy_price_rpc,
  calculate_sell_price_local_no_fee,
  calculate_sell_price_rpc,
  getBalanceOfPool,
  getTreasury,
  getTreasuryBurn,
} from "../../utils/tx";
import { Xyk } from "../../utils/xyk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { AssetWallet, User } from "../../utils/User";
import {
  calculateFees,
  findBlockWithExtrinsicSigned,
  getBlockNumber,
  getFeeLockMetadata,
  getTokensDiffForBlockAuthor,
} from "../../utils/utils";
import { BN_ONE, BN_ZERO } from "gasp-sdk";
import { testLog } from "../../utils/Logger";
import { Assets } from "../../utils/Assets";
import { signSendFinalized } from "../../utils/sign";
import { getApi } from "../../utils/api";
import { SudoDB } from "../../utils/SudoDB";

const asset_amount1 = new BN(500000);
const asset_amount2 = asset_amount1.div(new BN(2));

async function validateTreasuryAmountsEqual(
  assetId: BN,
  treasuryExpectation: BN[],
) {
  const [expectedTreasury, expectedTreasuryBurn] = treasuryExpectation;
  const treasuryAsset = await getTreasury(assetId);
  const treasuryBurn = await getTreasuryBurn(assetId);

  expect(treasuryAsset).bnEqual(expectedTreasury);
  expect(treasuryBurn).bnEqual(expectedTreasuryBurn);
}

/**
 * @group xyk
 * @group api
 * @group sequential
 * @group critical
 */
describe("xyk-pallet - treasury tests [Mangata]: on treasury we store", () => {
  let currency: BN;
  let user: User;

  beforeAll(async () => {
    await setupApi();
    [user] = setupUsers();

    currency = await SudoDB.getInstance().getTokenId();
    user.addAsset(currency);

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user),
      Assets.mintToken(currency, user),
      Sudo.sudoAs(
        user,
        Xyk.createPool(MGA_ASSET_ID, asset_amount1, currency, asset_amount2),
      ),
    );

    await user.refreshAmounts(AssetWallet.BEFORE);
  });

  it("assets won when assets are sold [Selling Mangata] - 5", async () => {
    const sellAssetAmount = new BN(10000);
    const treasuryBefore = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnBefore = await getTreasuryBurn(MGA_ASSET_ID);
    testLog.getLog().debug(`treasury before: ${treasuryBefore}`);

    await signSendFinalized(
      Xyk.sellAsset(MGA_ASSET_ID, currency, sellAssetAmount),
      user,
    );
    await user.refreshAmounts(AssetWallet.AFTER);

    const { treasury } = calculateFees(sellAssetAmount);
    const treasuryAfter = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnAfter = await getTreasuryBurn(MGA_ASSET_ID);
    testLog
      .getLog()
      .debug(`treasury after: ${treasuryBefore}, fee: ${treasury}`);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(treasury));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(currency, [BN_ZERO, BN_ZERO]);
  });

  it("assets won when assets are bought [Buying Mangata]", async () => {
    const buyAssetAmount = new BN(10000);
    const treasuryBefore = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnBefore = await getTreasuryBurn(MGA_ASSET_ID);
    const sellPrice = await calculate_buy_price_rpc(
      asset_amount2,
      asset_amount1,
      buyAssetAmount,
    );
    const { treasury } = calculateFees(sellPrice);
    testLog
      .getLog()
      .debug(
        `treasury before: ${treasuryBefore}, sell price: ${sellPrice}, fee: ${treasury}`,
      );

    await signSendFinalized(
      Xyk.buyAsset(currency, MGA_ASSET_ID, buyAssetAmount),
      user,
    );

    const poolBalance = await getBalanceOfPool(MGA_ASSET_ID, currency);
    const feeInMGAPrice = await calculate_sell_price_rpc(
      poolBalance[1],
      poolBalance[0],
      treasury,
    );
    await user.refreshAmounts(AssetWallet.AFTER);
    const treasuryAfter = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnAfter = await getTreasuryBurn(MGA_ASSET_ID);
    testLog
      .getLog()
      .debug(`treasury after: ${treasuryAfter}, fee: ${feeInMGAPrice}`);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(feeInMGAPrice));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(currency, [BN_ZERO, BN_ZERO]);
  });

  it("assets won when assets are sold [Selling other in MGA pool] - 6", async () => {
    const sellAssetAmount = new BN(20000);
    const treasuryBefore = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnBefore = await getTreasuryBurn(MGA_ASSET_ID);
    const { treasury } = calculateFees(sellAssetAmount);
    testLog
      .getLog()
      .debug(`treasury before: ${treasuryBefore}, fee: ${treasury}`);

    await signSendFinalized(
      Xyk.sellAsset(currency, MGA_ASSET_ID, sellAssetAmount),
      user,
    );

    const poolBalance = await getBalanceOfPool(MGA_ASSET_ID, currency);
    const feeInMGAPrice = await calculate_sell_price_rpc(
      poolBalance[1],
      poolBalance[0],
      treasury,
    );
    await user.refreshAmounts(AssetWallet.AFTER);
    const treasuryAfter = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnAfter = await getTreasuryBurn(MGA_ASSET_ID);
    testLog
      .getLog()
      .debug(`treasury after: ${treasuryAfter}, fee: ${feeInMGAPrice}`);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(feeInMGAPrice));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(currency, [BN_ZERO, BN_ZERO]);
  });

  it("assets won when assets are bought [Buying other in MGA pool]", async () => {
    const buyAssetAmount = new BN(10000);
    const treasuryBefore = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnBefore = await getTreasuryBurn(MGA_ASSET_ID);
    const sellPrice = await calculate_buy_price_id_rpc(
      MGA_ASSET_ID,
      currency,
      buyAssetAmount,
    );
    testLog
      .getLog()
      .debug(`treasury before: ${treasuryBefore}, sell price: ${sellPrice}`);

    await signSendFinalized(
      Xyk.buyAsset(MGA_ASSET_ID, currency, buyAssetAmount),
      user,
    );

    const { treasury } = calculateFees(sellPrice);
    await user.refreshAmounts(AssetWallet.AFTER);
    const treasuryAfter = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnAfter = await getTreasuryBurn(MGA_ASSET_ID);
    testLog
      .getLog()
      .debug(`treasury after: ${treasuryAfter}, fee: ${treasury}`);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(treasury));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(currency, [BN_ZERO, BN_ZERO]);
  });
});

describe("xyk-pallet - treasury tests [Connected - Mangata]: on treasury we store", () => {
  let connectedToMGA: BN, indirectlyConnected: BN;
  let user: User;

  beforeAll(async () => {
    await setupApi();
    [user] = setupUsers();

    connectedToMGA = await SudoDB.getInstance().getTokenId();
    indirectlyConnected = await SudoDB.getInstance().getTokenId();
    user.addAsset(connectedToMGA);
    user.addAsset(indirectlyConnected);

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user),
      Assets.mintToken(connectedToMGA, user),
      Assets.mintToken(indirectlyConnected, user),
      Sudo.sudoAs(
        user,
        Xyk.createPool(
          MGA_ASSET_ID,
          asset_amount1,
          connectedToMGA,
          asset_amount1.div(new BN(2)),
        ),
      ),
      Sudo.sudoAs(
        user,
        Xyk.createPool(
          connectedToMGA,
          asset_amount1,
          indirectlyConnected,
          asset_amount1.div(new BN(2)),
        ),
      ),
    );

    await user.refreshAmounts(AssetWallet.BEFORE);
  });

  it("assets won when assets are sold [Selling X connected to MGA pool] - rounding", async () => {
    const sellAssetAmount = new BN(10000);
    const mgPoolAmount = await getBalanceOfPool(MGA_ASSET_ID, connectedToMGA);
    const { treasury } = calculateFees(sellAssetAmount);
    const swapTreasuryInMG = calculate_sell_price_local_no_fee(
      mgPoolAmount[1],
      mgPoolAmount[0],
      treasury,
    );
    const twoTreasuries = calculate_sell_price_local_no_fee(
      mgPoolAmount[1],
      mgPoolAmount[0],
      treasury.mul(new BN(2)),
    );
    const treasuryBefore = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnBefore = await getTreasuryBurn(MGA_ASSET_ID);

    testLog.getLog().debug(
      `treasury before: ${treasuryBefore}, fee: ${treasury}, pool: ${mgPoolAmount}
         swapTreasuryInMG: ${swapTreasuryInMG}, twoTreasuries: ${twoTreasuries}`,
    );

    await signSendFinalized(
      Xyk.sellAsset(connectedToMGA, indirectlyConnected, sellAssetAmount),
      user,
    );
    await user.refreshAmounts(AssetWallet.AFTER);

    const treasuryAfter = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnAfter = await getTreasuryBurn(MGA_ASSET_ID);
    const mgPoolAmountAfter = await getBalanceOfPool(
      MGA_ASSET_ID,
      connectedToMGA,
    );
    testLog
      .getLog()
      .debug(
        `treasury after: ${treasuryAfter}, poolAfter: ${mgPoolAmountAfter}`,
      );

    expect(mgPoolAmountAfter[1].sub(mgPoolAmount[1])).bnEqual(
      treasury.add(treasury),
    );
    expect(treasuryAfter).bnEqual(treasuryBefore.add(swapTreasuryInMG));
    //validated with Stano that the rounding issue is no longer required.
    expect(mgPoolAmountAfter[0].add(twoTreasuries)).bnEqual(mgPoolAmount[0]);
    //burned destroyed! because is translated toMGA
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(indirectlyConnected, [BN_ZERO, BN_ZERO]);
  });

  it("assets won when assets are bought [Buying X connected to MGA pool]", async () => {
    const buyAssetAmount = new BN(7000);
    const poolAmount = await getBalanceOfPool(
      indirectlyConnected,
      connectedToMGA,
    );
    const sellPrice = await calculate_buy_price_rpc(
      poolAmount[1],
      poolAmount[0],
      buyAssetAmount,
    );
    const { treasury } = calculateFees(sellPrice);
    const mgPoolAmount = await getBalanceOfPool(MGA_ASSET_ID, connectedToMGA);
    const swapTreasuryInMG = calculate_sell_price_local_no_fee(
      mgPoolAmount[1],
      mgPoolAmount[0],
      treasury,
    );
    const treasuryBefore = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnBefore = await getTreasuryBurn(MGA_ASSET_ID);

    testLog
      .getLog()
      .debug(
        `treasury before: ${treasuryBefore}, fee: ${treasury}, pool: ${mgPoolAmount}`,
      );

    await signSendFinalized(
      Xyk.buyAsset(connectedToMGA, indirectlyConnected, buyAssetAmount),
      user,
    );

    await user.refreshAmounts(AssetWallet.AFTER);
    const treasuryAfter = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnAfter = await getTreasuryBurn(MGA_ASSET_ID);
    testLog
      .getLog()
      .debug(
        `treasury after: ${treasuryAfter}, swapTreasuryInMG: ${swapTreasuryInMG}`,
      );

    expect(treasuryAfter).bnEqual(treasuryBefore.add(swapTreasuryInMG));
    //burned destroyed! because is translated toMGA
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(indirectlyConnected, [BN_ZERO, BN_ZERO]);
  });

  it("assets won when assets are sold [Selling Y - X connected toMGA pool] - 6", async () => {
    const sellAssetAmount = new BN(10000);
    const treasuryBefore = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnBefore = await getTreasuryBurn(MGA_ASSET_ID);
    const treasuryBeforeInd = await getTreasury(indirectlyConnected);
    const treasuryBurnBeforeInd = await getTreasuryBurn(indirectlyConnected);
    const { treasury, treasuryBurn } = calculateFees(sellAssetAmount);
    testLog
      .getLog()
      .debug(
        `treasury before: ${treasuryBefore}, indirect: ${treasuryBeforeInd}`,
      );

    await signSendFinalized(
      Xyk.sellAsset(indirectlyConnected, connectedToMGA, sellAssetAmount),
      user,
    );

    await user.refreshAmounts(AssetWallet.AFTER);
    const treasuryAfter = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnAfter = await getTreasuryBurn(MGA_ASSET_ID);
    const treasuryAfterInd = await getTreasury(indirectlyConnected);
    const treasuryBurnAfterInd = await getTreasuryBurn(indirectlyConnected);
    testLog
      .getLog()
      .debug(
        `treasury after: ${treasuryAfter}, indirect: ${treasuryAfterInd}, fee: ${treasury},${treasuryBurn}`,
      );

    expect(treasuryAfter).bnEqual(treasuryBefore);
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    expect(treasuryAfterInd).bnEqual(treasuryBeforeInd.add(treasury));
    expect(treasuryBurnAfterInd).bnEqual(
      treasuryBurnBeforeInd.add(treasuryBurn),
    );
  });

  it("assets won when assets are bought [Buying Y - X connected toMGA pool] - 6", async () => {
    const buyAssetAmount = new BN(6000);
    const treasuryBefore = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnBefore = await getTreasuryBurn(MGA_ASSET_ID);
    const poolAmount = await getBalanceOfPool(
      indirectlyConnected,
      connectedToMGA,
    );
    const sellPrice = await calculate_buy_price_rpc(
      poolAmount[1],
      poolAmount[0],
      buyAssetAmount,
    );
    const { treasury } = calculateFees(sellPrice);
    const mgPoolAmount = await getBalanceOfPool(MGA_ASSET_ID, connectedToMGA);
    const swapTreasuryInMG = calculate_sell_price_local_no_fee(
      mgPoolAmount[1],
      mgPoolAmount[0],
      treasury,
    );
    const treasuryBeforeInd = await getTreasury(indirectlyConnected);
    const treasuryBurnBeforeInd = await getTreasuryBurn(indirectlyConnected);
    testLog
      .getLog()
      .debug(
        `treasury before: ${treasuryBefore}, pool: ${mgPoolAmount}, fee: ${treasury}`,
      );

    await signSendFinalized(
      Xyk.buyAsset(connectedToMGA, indirectlyConnected, buyAssetAmount),
      user,
    );

    await user.refreshAmounts(AssetWallet.AFTER);
    const treasuryAfter = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnAfter = await getTreasuryBurn(MGA_ASSET_ID);
    testLog
      .getLog()
      .debug(
        `treasury after: ${treasuryAfter}, swapTreasuryInMG: ${swapTreasuryInMG}`,
      );

    expect(treasuryAfter).bnEqual(treasuryBefore.add(swapTreasuryInMG));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(indirectlyConnected, [
      treasuryBeforeInd,
      treasuryBurnBeforeInd,
    ]);
  });
});

describe("xyk-pallet - treasury tests [Connected - Mangata]: Error cases", () => {
  let currency: BN;
  let user: User;

  beforeAll(async () => {
    await setupApi();
    [user] = setupUsers();

    currency = await SudoDB.getInstance().getTokenId();
    user.addAsset(currency);

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user),
      Assets.mintToken(currency, user),
      Sudo.sudoAs(
        user,
        Xyk.createPool(MGA_ASSET_ID, asset_amount1, currency, asset_amount2),
      ),
    );

    await user.refreshAmounts(AssetWallet.BEFORE);
  });

  it("Not enough tokens to convert fee LINK[https://trello.com/c/p77t0atO]", async () => {
    const mgPoolAmount = await getBalanceOfPool(MGA_ASSET_ID, currency);
    const treasuryBefore = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnBefore = await getTreasuryBurn(MGA_ASSET_ID);
    const treasuryBeforeConnectedAsset = await getTreasury(currency);
    const treasuryBurnBeforeConnectedAsset = await getTreasuryBurn(currency);
    const from = await getBlockNumber();

    await signSendFinalized(
      Xyk.buyAsset(currency, MGA_ASSET_ID, mgPoolAmount[0].sub(BN_ONE)),
      user,
    );

    const to = await getBlockNumber();
    const blockNumber = await findBlockWithExtrinsicSigned(
      [from, to],
      user.keyRingPair.address,
    );
    const fees = await getTokensDiffForBlockAuthor(blockNumber);
    await user.refreshAmounts(AssetWallet.AFTER);
    const treasuryAfter = await getTreasury(MGA_ASSET_ID);
    const treasuryBurnAfter = await getTreasuryBurn(MGA_ASSET_ID);
    const treasuryAfterConnectedAsset = await getTreasury(currency);
    const treasuryBurnAfterConnectedAsset = await getTreasuryBurn(currency);
    const poolAfter = await getBalanceOfPool(MGA_ASSET_ID, currency);

    //Check that the pool has only one MGA token.
    expect(poolAfter[0]).bnEqual(new BN(1));
    //Check that the user has the right amount of MGA tokens.
    //The ones he had before + bought. 99
    const expectedValue = user
      .getAsset(MGA_ASSET_ID)!
      .amountAfter.free.sub(mgPoolAmount[0].sub(new BN(1)));
    const feeLock = (await getFeeLockMetadata(await getApi())).feeLockAmount;
    expect(user.getAsset(MGA_ASSET_ID)!.amountBefore.free).bnEqual(
      expectedValue.add(fees).add(feeLock),
    );

    //burned destroyed! because is translated toMGA
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    //check that treasury got the right amount.
    //not enough tokens to get the fee.
    expect(treasuryAfter).bnEqual(treasuryBefore);
    expect(
      treasuryAfterConnectedAsset.sub(treasuryBeforeConnectedAsset),
    ).bnEqual(BN_ZERO);
    expect(
      treasuryBurnAfterConnectedAsset.sub(treasuryBurnBeforeConnectedAsset),
    ).bnEqual(BN_ZERO);
  });
});
