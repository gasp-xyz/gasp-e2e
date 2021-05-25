import {api, getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, getLiquidityAssetId, getAssetSupply, signSendAndWaitToFinish, getNextAssetId, mintLiquidity, burnLiquidity} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult, getUserEventResult, getEventResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateAssetsWithValues, validatePoolCreatedEvent } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';
const {sudo:sudoUserName} = getEnvironmentRequiredVars();

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
	const total_liquidity_assets_before = new BN(0);

	beforeAll( async () => {
		try {
			getApi();
		  } catch(e) {
			await initApi();
		}
	
		await waitNewBlock();
		keyring = new Keyring({ type: 'sr25519' });
	
		// setup users
		testUser1 = new User(keyring);
	
		sudo = new User(keyring, sudoUserName);
		
		//add two curerncies and balance to testUser:
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
		await testUser1.setBalance(sudo);
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);
	
		// check users accounts.
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		validateAssetsWithValues([testUser1.getAsset(firstCurrency)?.amountBefore!,testUser1.getAsset(secondCurrency)?.amountBefore! ], [defaultCurrecyValue, defaultCurrecyValue+1]);
			
		  console.log("testUser1: creating pool " + firstCurrency + " - " + secondCurrency);
		  var eventPromise = getUserEventResult("xyk","PoolCreated", 14, testUser1.keyRingPair.address);
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(firstCurrency, first_asset_amount, secondCurrency, second_asset_amount), 
			testUser1.keyRingPair );
		var eventResponse = await eventPromise;
		//validate the content of the event about the pool creation.
		validatePoolCreatedEvent(eventResponse, testUser1.keyRingPair.address, firstCurrency, first_asset_amount, secondCurrency, second_asset_amount);
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
	
	});
	test('Create x-y and y-x pool', async () => {
		await waitNewBlock();
		console.log("testUser1: creating pool already created " + firstCurrency + " - " + secondCurrency);
		var eventPromise = getEventResult("xyk","PoolCreated", 14);
		await signSendAndWaitToFinish( api?.tx.xyk.createPool(secondCurrency, new BN(666), firstCurrency, new BN(666)), testUser1.keyRingPair );
		var eventResponse = await eventPromise;
		  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(1);
	
	});
	test('Create pool with zero', async () => {
		await waitNewBlock();
		const nextAssetId = await getNextAssetId();
		const emptyAssetID = new BN(nextAssetId.toString());
	
		var eventPromise = getEventResult("xyk","PoolCreated", 14);
		await signSendAndWaitToFinish( api?.tx.xyk.createPool(firstCurrency, new BN(0), emptyAssetID, new BN(0)), testUser1.keyRingPair );
		var eventResponse = await eventPromise;
		  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(6);
		const balance = await getBalanceOfPool(firstCurrency, emptyAssetID);
		expect(balance).toEqual([new BN(0), new BN(0)]);
	
	});
	test('Not enough assets', async () => {
		await waitNewBlock();
		const txAmount = 100000000000000;
		const testAssetId = await Assets.setupUserWithCurrencies(testUser1, 1, [txAmount], sudo);
		var eventPromise = getUserEventResult("xyk","PoolCreated", 14, txAmount.toString());
		await signSendAndWaitToFinish( api?.tx.xyk.createPool(firstCurrency, new BN(txAmount).add(new BN(1)), testAssetId[0], new BN(txAmount).add(new BN(1))), testUser1.keyRingPair );
		var eventResponse = await eventPromise;
		  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(2); //NotEnoughAssets
		const balance = await getBalanceOfPool(firstCurrency, testAssetId[0]);
		expect(balance).toEqual([new BN(0), new BN(0)]);
	
	});
	
	afterEach(async () => {
	
		var liquidity_asset_id = await getLiquidityAssetId(firstCurrency, secondCurrency);
		var liquidity_assets_minted = first_asset_amount.add(second_asset_amount);
	
		testUser1.addAsset(liquidity_asset_id, new BN(0));
		//validate
		await testUser1.refreshAmounts(AssetWallet.AFTER);
	
		await testUser1.validateWalletReduced(firstCurrency, first_asset_amount);
		await testUser1.validateWalletReduced(secondCurrency, second_asset_amount);
		await testUser1.validateWalletIncreased(liquidity_asset_id, liquidity_assets_minted);
	
		//TODO: pending to validate.
		var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
		expect	([	pool_balance_before[0].add(first_asset_amount),	
					pool_balance_before[1].add(second_asset_amount)	])
		.toEqual(pool_balance);
	
		const balance = await getBalanceOfPool(secondCurrency, firstCurrency);
		expect	([	pool_balance_before[0].add(first_asset_amount),	
		pool_balance_before[1].add(second_asset_amount)	])
		.toEqual([balance[1], balance[0]]);
	
		var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
		expect(total_liquidity_assets_before.add(liquidity_assets_minted))
		.toEqual(total_liquidity_assets);
	});
});

