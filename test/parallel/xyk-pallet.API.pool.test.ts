import {getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, getLiquidityAssetId, getAssetSupply, getNextAssetId, mintLiquidity, burnLiquidity, createPool} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult, EventResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateAssetsWithValues, validatePoolCreatedEvent, validateStatusWhenPoolCreated } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { calculateLiqAssetAmount, getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromTxWait } from "../../utils/txHandler";
import { testLog } from "../../utils/Logger";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';
const {sudo:sudoUserName} = getEnvironmentRequiredVars();

var first_asset_amount = new BN(50000);
var second_asset_amount = new BN(50000);
const defaultCurrecyValue = new BN(250000);

describe('xyk-pallet - Sell Asset: validate Errors:', () => {
	
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
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue,defaultCurrecyValue.add(new BN(1))], sudo);
		await testUser1.addMGATokens(sudo);
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);
	
		// check users accounts.
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		validateAssetsWithValues([testUser1.getAsset(firstCurrency)?.amountBefore!,testUser1.getAsset(secondCurrency)?.amountBefore! ], [defaultCurrecyValue.toNumber(), defaultCurrecyValue.add(new BN(1)).toNumber()]);
		
		let eventResponse: EventResult = new EventResult(0,'');
		await createPool(testUser1.keyRingPair, firstCurrency, first_asset_amount, secondCurrency, second_asset_amount)
			.then(
			  (result) => {
				  eventResponse = getEventResultFromTxWait(result, ["xyk","PoolCreated", testUser1.keyRingPair.address]);
				  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			  }
		  );
			
		//validate the content of the event about the pool creation.
		validatePoolCreatedEvent(eventResponse, testUser1.keyRingPair.address, firstCurrency, first_asset_amount, secondCurrency, second_asset_amount);

	
	});
	test('Create x-y and y-x pool', async () => {
		await waitNewBlock();
		testLog.getLog().info("testUser1: creating pool already created " + firstCurrency + " - " + secondCurrency);
		await createPool(testUser1.keyRingPair ,secondCurrency, new BN(666), firstCurrency, new BN(666))
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
					expect(eventResponse.data).toEqual(1);				
				}
			);			
			
	});
	test('Create pool with zero', async () => {
		await waitNewBlock();
		const nextAssetId = await getNextAssetId();
		const emptyAssetID = new BN(nextAssetId.toString());
	
		await createPool(testUser1.keyRingPair ,firstCurrency, new BN(0), emptyAssetID, new BN(0))
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
					expect(eventResponse.data).toEqual(6);				
				}
			);		
		
		const balance = await getBalanceOfPool(firstCurrency, emptyAssetID);
		expect(balance).toEqual([new BN(0), new BN(0)]);
	
	});
	test('Not enough assets', async () => {
		await waitNewBlock();
		const txAmount = new BN(100000000000000);
		const testAssetId = await Assets.setupUserWithCurrencies(testUser1, [txAmount], sudo);

		await createPool(testUser1.keyRingPair ,firstCurrency,new BN(txAmount).add(new BN(1)), testAssetId[0], new BN(txAmount).add(new BN(1)))
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
					expect(eventResponse.data).toEqual(2);				
				}
			);	

		const balance = await getBalanceOfPool(firstCurrency, testAssetId[0]);
		expect(balance).toEqual([new BN(0), new BN(0)]);
	
	});
	
	afterEach(async () => {
		await validateStatusWhenPoolCreated(firstCurrency, secondCurrency, testUser1, pool_balance_before, total_liquidity_assets_before);
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

		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue,defaultCurrecyValue.add(new BN(1))], sudo);
		await testUser1.addMGATokens(sudo);
		await testUser1.createPoolToAsset(first_asset_amount,second_asset_amount,firstCurrency,secondCurrency);
		await testUser2.addMGATokens(sudo);
		await sudo.mint(firstCurrency, testUser2, new BN(10000));
		await sudo.mint(secondCurrency, testUser2, new BN(10000));
		
		await testUser2.addAssets([firstCurrency, secondCurrency]);
		await testUser2.refreshAmounts(AssetWallet.BEFORE);
		validateAssetsWithValues([testUser2.getAsset(firstCurrency)?.amountBefore!,testUser2.getAsset(secondCurrency)?.amountBefore!], [10000, 10000]);
			
	})

	test('be minted', async () => {
	
		await mintLiquidity(testUser2.keyRingPair, firstCurrency, secondCurrency, new BN(5000))
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result, ["xyk", "LiquidityMinted", testUser2.keyRingPair.address]);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
				}
			);	
		
		var liquidity_asset_id = await getLiquidityAssetId(firstCurrency, secondCurrency);
		var liquidity_assets_minted = calculateLiqAssetAmount(first_asset_amount, second_asset_amount);
		testUser2.addAsset(liquidity_asset_id, new BN(0));
		await testUser2.refreshAmounts(AssetWallet.AFTER);

		await testUser2.validateWalletIncreased(liquidity_asset_id, new BN(5000));
		await testUser2.validateWalletReduced(firstCurrency, new BN(5000));
		await testUser2.validateWalletReduced(secondCurrency, new BN(5000).add(new BN(1)));
		//TODO: pending to validate.
		var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
		expect	([	new BN(first_asset_amount).add(new BN(5000)),	
					new BN(second_asset_amount).add(new BN(5000).add(new BN(1)))	])
		.toEqual(pool_balance);
	
		var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
		expect(liquidity_assets_minted.add(new BN(5000)))
		.toEqual(total_liquidity_assets);

	});

	test('be burn', async () => {

		testLog.getLog().info("User: minting liquidity " + firstCurrency + " - " + secondCurrency);
		await mintLiquidity(testUser2.keyRingPair, firstCurrency, secondCurrency, new BN(5000))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "LiquidityMinted", testUser2.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
		await testUser2.refreshAmounts(AssetWallet.BEFORE);

		var liquidity_asset_id = await getLiquidityAssetId(firstCurrency, secondCurrency);
		var liquidity_assets_minted = calculateLiqAssetAmount(first_asset_amount,second_asset_amount);

		testUser2.addAsset(liquidity_asset_id, new BN(0));
		await testUser2.refreshAmounts(AssetWallet.BEFORE);
		
		testLog.getLog().info("User: burn liquidity " + firstCurrency + " - " + secondCurrency);
		await burnLiquidity(testUser2.keyRingPair, firstCurrency, secondCurrency, new BN(2500))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "LiquidityBurned", testUser2.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
		
		
		await testUser2.refreshAmounts(AssetWallet.AFTER);
		await testUser2.validateWalletReduced(liquidity_asset_id, new BN(2500));
		await testUser2.validateWalletIncreased(firstCurrency, new BN(2500));
		await testUser2.validateWalletIncreased(secondCurrency, new BN(2500));
		//TODO: pending to validate.
		var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
		expect	([	new BN(first_asset_amount).add(new BN(2500)),	
					new BN(second_asset_amount).add(new BN(2500).add(new BN(1)))	])
		.collectionBnEqual(pool_balance);
	
		var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
		expect(liquidity_assets_minted.add(new BN(2500)))
		.toEqual(total_liquidity_assets);
	});

	afterEach(async () => {
		// those values must not change.
		var liquidity_asset_id = await getLiquidityAssetId(firstCurrency, secondCurrency);
		var liquidity_assets_minted = calculateLiqAssetAmount(first_asset_amount,second_asset_amount);
	
		testUser1.addAsset(liquidity_asset_id, new BN(0));
		//validate
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		await testUser1.validateWalletReduced(firstCurrency, first_asset_amount);
		await testUser1.validateWalletReduced(secondCurrency, second_asset_amount);
		await testUser1.validateWalletIncreased(liquidity_asset_id, liquidity_assets_minted);
	
		
	});
});

