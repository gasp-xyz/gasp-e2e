import {api, getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, signSendAndWaitToFinish, getLiquidityAssetId, burnLiquidity, getBalanceOfAsset, calculate_buy_price_local, getLiquidityPool} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult, getUserEventResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateMintedLiquidityEvent, validateTreasuryAmountsEqual, validateUnmodified } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";

const {sudo:sudoUserName} = getEnvironmentRequiredVars();

jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

const defaultCurrecyValue = 250000;


describe('xyk-pallet - Burn liquidity tests: when burning liquidity you can', () => {
	
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
	
		sudo = new User(keyring, sudoUserName);
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);

	});

	test('Get affected after a transaction that devaluates X wallet & destroy the pool', async () => {
		const assetXamount = 1000;
		const assetYamount = 10;
		//create a new user
		const testUser2 = new User(keyring);
		keyring.addPair(testUser2.keyRingPair);
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [assetXamount,assetYamount], sudo);
		await testUser1.setBalance(sudo);
		//lets create a pool with equal balances
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(firstCurrency, new BN(assetXamount), secondCurrency,new BN(assetYamount)), 
			testUser1.keyRingPair 
		);

		const liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);
		const liquidityPoolBeforeDestroy = await getLiquidityPool(liquidityAssetId);

		await testUser2.setBalance(sudo);
		const amountOfX = calculate_buy_price_local(new BN(assetXamount),new BN(assetYamount),new BN(9));
		await sudo.mint(firstCurrency,testUser2,amountOfX);
		await testUser2.buyAssets(firstCurrency,secondCurrency, new BN(9), amountOfX.add(new BN(1)));
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

		const eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, testUser1.keyRingPair.address);
		burnLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, new BN(assetXamount + assetYamount));
		const eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
		const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
		let poolBalance = await getBalanceOfPool(firstCurrency,secondCurrency);
		let liquidity = await getBalanceOfAsset(liqId, testUser1.keyRingPair.address);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		testUser1.validateWalletEquals(firstCurrency,amountOfX.add(new BN(assetXamount)));
		testUser1.validateWalletEquals(secondCurrency,new BN(1));

		expect([new BN(0),new BN(0)]).toEqual(poolBalance);
		expect(liquidity).toEqual(new BN(0));

		//Validate liquidity pool is destroyed.
		const liquidityPool = await getLiquidityPool(liquidityAssetId);
		expect(liquidityPool[0]).toEqual(new BN(-1));
		expect(liquidityPool[1]).toEqual(new BN(-1));
		
		expect(liquidityPoolBeforeDestroy[0]).toEqual(firstCurrency);
		expect(liquidityPoolBeforeDestroy[1]).toEqual(secondCurrency);

		
	});

	test('Burning liquidities provides Burn and settle', async () => {

		await waitNewBlock();
		// The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
		[firstCurrency, secondCurrency] = await UserCreatesAPoolAndMintliquidity(testUser1, sudo, new BN(defaultCurrecyValue), new BN(defaultCurrecyValue).div(new BN(2)),new BN(defaultCurrecyValue).div(new BN(4)) );
		
		const eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, testUser1.keyRingPair.address);
		burnLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, new BN(defaultCurrecyValue).div(new BN(4)));
		const eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

		await testUser1.refreshAmounts(AssetWallet.AFTER);
		//TODO: Make tx big enough to get treasury units.
		await validateTreasuryAmountsEqual(firstCurrency,['0','0']);
		await validateTreasuryAmountsEqual(secondCurrency,['0','0']);

	});

	test('Burning liquidities generates a Liquidity burned event', async () => {

		await waitNewBlock();
		// The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
		[firstCurrency, secondCurrency] = await UserCreatesAPoolAndMintliquidity(testUser1, sudo, new BN(defaultCurrecyValue), new BN(defaultCurrecyValue).div(new BN(2)),new BN(defaultCurrecyValue).div(new BN(4)) );
		const burnAmount = new BN(defaultCurrecyValue).div(new BN(4));
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		const eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, testUser1.keyRingPair.address);
		burnLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, burnAmount);
		const eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		const secondCurrencyAmount = testUser1.getAsset(secondCurrency)?.amountAfter.sub(testUser1.getAsset(secondCurrency)?.amountBefore!)!;
		const firstCurrencyAmount = testUser1.getAsset(firstCurrency)?.amountAfter.sub(testUser1.getAsset(firstCurrency)?.amountBefore!)!;
		const liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);

		validateMintedLiquidityEvent(eventResponse, testUser1.keyRingPair.address, firstCurrency, firstCurrencyAmount, secondCurrency, secondCurrencyAmount, liquidityAssetId);
		
	});


});

describe('xyk-pallet - Burn liquidity tests: BurnLiquidity Errors:', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;

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
	
		sudo = new User(keyring, sudoUserName);
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);
		await testUser1.setBalance(sudo);

	});

	test('Burn liquidity assets that does not belong to any pool', async () => {
		await testUser1.setBalance(sudo);
		const [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue, defaultCurrecyValue], sudo);
		const eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, testUser1.keyRingPair.address);
		burnLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, new BN(1));
		const eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(3);

	});

	test('Burn liquidity  for more assets than the liquidity pool has issued', async () => {
		const poolAmount = new BN(defaultCurrecyValue).div(new BN(2));
		[firstCurrency,secondCurrency] = await UserCreatesAPoolAndMintliquidity(testUser1, sudo, new BN(defaultCurrecyValue),poolAmount);
		let poolBalance = await getBalanceOfPool(firstCurrency,secondCurrency);
		const liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);
		const liquidityBalance = await getBalanceOfAsset(liquidityAssetId, testUser1.keyRingPair.address);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		
		const eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, testUser1.keyRingPair.address);
		burnLiquidity(testUser1.keyRingPair, firstCurrency,secondCurrency, liquidityBalance.add(new BN(1)) );
		const eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(2);

		await validateUnmodified(firstCurrency,secondCurrency,testUser1,poolBalance);

	});

	test('Burn someone else liquidities', async () => {
		//create a new user
		const testUser2 = new User(keyring);
		keyring.addPair(testUser2.keyRingPair);
		await testUser2.setBalance(sudo);
		[firstCurrency,secondCurrency] = await UserCreatesAPoolAndMintliquidity(testUser1, sudo, new BN(defaultCurrecyValue));
		
		const liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);
		testUser1.addAsset(liquidityAssetId);
		const aFewAssetsToBurn = new BN(1000);
		const eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, testUser2.keyRingPair.address);
		burnLiquidity(testUser2.keyRingPair, firstCurrency,secondCurrency, aFewAssetsToBurn );
		const eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
		expect(eventResponse.data).toEqual(2);

	});

});


async function UserCreatesAPoolAndMintliquidity(
	testUser1: User, sudo: User
	, userAmount : BN 
	, poolAmount : BN = new BN(userAmount).div(new BN(2))
	, mintAmount: BN = new BN(userAmount).div(new BN(4))) {

	await waitNewBlock();
	const [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [parseInt(userAmount.toString()), parseInt(userAmount.toString())], sudo);
	await testUser1.setBalance(sudo);
	await signSendAndWaitToFinish(
		api?.tx.xyk.createPool(firstCurrency, poolAmount, secondCurrency, poolAmount),
		testUser1.keyRingPair
	);
	await waitNewBlock();
	await testUser1.mintLiquidity(firstCurrency, secondCurrency, mintAmount, userAmount);
	return [firstCurrency, secondCurrency];
}