describe('xyk-pallet - Pool tests: a pool can:', () => {
	
	let testUser1 : User;
	let testUser2 : User;
	let keyring : Keyring;

	let firstCurrency :BN;
	let secondCurrency :BN;

	beforeEach( async () => {
		try {
			getApi();
		  } catch(e) {
			await initApi();
		}

		keyring = new Keyring({ type: 'sr25519' });
		// setup a second user
		testUser2 = new User(keyring);
		testUser1 = new User(keyring);
		let sudo = new User(keyring, sudoUserName)
		keyring.addPair(testUser2.keyRingPair);
		keyring.addPair(testUser1.keyRingPair);
		
		//add two curerncies and balance to testUser2:

		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo);
		await testUser1.setBalance(sudo);
		await testUser1.createPoolToAsset(first_asset_amount,second_asset_amount,firstCurrency,secondCurrency);
		await testUser2.setBalance(sudo);
		await sudo.mint(firstCurrency, testUser2, new BN(10000));
		await sudo.mint(secondCurrency, testUser2, new BN(10000));
		
		await testUser2.addAssets([firstCurrency, secondCurrency]);
		await testUser2.refreshAmounts(AssetWallet.BEFORE);
		validateAssetsWithValues([testUser2.getAsset(firstCurrency)?.amountBefore!,testUser2.getAsset(secondCurrency)?.amountBefore!], [10000, 10000]);
			
	})

	test('be minted', async () => {
	
		console.log("User: minting liquidity " + firstCurrency + " - " + secondCurrency);
		const eventPromise = getUserEventResult("xyk", "LiquidityMinted", 14, testUser2.keyRingPair.address);
		mintLiquidity(testUser2.keyRingPair, firstCurrency, secondCurrency, new BN(5000));
		const eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

		var liquidity_asset_id = await getLiquidityAssetId(firstCurrency, secondCurrency);
		var liquidity_assets_minted = first_asset_amount.add(second_asset_amount);
		testUser2.addAsset(liquidity_asset_id, new BN(0));
		await testUser2.refreshAmounts(AssetWallet.AFTER);

		await testUser2.validateWalletIncreased(liquidity_asset_id, new BN(10000));
		await testUser2.validateWalletReduced(firstCurrency, new BN(5000));
		await testUser2.validateWalletReduced(secondCurrency, new BN(5000).add(new BN(1)));
		//TODO: pending to validate.
		var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
		expect	([	new BN(first_asset_amount).add(new BN(5000)),	
					new BN(second_asset_amount).add(new BN(5000).add(new BN(1)))	])
		.toEqual(pool_balance);
	
		var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
		expect(liquidity_assets_minted.add(new BN(10000)))
		.toEqual(total_liquidity_assets);

	});

	test('be burn', async () => {

		console.log("User: minting liquidity " + firstCurrency + " - " + secondCurrency);
		let eventPromise = getUserEventResult("xyk", "LiquidityMinted", 14, testUser2.keyRingPair.address);
		mintLiquidity(testUser2.keyRingPair, firstCurrency, secondCurrency, new BN(5000));
		let eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

		var liquidity_asset_id = await getLiquidityAssetId(firstCurrency, secondCurrency);
		var liquidity_assets_minted = first_asset_amount.add(second_asset_amount);

		testUser2.addAsset(liquidity_asset_id, new BN(0));
		await testUser2.refreshAmounts(AssetWallet.BEFORE);
		
		console.log("User: burn liquidity " + firstCurrency + " - " + secondCurrency);
		eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, testUser2.keyRingPair.address);
		burnLiquidity(testUser2.keyRingPair, firstCurrency, secondCurrency, new BN(5000));
		eventResponse = await eventPromise;
		  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
		await testUser2.refreshAmounts(AssetWallet.AFTER);
		await testUser2.validateWalletReduced(liquidity_asset_id, new BN(5000));
		await testUser2.validateWalletIncreased(firstCurrency, new BN(2500));
		await testUser2.validateWalletIncreased(secondCurrency, new BN(2500));
		//TODO: pending to validate.
		var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
		expect	([	new BN(first_asset_amount).add(new BN(2500)),	
					new BN(second_asset_amount).add(new BN(2500).add(new BN(1)))	])
		.toEqual(pool_balance);
	
		var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
		expect(liquidity_assets_minted.add(new BN(5000)))
		.toEqual(total_liquidity_assets);
	});

	afterEach(async () => {
		// those values must not change.
		var liquidity_asset_id = await getLiquidityAssetId(firstCurrency, secondCurrency);
		var liquidity_assets_minted = first_asset_amount.add(second_asset_amount);
	
		testUser1.addAsset(liquidity_asset_id, new BN(0));
		//validate
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		await testUser1.validateWalletReduced(firstCurrency, first_asset_amount);
		await testUser1.validateWalletReduced(secondCurrency, second_asset_amount);
		await testUser1.validateWalletIncreased(liquidity_asset_id, liquidity_assets_minted);
	
		
	});
});

