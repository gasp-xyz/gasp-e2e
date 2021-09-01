import {api, getApi, initApi} from "../../utils/api";
import { sellAsset, getTreasury, getTreasuryBurn, getAssetId, getBalanceOfPool, calculate_sell_price_local_no_fee, buyAsset, calculate_sell_price_rpc, calculate_buy_price_rpc} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateTreasuryAmountsEqual } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { calculateFees, getEnvironmentRequiredVars, MGA_ASSET_NAME } from "../../utils/utils";
import { getEventResultFromTxWait, signSendAndWaitToFinishTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const first_asset_amount = new BN(50000);
const seccond_asset_amount = first_asset_amount.div(new BN(2))
const defaultCurrecyValue = new BN(250000);
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

describe('xyk-pallet - treasury tests [Mangata]: on treasury we store', () => {
	
	let testUser1 : User;
	let sudo : User;

	let keyring : Keyring;
	let secondCurrency :BN;
	let mgaTokenId:BN;

  //creating pool

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

		await waitNewBlock();
		mgaTokenId  = await getAssetId(MGA_ASSET_NAME);
		await sudo.mint(mgaTokenId, testUser1,new BN(defaultCurrecyValue));
		testUser1.addAsset(mgaTokenId);
	    secondCurrency = (await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue], sudo))[0];
		await testUser1.addMGATokens(sudo);
		await signSendAndWaitToFinishTx( 
			api?.tx.xyk.createPool(mgaTokenId, first_asset_amount, secondCurrency, seccond_asset_amount), 
			testUser1.keyRingPair 
		);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

    // setup users
    testUser1 = new User(keyring);

    sudo = new User(keyring, sudoUserName);

		await waitNewBlock();
		const sellAssetAmount = new BN(10000);
		
		const treasuryBefore = await getTreasury(mgaTokenId);
		const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

		await sellAsset(testUser1.keyRingPair, mgaTokenId, secondCurrency, sellAssetAmount, new BN(1))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		
		const { treasury ,  } = calculateFees(sellAssetAmount);
		
		const treasuryAfter = await getTreasury(mgaTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

		expect(treasuryAfter).bnEqual(treasuryBefore.add(treasury));
		expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
		await validateTreasuryAmountsEqual(secondCurrency,[new BN(0),new BN(0)]);
		
	});

	test('assets won when assets are bought [Buying Mangata]', async () => {
		await waitNewBlock();
		const buyAssetAmount = new BN(10000);
		
		const treasuryBefore = await getTreasury(mgaTokenId);
		const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

		const sellPrice = await calculate_buy_price_rpc(seccond_asset_amount,first_asset_amount,buyAssetAmount);
		const poolBalance = await getBalanceOfPool(mgaTokenId,secondCurrency);
		const { treasury , } = calculateFees(sellPrice);
		const feeInMGAPrice = await calculate_sell_price_rpc(poolBalance[1],poolBalance[0],treasury);

		await buyAsset(testUser1.keyRingPair, secondCurrency, mgaTokenId, buyAssetAmount, new BN(100000000))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);

		const treasuryAfter = await getTreasury(mgaTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

		expect(treasuryAfter).bnEqual(treasuryBefore.add(feeInMGAPrice));
		expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
		await validateTreasuryAmountsEqual(secondCurrency,[new BN(0),new BN(0)]);
	});

    //pool is [50000M,25000Y]
    //user sell [10000] of M.
    //Stano sheet tells: Treasury- 5 , burned destroyed!
    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

		await waitNewBlock();
		const sellAssetAmount = new BN(20000);
		
		const treasuryBefore = await getTreasury(mgaTokenId);
		const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

		const { treasury ,  } = calculateFees(sellAssetAmount);
		const poolBalance = await getBalanceOfPool(mgaTokenId,secondCurrency);
		const feeInMGAPrice = await calculate_sell_price_rpc(poolBalance[1],poolBalance[0],treasury);

		await sellAsset(testUser1.keyRingPair, secondCurrency, mgaTokenId, sellAssetAmount, new BN(1))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
		

		await testUser1.refreshAmounts(AssetWallet.AFTER);
				
		const treasuryAfter = await getTreasury(mgaTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

		expect(treasuryAfter).bnEqual(treasuryBefore.add(feeInMGAPrice));
		expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
		await validateTreasuryAmountsEqual(secondCurrency,[new BN(0),new BN(0)]);
		
	});

	test('assets won when assets are bought [Buying other in MGA pool]', async () => {
		await waitNewBlock();
		const buyAssetAmount = new BN(10000);
		
		const treasuryBefore = await getTreasury(mgaTokenId);
		const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

		const sellPrice = await calculate_buy_price_rpc(first_asset_amount, seccond_asset_amount,buyAssetAmount);
		const { treasury , } = calculateFees(sellPrice);

		await buyAsset(testUser1.keyRingPair, mgaTokenId, secondCurrency, buyAssetAmount, new BN(100000000))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);

		const treasuryAfter = await getTreasury(mgaTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

	   	expect(treasuryAfter).bnEqual(treasuryBefore.add(treasury));
		expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
		await validateTreasuryAmountsEqual(secondCurrency,[new BN(0),new BN(0)]);
		
	});

  test("assets won when assets are sold [Selling other in MGA pool] - 6", async () => {
    await waitNewBlock();
    const sellAssetAmount = new BN(20000);

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    await sellAsset(
      testUser1.keyRingPair,
      secondCurrency,
      mgaTokenId,
      sellAssetAmount,
      new BN(1)
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    //pool is [50000M,25000Y]
    //user sell [20000] of Y.
    //Changed to 20kY, in order to unbalance the pools. ->MGA value increases [10Y=6MNG].
    //Stano sheet tells: Treasury- 6 , burned destroyed!

    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(new BN(6)));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
  });

  test("assets won when assets are bought [Buying other in MGA pool]", async () => {
    await waitNewBlock();
    const buyAssetAmount = new BN(10000);

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    await buyAsset(
      testUser1.keyRingPair,
      mgaTokenId,
      secondCurrency,
      buyAssetAmount,
      new BN(100000000)
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    //pool is [50000M,25000Y]
    //user buy [10000] of Y.
    //Stano sheet tells: Treasury- 16 , burned destroyed!
    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(new BN(16)));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
  });
});

