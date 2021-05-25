import {api, getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, signSendAndWaitToFinish, getTreasury, getTreasuryBurn, calculate_buy_price_local, buyAsset, calculate_buy_price_rpc, mintLiquidity} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult, getUserEventResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateAssetsSwappedEvent, validateUnmodified } from "../../utils/validators";
import { Assets } from "../../utils/Assets";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

var firstAssetAmount = new BN(50000);
var secondAssetAmount = new BN(50000);
const defaultCurrecyValue = 250000;

describe('xyk-pallet - Mint liquidity tests: MintLiquidity Errors:', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;

	const pool_balance_before = [new BN(0), new BN(0)];

	beforeAll( async () => {
		try {
			getApi();
		  } catch(e) {
			await initApi();
		}
	});

	beforeEach(async () => {
		await waitNewBlock();
		keyring = new Keyring({ type: 'sr25519' });
	
		// setup users
		testUser1 = new User(keyring);
	
		// build Maciatko, he is sudo. :S
		sudo = new User(keyring, '//Maciatko');
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);
		await testUser1.setBalance(sudo);

	});

	test('Mint liquidity assets that does not belong to any pool', async () => {
		//add two curerncies and balance to testUser:
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
		const [thirdCurrency]= await Assets.setupUserWithCurrencies(testUser1, 1, [defaultCurrecyValue], sudo);
		//lets create a pool between asset 1 and 3.
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(firstCurrency, firstAssetAmount, thirdCurrency,secondAssetAmount), 
			testUser1.keyRingPair 
		);
		await waitNewBlock();
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
				
		//lets try to mint with asset 1 and 2
		let eventPromise = getUserEventResult("xyk", "LiquidityMinted", 14, testUser1.keyRingPair.address);
		mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, firstAssetAmount);
		let eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(3);

		await waitNewBlock();
		//lets try to mint with asset 2 and 3
		eventPromise = getUserEventResult("xyk", "LiquidityMinted", 14, testUser1.keyRingPair.address);
		mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, firstAssetAmount);
		eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(3);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		await validateUnmodified(firstCurrency, secondCurrency, testUser1, pool_balance_before);

	});

	test.skip('Buy more assets than exists in the pool', async () => {
		await waitNewBlock();
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
		await testUser1.setBalance(sudo);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		const poolAmountSecondCurrency = secondAssetAmount.div(new BN(2));
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(firstCurrency, firstAssetAmount, secondCurrency,poolAmountSecondCurrency), 
			testUser1.keyRingPair 
		);
		await waitNewBlock();
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		
		let eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
		buyAsset(testUser1.keyRingPair, firstCurrency, secondCurrency, poolAmountSecondCurrency.add(new BN(1)), new BN(1000000));
		let eventResponse =await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(5);

		validateUnmodified(firstCurrency,secondCurrency,testUser1,[firstAssetAmount, poolAmountSecondCurrency]);

	});

	test.skip('Buy all assets from the the pool', async () => {
		await waitNewBlock();
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
		await testUser1.setBalance(sudo);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		const poolAmountSecondCurrency = secondAssetAmount.div(new BN(2));
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(firstCurrency, firstAssetAmount, secondCurrency,poolAmountSecondCurrency), 
			testUser1.keyRingPair 
		);
		await waitNewBlock();
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		
		let eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
		buyAsset(testUser1.keyRingPair, firstCurrency, secondCurrency, poolAmountSecondCurrency, new BN(100000000));
		let eventResponse =await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(5);

		validateUnmodified(firstCurrency,secondCurrency,testUser1,[firstAssetAmount, poolAmountSecondCurrency]);

	});

	test.skip('Buy assets with a high expectation: maxInput -1', async () => {
		await waitNewBlock();
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
		await testUser1.setBalance(sudo);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		const poolAmountSecondCurrency = secondAssetAmount.div(new BN(2));
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(firstCurrency, firstAssetAmount, secondCurrency,poolAmountSecondCurrency), 
			testUser1.keyRingPair 
		);
		await waitNewBlock();

		let buyPriceLocal = await calculate_buy_price_rpc(firstAssetAmount, poolAmountSecondCurrency, poolAmountSecondCurrency.sub(new BN(1)));
		
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		await sudo.mint(firstCurrency, testUser1,new BN(buyPriceLocal));
		
		let eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
		buyAsset(testUser1.keyRingPair, firstCurrency, secondCurrency, poolAmountSecondCurrency.sub(new BN(1)), buyPriceLocal.sub(new BN(1)));
		let eventResponse =await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(7);
		
		validateUnmodified(firstCurrency,secondCurrency,testUser1,[firstAssetAmount, secondAssetAmount.div(new BN(2))]);
	});

});


