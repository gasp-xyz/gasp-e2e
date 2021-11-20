/*
 *
 * @group xyk
 * @group api
 * @group parallel
 * @group story
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { getBalanceOfPool } from "../../utils/tx";
import { waitNewBlock, ExtrinsicResult } from "../../utils/eventListeners";
import BN from "bn.js";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { Mangata } from "mangata-sdk";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

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
    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);
    testUser2 = new User(keyring);

    sudo = new User(keyring, sudoUserName);
    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(testUser2.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
    [token1] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue],
      sudo
    );
    await testUser1.addMGATokens(sudo);
    await sudo.mint(MGA_ASSET_ID, testUser2, defaultCurrecyValue);
    await sudo.mint(token1, testUser2, defaultCurrecyValue);
    testUser1.addAsset(MGA_ASSET_ID);
    testUser2.addAsset(MGA_ASSET_ID);
    testUser2.addAsset(token1);
    testUser1.refreshAmounts();
    testUser2.refreshAmounts();
  });

  test("Pool wins over 5% tokens when 10 swaps are done in the pool", async () => {
    //lets create a pool with user1
    const mangata = await getMangataInstance();
    await mangata.createPool(
      testUser1.keyRingPair,
      token1.toString(),
      defaultCurrecyValue,
      MGA_ASSET_ID.toString(),
      defaultCurrecyValue
    );

    const poolBalanceBeforeSwaps = await getBalanceOfPool(token1, MGA_ASSET_ID);
    //lets swap tokens
    await do10Swaps(mangata, testUser2, token1);
    const poolBalance = await getBalanceOfPool(token1, MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await testUser2.refreshAmounts(AssetWallet.AFTER);

    const userTokensBefore = testUser2
      .getAsset(token1)
      ?.amountBefore.free!.add(
        testUser2.getAsset(MGA_ASSET_ID)?.amountBefore.free!
      );

    const userTokensAfter = testUser2
      .getAsset(token1)
      ?.amountAfter.free!.add(
        testUser2.getAsset(MGA_ASSET_ID)?.amountAfter.free!
      );
    const totalPoolBefore = poolBalanceBeforeSwaps[0].add(
      poolBalanceBeforeSwaps[1]
    );
    const totalPoolAfter = poolBalance[0].add(poolBalance[1]);

    const userLost = userTokensBefore?.sub(userTokensAfter!)!;
    const poolWins = totalPoolAfter?.sub(totalPoolBefore!)!;
    const percentageIncrement = poolWins.mul(new BN(100)).div(totalPoolBefore);

    //swaps expenses are higher than the liquidity pool win
    expect(userLost.gt(poolWins)).toBeTruthy();
    //pool gains are migher than the 5%!
    expect(percentageIncrement.gte(new BN(5))).toBeTruthy();
    //pool balance is right.

    // All but ( 2 * 0.05%  of sold amount ) of the liquidity goes to the pool
    // (10000 * 10) = 100000 -> increased value in the pool after 10 swaps
    // 10 * 10000  - ( 10 * 2 * 0.05% = 5tkns + 1 ) = 100000 - ( 10 * 2 * 6tkns )  = 100000 - 120 -> tokens are added to the pool by fees
    // 250000 + 100000 - 120 = 350000 - 120 = 349880.
    expect(poolBalance[1]).bnEqual(
      poolBalanceBeforeSwaps[1].add(
        new BN(10000).mul(new BN(10)).sub(new BN(120))
      )
    );
  });
});

async function do10Swaps(mangata: Mangata, testUser2: User, token1: BN) {
  const userNonce = [];
  userNonce.push(await mangata.getNonce(testUser2.keyRingPair.address));
  const promises = [];
  const maxFutureNonce = userNonce[0].toNumber() + 9;
  for (let index = maxFutureNonce; index >= userNonce[0].toNumber(); index--) {
    promises.push(
      mangata.sellAsset(
        testUser2.keyRingPair,
        MGA_ASSET_ID.toString(),
        token1.toString(),
        new BN(10000),
        new BN(0),
        {
          nonce: new BN(index),
        }
      )
    );
    await waitNewBlock();
  }
  const promisesEvents = await await Promise.all(promises);
  promisesEvents.forEach((events) => {
    const result = getEventResultFromMangataTx(events);
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
}