describe('xyk-pallet - treasury tests [Connected - Mangata]: on treasury we store', () => {
	
	let testUser1 : User;
	let sudo : User;

	let keyring : Keyring;
	let connectedToMGA : BN, indirectlyConnected :BN;
	let mgaTokenId:BN;

  //creating pool

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    await waitNewBlock();
    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);

    sudo = new User(keyring, sudoUserName);

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);

		await waitNewBlock();
		const sellAssetAmount = new BN(20000);

		const mgPoolAmount = await getBalanceOfPool(mgaTokenId,connectedToMGA);
		const { treasury , } = calculateFees(sellAssetAmount);
		const swapTreasuryInMG = calculate_sell_price_local_no_fee(mgPoolAmount[1], mgPoolAmount[0], treasury);

		const treasuryBefore = await getTreasury(mgaTokenId);
		const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

		await sellAsset(testUser1.keyRingPair, connectedToMGA, indirectlyConnected, sellAssetAmount, new BN(1))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		
		const treasuryAfter = await getTreasury(mgaTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    const swapTreasuryInMG = calculate_sell_price_local_no_fee(
      mgPoolAmount[1],
      mgPoolAmount[0],
      new BN(10)
    );

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

	test('assets won when assets are bought [Buying X connected to MGA pool]', async () => {
		await waitNewBlock();
		const buyAssetAmount = new BN(7000);

		const PoolAmount = await getBalanceOfPool(indirectlyConnected,connectedToMGA);
		
		const sellPrice = await calculate_buy_price_rpc(PoolAmount[1],PoolAmount[0],buyAssetAmount);
		const { treasury , } = calculateFees(sellPrice);

		const mgPoolAmount = await getBalanceOfPool(mgaTokenId,connectedToMGA);
		const swapTreasuryInMG = calculate_sell_price_local_no_fee(mgPoolAmount[1], mgPoolAmount[0], treasury);

		const treasuryBefore = await getTreasury(mgaTokenId);
		const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

		await buyAsset(testUser1.keyRingPair, connectedToMGA, indirectlyConnected, buyAssetAmount, new BN(10000000))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		
		const treasuryAfter = await getTreasury(mgaTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    const mgPoolAmount = await getBalanceOfPool(mgaTokenId, connectedToMGA);

    //10 Is the outcome of the spreasheet created by stano.
    //pool is [50000X,25000Y]
    //user buy [7000] of X.
    //Stano sheet tells: Treasury- 9 [IF SELLING  X. X HAS A POOL WITH MANGATA. Y DOESN'T] scenario.

    //Calculation tell us that 9 of Y belongs to treasury -> sell to swap inMGA
    const swapTreasuryInMG = calculate_sell_price_local_no_fee(
      mgPoolAmount[1],
      mgPoolAmount[0],
      new BN(9)
    );

		await waitNewBlock();
		const sellAssetAmount = new BN(20000);

    await buyAsset(
      testUser1.keyRingPair,
      connectedToMGA,
      indirectlyConnected,
      buyAssetAmount,
      new BN(10000000)
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

		const treasuryBeforeInd = await getTreasury(indirectlyConnected);
		const treasuryBurnBeforeInd = await getTreasuryBurn(indirectlyConnected);

		const { treasury , treasuryBurn} = calculateFees(sellAssetAmount);

		await sellAsset(testUser1.keyRingPair, indirectlyConnected, connectedToMGA, sellAssetAmount, new BN(1))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		
		const treasuryAfter = await getTreasury(mgaTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

		const treasuryAfterInd = await getTreasury(indirectlyConnected);
		const treasuryBurnAfterInd = await getTreasuryBurn(indirectlyConnected);

		expect(treasuryAfter).bnEqual(treasuryBefore);
		expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);

		expect(treasuryAfterInd).bnEqual(treasuryBeforeInd.add(treasury));
		expect(treasuryBurnAfterInd).bnEqual(treasuryBurnBeforeInd.add(treasuryBurn));
		
	});

	test('assets won when assets are bought [Buying Y - X connected toMGA pool] - 6', async () => {
		
		await waitNewBlock();
		const buyAssetAmount = new BN(6000);

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

		const PoolAmount = await getBalanceOfPool(indirectlyConnected,connectedToMGA);
		const sellPrice = await calculate_buy_price_rpc(PoolAmount[1],PoolAmount[0],buyAssetAmount);
		const { treasury,   } = calculateFees(sellPrice);

		const mgPoolAmount = await getBalanceOfPool(mgaTokenId,connectedToMGA);
		const swapTreasuryInMG = calculate_sell_price_local_no_fee(mgPoolAmount[1], mgPoolAmount[0], treasury);


		await buyAsset(testUser1.keyRingPair,connectedToMGA, indirectlyConnected, buyAssetAmount, new BN(1000000))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
				
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		
		const treasuryAfter = await getTreasury(mgaTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

		expect(treasuryAfter).bnEqual(treasuryBefore.add(swapTreasuryInMG));
		expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);

		await validateTreasuryAmountsEqual(indirectlyConnected,[new BN(0),new BN(0)]);
		
	});

    const swapTreasuryInMG = calculate_sell_price_local_no_fee(
      mgPoolAmount[0],
      mgPoolAmount[1],
      new BN(6)
    );

    expect(treasuryAfter).bnEqual(treasuryBefore.add(swapTreasuryInMG));

    //burned destroyed! because is translated toMGA
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(indirectlyConnected, [
      new BN(0),
      new BN(0),
    ]);
  });

  test("assets won when assets are bought [Buying Y - X connected toMGA pool] - 6", async () => {
    await waitNewBlock();
    const buyAssetAmount = new BN(6000);

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    await buyAsset(
      testUser1.keyRingPair,
      connectedToMGA,
      indirectlyConnected,
      buyAssetAmount,
      new BN(1000000)
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);
    const mgPoolAmount = await getBalanceOfPool(connectedToMGA, mgaTokenId);

    //10 Is the outcome of the spreasheet created by stano.
    //pool is [50000X,25000Y]
    //user sell [6000] of Y.
    //Stano sheet tells: Treasury- 7 [IF SELLING  X. Y HAS A POOL WITH MANGATA. X DOESN'T] scenario.

    const swapTreasuryInMG = calculate_sell_price_local_no_fee(
      mgPoolAmount[0],
      mgPoolAmount[1],
      new BN(7)
    );

    expect(treasuryAfter).bnEqual(treasuryBefore.add(swapTreasuryInMG));
    //burned destroyed! because is translated toMGA
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(indirectlyConnected, [
      new BN(0),
      new BN(0),
    ]);
  });
});
