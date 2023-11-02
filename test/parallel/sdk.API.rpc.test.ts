/*
 *
 * @group parallel
 */
import { jest } from "@jest/globals";
import { setupApi, setupUsers } from "../../utils/setup";
import { Assets } from "../../utils/Assets";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import {
  calculate_buy_price_id_rpc,
  calculate_buy_price_rpc,
  calculate_sell_price_id_rpc,
  calculate_sell_price_rpc,
  calculateBalancedSellAmount,
  getBurnAmount,
  getLiquidityAssetId,
  getMaxInstantBurnAmount,
} from "../../utils/tx";
import { BN_ZERO } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let token1: BN;
let token2: BN;
let user1: User;
let liquidityToken: BN;

const poolBalance = Assets.DEFAULT_AMOUNT.divn(2);
const amount = new BN(10000000);
beforeAll(async () => {
  await setupApi();
  [user1] = setupUsers();

  const keyring = new Keyring({ type: "sr25519" });

  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
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
});

describe("SDK tests for rpc functions", () => {
  test("Calculate Sell / buy / id", async () => {
    const sellAmount = await calculate_sell_price_rpc(
      poolBalance,
      poolBalance,
      amount,
    );
    const buyAmount = await calculate_buy_price_rpc(
      poolBalance,
      poolBalance,
      amount,
    );
    const sellAmountId = await calculate_sell_price_id_rpc(
      token1,
      token2,
      amount,
    );
    const buyAmountId = await calculate_buy_price_id_rpc(
      token1,
      token2,
      amount,
    );

    expect(sellAmount).bnGt(BN_ZERO);
    expect(liquidityToken).bnGt(BN_ZERO);
    //TODO: GonCer validate.
    expect(buyAmount).bnEqual(buyAmountId);
    expect(sellAmount).bnEqual(sellAmountId);
  });
  test("Get Burn amount , maxInstant burn amount", async () => {
    const burnAmount = await getBurnAmount(token1, token2, amount);
    const maxInstantBurnAmount = await getMaxInstantBurnAmount(
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
    const balancedSell = await calculateBalancedSellAmount(amount, poolBalance);
    expect(balancedSell).bnGt(BN_ZERO);
  });
});
