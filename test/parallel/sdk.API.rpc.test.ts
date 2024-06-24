/*
 *
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Assets } from "../../utils/Assets";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { getLiquidityAssetId } from "../../utils/tx";
import { BN_ZERO, Mangata, MangataInstance } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let token1: BN;
let token2: BN;
let user1: User;
let liquidityToken: BN;
let mgaInstance: MangataInstance;

const poolBalance = Assets.DEFAULT_AMOUNT.divn(2);
const amount = new BN(10000000);
beforeAll(async () => {
  await setupApi();
  [user1] = setupUsers();

  const sudo = getSudoUser();
  [token1, token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT],
    sudo,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, user1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, user1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(user1),
    Sudo.sudoAs(
      user1,
      Xyk.createPool(token1, poolBalance, token2, poolBalance),
    ),
  );
  liquidityToken = await getLiquidityAssetId(token1, token2);

  mgaInstance = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
});

describe("SDK tests for rpc functions", () => {
  test("Calculate Sell / buy / id", async () => {
    const sellAmount = await mgaInstance.rpc.calculateSellPrice({
      inputReserve: poolBalance,
      outputReserve: poolBalance,
      amount: amount,
    });
    const buyAmount = await mgaInstance.rpc.calculateBuyPrice({
      inputReserve: poolBalance,
      outputReserve: poolBalance,
      amount: amount,
    });
    const sellAmountId = await mgaInstance.rpc.calculateSellPriceId(
      token1.toString(),
      token2.toString(),
      amount,
    );
    const buyAmountId = await mgaInstance.rpc.calculateBuyPriceId(
      token1.toString(),
      token2.toString(),
      amount,
    );

    expect(sellAmount).bnGt(BN_ZERO);
    expect(liquidityToken).bnGt(BN_ZERO);
    //TODO: GonCer validate.
    expect(buyAmount).bnEqual(buyAmountId);
    expect(sellAmount).bnEqual(sellAmountId);
  });
  test("Get Burn amount , maxInstant burn amount", async () => {
    const burnAmount = await mgaInstance.rpc.getBurnAmount({
      firstTokenId: token1.toString(),
      secondTokenId: token2.toString(),
      amount: amount,
    });
    const api = await mgaInstance.api();
    // @ts-ignore
    const maxInstantBurnAmount = await api.rpc.xyk.get_max_instant_burn_amount(
      user1.keyRingPair.address,
      liquidityToken.toString(),
    );
    expect(burnAmount.firstAssetAmount).bnLte(maxInstantBurnAmount);
    expect(burnAmount.secondAssetAmount).bnLte(maxInstantBurnAmount);
    expect(poolBalance).bnEqual(maxInstantBurnAmount);
    expect(burnAmount.firstAssetAmount).bnGt(BN_ZERO);
    expect(burnAmount.secondAssetAmount).bnGt(BN_ZERO);
  });
  test("Calculate balanced sell amount", async () => {
    const api = await mgaInstance.api();
    // @ts-ignore
    const balancedSell = await api.rpc.xyk.calculate_balanced_sell_amount(
      amount,
      poolBalance,
    );
    expect(balancedSell).bnGt(BN_ZERO);
  });
});
