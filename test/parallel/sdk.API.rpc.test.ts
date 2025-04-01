/*
 *
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Assets } from "../../utils/Assets";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars, stringToBN } from "../../utils/utils";
import { Sudo } from "../../utils/sudo";
import {
  calculate_buy_price_id_rpc,
  calculate_buy_price_local,
  calculate_sell_price_id_rpc,
  calculate_sell_price_local,
  getLiquidityAssetId,
} from "../../utils/tx";
import { BN_ZERO, Mangata, MangataInstance } from "gasp-sdk";
import { BN } from "@polkadot/util";
import { Market } from "../../utils/market";

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
      Market.createPool(token1, poolBalance, token2, poolBalance),
    ),
  );
  liquidityToken = await getLiquidityAssetId(token1, token2);

  mgaInstance = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
});

describe("SDK tests for rpc functions", () => {
  test("Calculate Sell / buy / id", async () => {
    const sellAmount = calculate_sell_price_local(
      poolBalance,
      poolBalance,
      amount,
    );
    const buyAmount = calculate_buy_price_local(
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
  test("Calculate sellForMinting amount", async () => {
    const api = await mgaInstance.api();
    const sellForMinting =
      await api.rpc.market.calculate_expected_amount_for_minting(
        liquidityToken,
        token1,
        amount,
      );
    expect(stringToBN(sellForMinting.toString())).bnGt(BN_ZERO);
  });
});
