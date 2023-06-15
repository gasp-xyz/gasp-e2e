/*
 *
 * @group xyk
 * @group api
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  getBalanceOfPool,
  createPool,
  transferAsset,
  sellAsset,
  buyAsset,
  burnLiquidity,
  mintLiquidity,
  mintAsset,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import {
  getEnvironmentRequiredVars,
  TokensErrorCodes,
  xykErrors,
} from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

const MAX_BALANCE = new BN("340282366920938463463374607431768211455"); //max balance

describe("xyk-pallet - Check operations are not executed because of overflow in asset token", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;
  let firstCurrency: BN;
  let secondCurrency: BN;

  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);
    sudo = new User(keyring, sudoUserName);
    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);

    //add two curerncies and balance to testUser:
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [MAX_BALANCE, MAX_BALANCE.sub(new BN(1))],
      sudo
    );
    await testUser1.addMGATokens(sudo);

    // check users accounts.
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
  });
  test("Create pool of [MAX,MAX]: OverFlow [a+b] - liquidityAsset calculation", async () => {
    await sudo.mint(secondCurrency, testUser1, new BN(1));
    //UPDATE: Liq assets  = asset1 /2 + asset2/2.
    await createPool(
      testUser1.keyRingPair,
      secondCurrency,
      MAX_BALANCE,
      firstCurrency,
      MAX_BALANCE
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const poolBalances = await getBalanceOfPool(firstCurrency, secondCurrency);
    expect(poolBalances[0]).bnEqual(MAX_BALANCE);
    expect(poolBalances[1]).bnEqual(MAX_BALANCE);
  });
  test("Minting Max+1 tokens operation fails", async () => {
    const testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    await mintAsset(
      sudo.keyRingPair,
      firstCurrency,
      testUser2.keyRingPair.address,
      new BN(1)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, ["Overflow"]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
  });

  //A token can not be minted with MAX +1 value. Sudo mint token operation fails, hence skipping this test. and adding the above.(Minting Max+1 tokens operation fails)
  test.skip("Transfer [MAX] assets to other user when that user has 1 asset. Max+1 => overflow.", async () => {
    const testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    await sudo.mint(firstCurrency, testUser2, new BN(1));
    testUser2.addAsset(firstCurrency);
    testUser2.refreshAmounts(AssetWallet.BEFORE);

    await transferAsset(
      testUser1.keyRingPair,
      firstCurrency,
      testUser2.keyRingPair.address,
      MAX_BALANCE
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(TokensErrorCodes.BalanceOverflow);
    });
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await testUser2.refreshAmounts(AssetWallet.AFTER);

    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free).bnEqual(
      MAX_BALANCE
    );
    expect(testUser2.getAsset(firstCurrency)?.amountAfter.free).bnEqual(
      new BN(1)
    );
  });
});

describe("xyk-pallet - Operate with a pool close to overflow", () => {
  let testUser1: User;
  let testUser2: User;
  let sudo: User;

  let keyring: Keyring;
  let firstCurrency: BN;
  let secondCurrency: BN;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);
    sudo = new User(keyring, sudoUserName);
    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);

    //add two curerncies and balance to testUser:
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [MAX_BALANCE.sub(new BN(10)), MAX_BALANCE.sub(new BN(10))],
      sudo
    );
    await testUser1.addMGATokens(sudo);

    // check users accounts.
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    await sudo.mint(firstCurrency, testUser2, new BN(10));
    await sudo.mint(secondCurrency, testUser2, new BN(10));
    testUser2.addAssets([firstCurrency, secondCurrency]);
    await testUser2.addMGATokens(sudo);
    await createPool(
      testUser1.keyRingPair,
      secondCurrency,
      MAX_BALANCE.sub(new BN(10)),
      firstCurrency,
      MAX_BALANCE.sub(new BN(10))
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser2.refreshAmounts(AssetWallet.BEFORE);
  });

  test("Sell [MAX -2] assets to a wallet with Max-1000,1000 => overflow.", async () => {
    await sellAsset(
      testUser2.keyRingPair,
      firstCurrency,
      secondCurrency,
      MAX_BALANCE.sub(new BN(10)),
      new BN(1)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.MathOverflow);
    });
    await testUser2.refreshAmounts(AssetWallet.AFTER);

    expect(testUser2.getAsset(firstCurrency)?.amountAfter.free).bnEqual(
      testUser2.getAsset(firstCurrency)?.amountBefore.free!
    );
  });
  test("Buy [100] assets to a wallet with Max-1000,1000 => overflow.", async () => {
    await buyAsset(
      testUser2.keyRingPair,
      secondCurrency,
      firstCurrency,
      new BN(10),
      MAX_BALANCE
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.MathOverflow);
    });
    await testUser2.refreshAmounts(AssetWallet.AFTER);

    expect(testUser2.getAsset(firstCurrency)?.amountAfter.free).bnEqual(
      testUser2.getAsset(firstCurrency)?.amountBefore.free!
    );
  });
  //not suported scenario. We are creasing pool og Max-10 and then minting another 100.
  test.skip("Mint liquidities [1000] assets to a wallet with Max-1000,1000 => overflow.", async () => {
    await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(100),
      MAX_BALANCE
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);

      //This error is right, the enum comes from the pallet overflow.
      expect(eventResponse.data).toEqual(xykErrors.PoolAlreadyExists);
    });
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free).bnEqual(
      MAX_BALANCE
    );
  });
  test.skip("[BUG] Burn liquidities [MAX -1] assets to a wallet wich is full => overflow. NOT  a bug https://trello.com/c/J3fzuwH5", async () => {
    const amountToFillAsset = MAX_BALANCE.sub(
      testUser2.getAsset(firstCurrency)?.amountBefore.free!
    ).sub(new BN(2));
    const amountToFillAssetSeccondC = MAX_BALANCE.sub(
      testUser2.getAsset(secondCurrency)?.amountBefore.free!
    ).sub(new BN(2));
    await sudo.mint(firstCurrency, testUser2, amountToFillAsset);
    await sudo.mint(secondCurrency, testUser2, amountToFillAssetSeccondC);

    //burn 1 token less than the pool amount created in the setup.
    await burnLiquidity(
      testUser2.keyRingPair,
      secondCurrency,
      firstCurrency,
      MAX_BALANCE.sub(new BN(1001))
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.MathOverflow);
    });
    await testUser2.refreshAmounts(AssetWallet.AFTER);

    expect(testUser2.getAsset(firstCurrency)?.amountAfter.free).bnEqual(
      MAX_BALANCE.sub(new BN(2))
    );
    expect(testUser2.getAsset(secondCurrency)?.amountAfter.free).bnEqual(
      MAX_BALANCE.sub(new BN(2))
    );
  });
});

describe("xyk-pallet - Operate with a user account close to overflow", () => {
  let testUser1: User;
  let testUser2: User;
  let sudo: User;

  let keyring: Keyring;
  let firstCurrency: BN;
  let secondCurrency: BN;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);
    sudo = new User(keyring, sudoUserName);
    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);

    //add two curerncies and balance to testUser:
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [MAX_BALANCE, MAX_BALANCE.sub(new BN(1))],
      sudo
    );
    await testUser1.addMGATokens(sudo);

    // check users accounts.
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    await sudo.mint(firstCurrency, testUser2, MAX_BALANCE);
    await sudo.mint(secondCurrency, testUser2, MAX_BALANCE);
    testUser2.addAssets([firstCurrency, secondCurrency]);
    await testUser2.addMGATokens(sudo);
    //Lets create a pool with 1M-5M
    await createPool(
      testUser2.keyRingPair,
      secondCurrency,
      new BN(1000000),
      firstCurrency,
      new BN(5000000)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser2.refreshAmounts(AssetWallet.BEFORE);
  });

  test.skip("Sell a few assets to a wallet that is full => overflow. NOT A BUG: https://trello.com/c/J3fzuwH5", async () => {
    await sellAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(10000),
      new BN(1)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.MathOverflow);
    });
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free).bnEqual(
      testUser1.getAsset(firstCurrency)?.amountBefore.free!
    );
    expect(testUser1.getAsset(secondCurrency)?.amountAfter.free).bnEqual(
      testUser1.getAsset(secondCurrency)?.amountBefore.free!
    );
  });
  test.skip("Buy a few assets to a wallet that is full  => overflow. NOT A BUG: https://trello.com/c/J3fzuwH5", async () => {
    await buyAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(100),
      MAX_BALANCE
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.MathOverflow);
    });
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free).bnEqual(
      testUser1.getAsset(firstCurrency)?.amountBefore.free!
    );
    expect(testUser1.getAsset(secondCurrency)?.amountAfter.free).bnEqual(
      testUser1.getAsset(secondCurrency)?.amountBefore.free!
    );
  });
});

describe.skip("xyk-pallet - Operate with a highly unbalanced pool [mg - newAsset]", () => {
  let testUser1: User;
  let sudo: User;
  let testUser2: User;
  let keyring: Keyring;
  let firstCurrency: BN;
  let secondCurrency: BN;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);
    sudo = new User(keyring, sudoUserName);
    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);

    const divNumber = new BN(100);
    //add two curerncies and balance to testUser:
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [divNumber, MAX_BALANCE.div(divNumber)],
      sudo
    );
    await testUser1.addMGATokens(sudo);

    // check users accounts.
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    await sudo.mint(new BN(0), testUser2, MAX_BALANCE.div(divNumber));
    await sudo.mint(secondCurrency, testUser2, MAX_BALANCE);
    await sudo.mint(firstCurrency, testUser2, MAX_BALANCE);
    testUser2.addAssets([firstCurrency, secondCurrency]);
    await testUser2.addMGATokens(sudo);
    //Lets create a pool with Lot of MGA few secondCurr.
    await createPool(
      testUser2.keyRingPair,
      new BN(0),
      MAX_BALANCE.div(divNumber),
      secondCurrency,
      divNumber
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await createPool(
      testUser2.keyRingPair,
      firstCurrency,
      MAX_BALANCE.div(divNumber),
      secondCurrency,
      MAX_BALANCE.div(divNumber)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser2.refreshAmounts(AssetWallet.BEFORE);
  });

  test("[BUG] Buy a few assets to a wallet linked to MGA  => overflow.", async () => {
    // lets buy some asets
    const poolBalanceAssetsBefore = await getBalanceOfPool(
      secondCurrency,
      firstCurrency
    );
    const poolBalanceMGAAssetBefore = await getBalanceOfPool(
      new BN(0),
      secondCurrency
    );

    await buyAsset(
      testUser1.keyRingPair,
      secondCurrency,
      firstCurrency,
      MAX_BALANCE.div(new BN("100000000000")),
      MAX_BALANCE
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const poolBalanceAssetsAfter = await getBalanceOfPool(
      secondCurrency,
      firstCurrency
    );
    const poolBalanceMGAAssetAfter = await getBalanceOfPool(
      new BN(0),
      secondCurrency
    );

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    expect(poolBalanceMGAAssetAfter[0]).not.bnEqual(new BN(0));
    expect(poolBalanceAssetsAfter[0]).not.bnEqual(new BN(0));
    expect(poolBalanceAssetsBefore[0]).not.bnEqual(new BN(0));
    expect(poolBalanceMGAAssetBefore[0]).not.bnEqual(new BN(0));
  });
});
