import { BN } from "@polkadot/util";
import { setupApi, setupUsers, sudo } from "../../../utils/v2/setup";
import { Sudo } from "../../../utils/v2/sudo";
import { Assets } from "../../../utils/v2/assets";
import { User } from "../../../utils/User";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signSendFinalized } from "../../../utils/v2/event";
import { Xyk } from "../../../utils/v2/xyk";
import { MGA_ASSET_ID } from "../../../utils/Constants";
import { BN_ONE } from "@mangata-finance/sdk";
import { testLog } from "../../../utils/Logger";
import { getBalanceOfAsset, getLiquidityAssetId } from "../../../utils/tx";

const default50k = new BN(50000);

describe.concurrent("xyk-pallet: Accuracy - shared pool", () => {
  let user1: User;
  let user2: User;
  let user3: User;
  let user4: User;
  let users: User[];

  beforeAll(async () => {
    await setupApi();
    [user1, user2, user3, user4] = setupUsers();
    users = [user1, user2, user3];

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user1),
      Assets.mintNative(user2),
      Assets.mintNative(user3)
    );
  });

  beforeEach(async (context) => {
    let currency: BN;
    await signSendFinalized(Assets.issueToken(user1), sudo).then(
      async (result) => {
        [currency] = Assets.findTokenId(result);
        // @ts-ignore
        context.currency = currency;

        await Sudo.batchAsSudoFinalized(
          Assets.mintToken(currency, user2),
          Assets.mintToken(currency, user3),
          Assets.mintToken(currency, user4),
          Sudo.sudoAs(
            user1,
            Xyk.createPool(currency, default50k, MGA_ASSET_ID, default50k)
          )
        );
      }
    );
  });

  it("Each user who minted owns the same % of tokens - one user gets extra token", async ({
    // @ts-ignore
    currency,
  }) => {
    const sellAmount = new BN(999 + 1);
    await mintAndBurn(currency, sellAmount, [
      default50k,
      default50k,
      default50k,
    ]);

    const balances = await getBalances(currency);
    balances.sort();
    testLog.getLog().info(`balances +1: ${balances.map((b) => b.toString())}`);

    // two users must have the same balance, and the other 1 token extra.
    expect(balances[0]).bnEqual(balances[1]);
    expect(balances[2].sub(BN_ONE)).bnEqual(balances[0]);
  });

  it("Each user who minted owns the same % of tokens - two users gets extra token", async ({
    // @ts-ignore
    currency,
  }) => {
    const sellAmount = new BN(999 + 2);
    await mintAndBurn(currency, sellAmount, [
      default50k,
      default50k,
      default50k,
    ]);

    const balances = await getBalances(currency);
    balances.sort();
    testLog.getLog().info(`balances +2: ${balances.map((b) => b.toString())}`);

    // two users must have the same balance with extra token, and other 1 token less.
    expect(balances[1]).bnEqual(balances[2]);
    expect(balances[0].add(BN_ONE)).bnEqual(balances[1]);
  });

  it("Each user who minted owns the same % of tokens - divisible by 3", async ({
    // @ts-ignore
    currency,
  }) => {
    const sellAmount = new BN(999 + 3);
    await mintAndBurn(currency, sellAmount, [
      default50k,
      default50k,
      default50k,
    ]);

    const balances = await getBalances(currency);
    balances.sort();
    testLog.getLog().info(`balances eq: ${balances.map((b) => b.toString())}`);

    expect(balances[0]).bnEqual(balances[2]);
  });

  it("Each user who minted different % of tokens [50k,25k,10k]- get diff amounts", async ({
    // @ts-ignore
    currency,
  }) => {
    const sellAmount = new BN(999 + 3);
    await mintAndBurn(currency, sellAmount, [
      default50k,
      default50k.div(new BN(2)),
      default50k.div(new BN(5)),
    ]);

    const balances = await getBalances(currency);
    testLog
      .getLog()
      .info(`balances diff: ${balances.map((b) => b.toString())}`);

    testLog
      .getLog()
      .debug(
        "Test user - 50k tokens get / 5" +
          balances[0].toNumber() / 5 +
          "\n" +
          "Test user - 25k tokens get / 2.5 " +
          balances[1].toNumber() / 2.5 +
          "\n" +
          "Test user - 10k tokens get " +
          balances[2].toNumber()
      );
    // worst case  [-1,-1,+2] - so the difference in worst case is +2.
    expect(
      balances[0]
        .div(new BN(5))
        .sub(balances[1].mul(new BN(10)).div(new BN(25)))
        .abs()
    ).bnLte(new BN(2));

    expect(balances[0].div(new BN(5)).sub(balances[2]).abs()).bnLte(new BN(2));
  });

  async function mintAndBurn(currency: BN, sellAmount: BN, amounts: BN[]) {
    await Promise.all([
      signSendFinalized(
        Xyk.mintLiquidity(currency, MGA_ASSET_ID, amounts[1]),
        user2
      ),
      signSendFinalized(
        Xyk.mintLiquidity(currency, MGA_ASSET_ID, amounts[2]),
        user3
      ),
    ]);

    // check pool balance
    const liqToken = await getLiquidityAssetId(currency, MGA_ASSET_ID);
    const balancesLiqToken = await getBalances(liqToken);
    expect(balancesLiqToken).collectionBnEqual(amounts);

    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(user4, Xyk.sellAsset(currency, MGA_ASSET_ID, sellAmount)),
      Sudo.sudoAs(
        user1,
        Xyk.burnLiquidity(currency, MGA_ASSET_ID, balancesLiqToken[0])
      ),
      Sudo.sudoAs(
        user2,
        Xyk.burnLiquidity(currency, MGA_ASSET_ID, balancesLiqToken[1])
      ),
      Sudo.sudoAs(
        user3,
        Xyk.burnLiquidity(currency, MGA_ASSET_ID, balancesLiqToken[2])
      )
    );
  }

  async function getBalances(
    currency: BN,
    subtract: BN = Assets.DEFAULT_AMOUNT
  ) {
    const balances = [];
    for (const user of users) {
      balances.push(
        await getBalanceOfAsset(currency, user.keyRingPair.address).then((tb) =>
          tb.free.sub(subtract)
        )
      );
    }

    return balances;
  }
});
