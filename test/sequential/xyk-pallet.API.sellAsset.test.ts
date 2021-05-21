import {api, getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, signSendAndWaitToFinish, sellAsset, calculate_sell_price_local} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult, getUserEventResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateUnmodified } from "../../utils/validators";
import { Assets } from "../../utils/Assets";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

var first_asset_amount = new BN(50000);
var second_asset_amount = new BN(50000);
const defaultCurrecyValue = 250000;

describe('xyk-pallet - Pool tests: createPool Errors:', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;

	//creating pool
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

	});
	test('Sell assets that does not belong to any pool', async () => {
		//add two curerncies and balance to testUser:
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

		await waitNewBlock();
		const [thirdCurrency]= await Assets.setupUserWithCurrencies(testUser1, 1, [defaultCurrecyValue], sudo);
		let eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
		
		sellAsset(testUser1.keyRingPair, thirdCurrency, secondCurrency, first_asset_amount.div(new BN(2)), new BN(0));
		let eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(3);
		await waitNewBlock();

		sellAsset(testUser1.keyRingPair, secondCurrency, thirdCurrency, first_asset_amount.div(new BN(2)), new BN(0));
		eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(3);

		await validateUnmodified(firstCurrency, secondCurrency, testUser1, pool_balance_before);

	});

	test('Try Sell more assets than owned', async () => {
		await waitNewBlock();
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
		await testUser1.setBalance(sudo);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(firstCurrency, first_asset_amount, secondCurrency, second_asset_amount.div(new BN(2))), 
			testUser1.keyRingPair 
		);
		await waitNewBlock();
		let remainingOfCurrency1 = testUser1.getAsset(firstCurrency)?.amountBefore!.sub(first_asset_amount)!;
		let sellPriceLocal = calculate_sell_price_local(first_asset_amount, second_asset_amount.div(new BN(2)), remainingOfCurrency1.sub(new BN(1)));

		let eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
		sellAsset(testUser1.keyRingPair, firstCurrency, secondCurrency, remainingOfCurrency1.sub(new BN(1)), new BN(0));
		let eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
		await waitNewBlock();
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		remainingOfCurrency1 = testUser1.getAsset(firstCurrency)?.amountAfter!;
		expect(remainingOfCurrency1).toEqual(new BN(1));
		
		
		let secondWalletAmount = new BN(defaultCurrecyValue +1).sub(second_asset_amount.div(new BN(2))).add(sellPriceLocal);

		eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
		sellAsset(testUser1.keyRingPair, firstCurrency, secondCurrency, remainingOfCurrency1.add(new BN(1)), new BN(0));
		eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(2);

		await testUser1.refreshAmounts(AssetWallet.AFTER);
		await testUser1.validateWalletReduced(firstCurrency, new BN(defaultCurrecyValue).sub(new BN(1)));
		await testUser1.validateWalletEquals(secondCurrency, secondWalletAmount );
	
		var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);

		// the user only has 1 asset of X -> pool must have : 250k -1
		// the user has "secondWalletAmount", so the remaining must be in the pool.
		// Using Stano formulas, doing a Tx of 200k when the pool has 25k of X and 50k of Y -> 2 units gets burn.
		const burned = new BN(2);
		const secondWalletInThePool = new BN(defaultCurrecyValue +1).sub(secondWalletAmount);
		expect([new BN(249999), secondWalletInThePool.sub(burned)])
			.toEqual(pool_balance);

	});

});