describe.skip('xyk-pallet - Buy assets tests: Buying assets you can', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;

	//creating pool
	
	beforeAll( async () => {
		try {
			getApi();
		  } catch(e) {
			await initApi();
		}
	});

	beforeEach(async () => {
		await waitNewBlock();
		keyring = new Keyring({ type: 'sr25519' });
	
		// setup users
		testUser1 = new User(keyring);
	
		// build Maciatko, he is sudo. :S
		sudo = new User(keyring, '//Maciatko');
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);

	});


	test('Leave only one asset in the pool', async () => {
		await waitNewBlock();
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
		await testUser1.setBalance(sudo);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		const poolAmountSecondCurrency = secondAssetAmount.div(new BN(2));
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(firstCurrency, firstAssetAmount, secondCurrency,poolAmountSecondCurrency), 
			testUser1.keyRingPair 
		);
		await waitNewBlock();

		let buyPriceLocal = await calculate_buy_price_rpc(firstAssetAmount, poolAmountSecondCurrency, poolAmountSecondCurrency.sub(new BN(1)));
		
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		await waitNewBlock();
		await sudo.mint(firstCurrency, testUser1,new BN(buyPriceLocal));
		
		let eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
		buyAsset(testUser1.keyRingPair, firstCurrency, secondCurrency, poolAmountSecondCurrency.sub(new BN(1)), buyPriceLocal.add(new BN(1)));
		let eventResponse =await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
		await waitNewBlock();
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
		expect([buyPriceLocal.add(firstAssetAmount), new BN(1)])
		.toEqual(pool_balance);

		testUser1.validateWalletIncreased(secondCurrency,poolAmountSecondCurrency.sub(new BN(1)));
		testUser1.validateWalletEquals(firstCurrency, testUser1.getAsset(firstCurrency)?.amountBefore! );

		//lets get the treasure amounts!
		const treasurySecondCurrency = await getTreasury(secondCurrency);
		const treasuryFirstCurrency = await getTreasury(firstCurrency);
		const treasuryBurnSecondCurrency = await getTreasuryBurn(secondCurrency);
		const treasuryBurnFirstCurrency = await getTreasuryBurn(firstCurrency);

		expect([treasurySecondCurrency,treasuryBurnSecondCurrency]).toEqual(['0','0'])
		expect([treasuryFirstCurrency,treasuryBurnFirstCurrency]).toEqual(['0','0'])

	});
	
	test('Buy from a wallet I own into a wallet I do not own', async () => {
		await waitNewBlock();
		const thirdAssetAmount = new BN(10000);
		const amountToBuy = new BN(2000);
		// setup users
		const testUser2 = new User(keyring);
		keyring.addPair(testUser2.keyRingPair);
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
		const [thirdCurrency] = await Assets.setupUserWithCurrencies(testUser2, 1, [defaultCurrecyValue], sudo);
		
		await sudo.mint(thirdCurrency, testUser1, thirdAssetAmount);
		await testUser1.setBalance(sudo);
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(firstCurrency, firstAssetAmount, secondCurrency, secondAssetAmount.div(new BN(2))), 
			testUser1.keyRingPair 
		);
		// create a pool between First and Third, P(thirdAssetAmount, thirdAssetAmount/2)
		
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(firstCurrency, thirdAssetAmount , thirdCurrency, thirdAssetAmount.div(new BN(2))), 
			testUser1.keyRingPair 
		);
		var poolBalanceBefore = await getBalanceOfPool(firstCurrency, thirdCurrency);

		await testUser2.refreshAmounts(AssetWallet.BEFORE);
		await waitNewBlock();
		let buyPriceLocal = calculate_buy_price_local(thirdAssetAmount.div(new BN(2)), thirdAssetAmount, amountToBuy);

		let eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser2.keyRingPair.address);
		buyAsset(testUser2.keyRingPair, thirdCurrency, firstCurrency, amountToBuy, buyPriceLocal);
		let eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		validateAssetsSwappedEvent(eventResponse, testUser2.keyRingPair.address,thirdCurrency, buyPriceLocal, firstCurrency, amountToBuy);
		
		testUser2.addAsset(firstCurrency);
		await testUser2.refreshAmounts(AssetWallet.AFTER);
		testUser2.validateWalletReduced(thirdCurrency, buyPriceLocal);
		testUser2.validateWalletEquals(firstCurrency, amountToBuy);

		var poolBalanceAfter = await getBalanceOfPool(firstCurrency, thirdCurrency);
		expect([poolBalanceBefore[0].sub(amountToBuy), poolBalanceBefore[1].add(buyPriceLocal)])
		.toEqual(poolBalanceAfter);

	});

});
