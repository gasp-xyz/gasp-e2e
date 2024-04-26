/*
 *
 * @group metamask
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { ApiPromise, Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN, BN_ONE, BN_THOUSAND, BN_TWO, BN_ZERO } from "@polkadot/util";
import { signTxMetamask } from "../../utils/metamask";
import { testLog } from "../../utils/Logger";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { EthUser } from "../../utils/EthUser";
import { getLiquidityAssetId } from "../../utils/tx";
import { Xyk } from "../../utils/xyk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

describe("Tests with Metamask signing:", () => {
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  let sudo: User;
  let testPdUser: User;
  let testEthUser: EthUser;

  let api: ApiPromise;
  let keyring: Keyring;
  let secondCurrency: BN;
  let liqId: BN;

  const defaultCurrencyValue = new BN(10000000).mul(Assets.MG_UNIT);

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    api = getApi();
    keyring = new Keyring({ type: "sr25519" });
    [testPdUser] = setupUsers();
    sudo = new User(keyring, sudoUserName);

    [secondCurrency] = await Assets.setupUserWithCurrencies(
      sudo,
      [defaultCurrencyValue],
      sudo,
    );

    await setupApi();
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(sudo),
      Sudo.sudoAs(
        sudo,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT,
          secondCurrency,
          Assets.DEFAULT_AMOUNT,
        ),
      ),
    );
    liqId = await getLiquidityAssetId(MGA_ASSET_ID, secondCurrency);
    testPdUser.addAsset(MGA_ASSET_ID);
  });

  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    testEthUser = new EthUser(keyring);
  });

  test("GIVEN sign extrinsic by using privateKey of another ethUser THEN receive error", async () => {
    let signingError: any;

    const secondEthUser = new EthUser(keyring);

    await Sudo.batchAsSudoFinalized(Assets.mintNative(testEthUser));

    const tx = api.tx.tokens.transfer(testPdUser.keyRingPair.address, 0, 1000);

    try {
      await signTxMetamask(
        tx,
        testEthUser.ethAddress,
        secondEthUser.privateKey,
      );
    } catch (error) {
      signingError = error;
    }

    expect(signingError.toString()).toBe(
      "RpcError: 1010: Invalid Transaction: Transaction has a bad signature",
    );
  });

  test("Transfer tokens", async () => {
    await Sudo.batchAsSudoFinalized(Assets.mintNative(testEthUser));
    testEthUser.addAsset(MGA_ASSET_ID);

    await testPdUser.refreshAmounts(AssetWallet.BEFORE);
    await testEthUser.refreshAmounts(AssetWallet.BEFORE);

    const tx = api.tx.tokens.transfer(testPdUser.keyRingPair.address, 0, 1000);
    await signByMetamask(tx, testEthUser);

    await testPdUser.refreshAmounts(AssetWallet.AFTER);
    await testEthUser.refreshAmounts(AssetWallet.AFTER);
    const diff = testPdUser.getWalletDifferences();

    expect(testEthUser.getAsset(MGA_ASSET_ID)!.amountBefore.free!).bnGt(
      testEthUser.getAsset(MGA_ASSET_ID)!.amountAfter.free!,
    );
    expect(diff[0].diff.free).bnEqual(new BN(1000));
  });

  test("Mint liquidity", async () => {
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testEthUser),
      Assets.mintToken(secondCurrency, testEthUser, Assets.DEFAULT_AMOUNT),
    );
    testEthUser.addAsset(MGA_ASSET_ID);

    const tx = api.tx.xyk.mintLiquidity(
      MGA_ASSET_ID,
      secondCurrency,
      Assets.DEFAULT_AMOUNT.div(BN_TWO),
      Assets.DEFAULT_AMOUNT.div(BN_TWO).add(BN_ONE),
    );

    await signByMetamask(tx, testEthUser);

    testEthUser.addAsset(liqId);
    await testEthUser.refreshAmounts(AssetWallet.AFTER);

    expect(testEthUser.getAsset(liqId)!.amountAfter.free!).bnGt(BN_ZERO);
  });

  test("Burn liquidity", async () => {
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testEthUser),
      Assets.mintToken(liqId, testEthUser, Assets.DEFAULT_AMOUNT),
    );
    testEthUser.addAsset(MGA_ASSET_ID);
    testEthUser.addAsset(liqId);

    await testEthUser.refreshAmounts(AssetWallet.BEFORE);

    const tx = api.tx.xyk.burnLiquidity(
      MGA_ASSET_ID,
      secondCurrency,
      Assets.DEFAULT_AMOUNT,
    );

    await signByMetamask(tx, testEthUser);

    testEthUser.addAsset(secondCurrency);
    await testEthUser.refreshAmounts(AssetWallet.AFTER);
    const diff = testEthUser
      .getAsset(liqId)!
      .amountBefore.free!.sub(testEthUser.getAsset(liqId)!.amountAfter.free!);

    expect(testEthUser.getAsset(secondCurrency)!.amountAfter.free!).bnGt(
      BN_ZERO,
    );
    expect(diff).bnEqual(Assets.DEFAULT_AMOUNT);
  });

  test("Create batch function", async () => {
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testEthUser),
      Assets.mintToken(secondCurrency, testEthUser, Assets.DEFAULT_AMOUNT),
    );

    const txs = [];

    txs.push(
      api.tx.xyk.mintLiquidity(
        MGA_ASSET_ID,
        secondCurrency,
        Assets.DEFAULT_AMOUNT.div(BN_TWO),
        Assets.DEFAULT_AMOUNT.div(BN_TWO).add(BN_ONE),
      ),
      api.tx.tokens.transfer(testPdUser.keyRingPair.address, liqId, 1000),
    );

    testEthUser.addAsset(MGA_ASSET_ID);
    testEthUser.addAsset(liqId);
    testPdUser.addAsset(liqId);

    await testEthUser.refreshAmounts(AssetWallet.BEFORE);

    const tx = api.tx.utility.batchAll(txs);

    await signByMetamask(tx, testEthUser);

    testEthUser.addAsset(secondCurrency);
    await testEthUser.refreshAmounts(AssetWallet.AFTER);
    const diff = testEthUser
      .getAsset(liqId)!
      .amountAfter.free!.sub(testEthUser.getAsset(liqId)!.amountBefore.free!);

    expect(testEthUser.getAsset(liqId)!.amountAfter.free!).bnGt(BN_THOUSAND);
    expect(diff).bnGt(BN_ZERO);
  });
});

async function signByMetamask(extrinsic: any, ethUser: EthUser) {
  const extrinsicFromBlock = await signTxMetamask(
    extrinsic,
    ethUser.ethAddress,
    ethUser.privateKey,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  testLog
    .getLog()
    .info("Extrinsic from block", JSON.stringify(extrinsicFromBlock));
}
