/*
 *
 * @group xyk
 * @group api
 * @group parallel
 * @group story
 */
import { jest } from "@jest/globals";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { createPool, getBalanceOfPool, sellAsset } from "../../utils/tx";
import { waitNewBlock, ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { testLog } from "../../utils/Logger";
import { Fees } from "../../utils/Fees";
import { MangataInstance } from "@mangata-finance/sdk";
import { getSudoUser } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

const defaultCurrecyValue = new BN(250000);

describe("Story tests > LP", () => {
  let testUser1: User;
  let testUser2: User;
  let sudo: User;

  let keyring: Keyring;
  let token1: BN;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    keyring = new Keyring({ type: "ethereum" });

    // setup users
    testUser1 = new User(keyring);
    testUser2 = new User(keyring);

    sudo = getSudoUser();
    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(testUser2.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
    [token1] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue],
      sudo,
    );
    await testUser1.addGASPTokens(sudo);
    await sudo.mint(
      GASP_ASSET_ID,
      testUser2,
      new BN("1000000000000000000000000"),
    );
    await sudo.mint(token1, testUser2, defaultCurrecyValue);
    //TODO:swapFees
    if (Fees.swapFeesEnabled) {
      await testUser2.addGASPTokens(sudo);
    }
    testUser1.addAsset(GASP_ASSET_ID);
    testUser2.addAsset(GASP_ASSET_ID);
    testUser2.addAsset(token1);
    testUser1.refreshAmounts();
    testUser2.refreshAmounts();
  });

  test("Pool wins over 0.3% tokens when 10 swaps are done in the pool [Token - MGA]", async () => {
    //lets create a pool with user1
    const mangata = await getMangataInstance();
    await createPool(
      testUser1.keyRingPair,
      token1,
      defaultCurrecyValue,
      GASP_ASSET_ID,
      defaultCurrecyValue,
    );
    const poolBalanceBeforeSwaps = await getBalanceOfPool(
      token1,
      GASP_ASSET_ID,
    );
    //lets swap tokens
    await do10Swaps(mangata, testUser2, token1);
    const poolBalance = await getBalanceOfPool(token1, GASP_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await testUser2.refreshAmounts(AssetWallet.AFTER);
    const userTokensBefore = testUser2
      .getAsset(token1)
      ?.amountBefore.free!.add(
        testUser2.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
      );

    const userTokensAfter = testUser2
      .getAsset(token1)
      ?.amountAfter.free!.add(
        testUser2.getAsset(GASP_ASSET_ID)?.amountAfter.free!,
      );
    const totalPoolBefore = poolBalanceBeforeSwaps[0].add(
      poolBalanceBeforeSwaps[1],
    );
    const totalPoolAfter = poolBalance[0].add(poolBalance[1]);

    const userLost = userTokensBefore?.sub(userTokensAfter!)!;
    const poolWins = totalPoolAfter?.sub(totalPoolBefore!)!;
    const percentageIncrement = poolWins
      .mul(new BN(1000000))
      .div(totalPoolBefore);

    //swaps expenses are higher than the liquidity pool win
    expect(userLost.gt(poolWins)).toBeTruthy();
    //pool gains are  ~ 0.3%!
    testLog.getLog().info(percentageIncrement.toString());
    expect(percentageIncrement.gte(new BN(300))).toBeTruthy();
  });
});

async function do10Swaps(
  mangata: MangataInstance,
  testUser2: User,
  token1: BN,
) {
  const userNonce = [];
  userNonce.push(await mangata.query.getNonce(testUser2.keyRingPair.address));
  const promises = [];
  const maxFutureNonce = userNonce[0].toNumber() + 9;
  for (let index = maxFutureNonce; index >= userNonce[0].toNumber(); index--) {
    if (index % 2 === 0) {
      promises.push(
        sellAsset(
          testUser2.keyRingPair,
          GASP_ASSET_ID,
          token1,
          new BN(10000),
          new BN(0),
          {
            nonce: new BN(index),
          },
        ),
      );
    } else {
      promises.push(
        sellAsset(
          testUser2.keyRingPair,
          token1,
          GASP_ASSET_ID,
          new BN(10000),
          new BN(0),
          {
            nonce: new BN(index),
          },
        ),
      );
    }

    await waitNewBlock();
  }
  const promisesEvents = await await Promise.all(promises);
  promisesEvents.forEach((events) => {
    const result = getEventResultFromMangataTx(events);
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
}
