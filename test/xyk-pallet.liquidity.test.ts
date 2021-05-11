import {getApi, initApi} from "../utils/api";
import { calcuate_mint_liquidity_price_local, calcuate_burn_liquidity_price_local, calculate_sell_price_local, calculate_buy_price_local, calculate_sell_price_rpc, calculate_buy_price_rpc, getUserAssets, getBalanceOfAsset, getBalanceOfPool, getNextAssetId, getLiquidityAssetId, getAssetSupply, balanceTransfer, getSudoKey, sudoIssueAsset, transferAsset, createPool, sellAsset, buyAsset, mintLiquidity, burnLiquidity} from '../utils/tx'
import {waitNewBlock, expectEvent, getEventResult, ExtrinsicResult, EventResult} from '../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../utils/User";
import { validateAssetsWithValues, validateEmptyAssets } from "../utils/validators";
import { Assets } from "../utils/Assets";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

var testUser1 : User;
var testUser2 : User;
var pallet : User;

var keyring : Keyring;
var firstCurrency :BN;
var secondCurrency :BN;
var liquidityAssetId: BN;

// Assuming the pallet's AccountId
const pallet_address = process.env.TEST_PALLET_ADDRESS;
const defaultCurrecyValue = 250000;

beforeAll( async () => {
	try {
		getApi();
	  } catch(e) {
		await initApi();
	}

})

beforeEach( async () => {
	await waitNewBlock();
	keyring = new Keyring({ type: 'sr25519' });

	// setup users
	testUser1 = new User(keyring);
	testUser2 = new User(keyring);
	// build Maciatko, he is sudo. :S
	const sudo = new User(keyring, '//Maciatko');
	
	// setup Pallet.
	pallet = new User(keyring);
	pallet.addFromAddress(keyring,pallet_address);
	
	//add two curerncies and balance to testUser:
	[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1] );
    await testUser1.addBalance();
	await testUser1.createPoolToAsset(new BN(40000), new BN(30000), firstCurrency, secondCurrency);
	liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);
	testUser1.addAsset(liquidityAssetId);
	testUser2.addAsset(liquidityAssetId);
	
	
	// add users to pair.
	keyring.addPair(testUser1.keyRingPair);
	keyring.addPair(testUser2.keyRingPair);
	keyring.addPair(sudo.keyRingPair);
	keyring.addPair(pallet.keyRingPair);

	// check users accounts.
	await waitNewBlock();
	pallet.addAssets([firstCurrency, secondCurrency]);
	testUser2.addAssets([firstCurrency, secondCurrency]);
	    
	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	await testUser2.refreshAmounts(AssetWallet.BEFORE);
    await pallet.refreshAmounts(AssetWallet.BEFORE);

});

test('xyk-pallet - Liqudity : Burn part of the liquidity', async () => {

	var poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	var totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
	var liquidityAssetsBurned = new BN(20000);
	var [firstAssetAmount, second_asset_amount] = await calcuate_burn_liquidity_price_local(firstCurrency, secondCurrency, liquidityAssetsBurned);

	console.log("burning liquidity " + liquidityAssetsBurned + "of pool " + firstCurrency + " - " + secondCurrency);

	const eventPromise = getEventResult("xyk", "LiquidityBurned", 14);
	burnLiquidity(testUser1.keyRingPair, firstCurrency,secondCurrency, liquidityAssetsBurned);
	const eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);
	
	testUser1.validateWalletIncreased(firstCurrency, firstAssetAmount);
	testUser1.validateWalletIncreased(secondCurrency, second_asset_amount);
	testUser1.validateWalletReduced(liquidityAssetId,liquidityAssetsBurned);
	
	testUser2.validateWalletsUnmodified();

	pallet.validateWalletReduced(firstCurrency, firstAssetAmount);
	pallet.validateWalletReduced(secondCurrency, second_asset_amount);

	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	poolBalanceBefore[0].sub(firstAssetAmount),	poolBalanceBefore[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);

	var total_liquidity_assets = await getAssetSupply(liquidityAssetId);
	expect(totalLiquidityAssetsBefore.sub(liquidityAssetsBurned))
	.toEqual(total_liquidity_assets);

});

test('xyk-pallet - Liqudity : Burn all the liquidity', async () => {
	
	var poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	var totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
	var liquidityAssetsBurned: BN = testUser1.getAsset(liquidityAssetId).amountBefore;

	var [firstAssetAmount, secondAssetAmount] = await calcuate_burn_liquidity_price_local(firstCurrency, secondCurrency, liquidityAssetsBurned);

	console.log("TestUser1: burning liquidity " + liquidityAssetsBurned + "of pool " + firstCurrency + " - " + secondCurrency);

	const eventPromise = getEventResult("xyk", "LiquidityBurned", 14);
	burnLiquidity(testUser1.keyRingPair, firstCurrency,secondCurrency, liquidityAssetsBurned);
	const eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);
	
	testUser1.validateWalletIncreased(firstCurrency, firstAssetAmount);
	testUser1.validateWalletIncreased(secondCurrency, secondAssetAmount);
	testUser1.validateWalletReduced(liquidityAssetId,liquidityAssetsBurned);
	
	testUser2.validateWalletsUnmodified();

	pallet.validateWalletReduced(firstCurrency, firstAssetAmount);
	pallet.validateWalletReduced(secondCurrency, secondAssetAmount);

	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	poolBalanceBefore[0].sub(firstAssetAmount),	poolBalanceBefore[1].sub(secondAssetAmount)	])
	.toEqual(pool_balance);

	var totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
	expect(totalLiquidityAssetsBefore.sub(liquidityAssetsBurned))
	.toEqual(totalLiquidityAssets);

});

test('xyk-pallet - LiquidityOperation: mintLiquidity', async () => {
	var firstCurrencyAssetAmount = new BN(30000);
	var poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	var totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
	var [secondAssetAmount, liquidityAssetsMinted] = await calcuate_mint_liquidity_price_local(firstCurrency, secondCurrency, firstCurrencyAssetAmount);
  	
    console.log("User: minting liquidity " + firstCurrency + " - " + secondCurrency);
	const eventPromise = getEventResult("xyk", "LiquidityMinted", 14);
	mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, firstCurrencyAssetAmount);
	const eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletReduced(firstCurrency,firstCurrencyAssetAmount);
	testUser1.validateWalletReduced(secondCurrency,secondAssetAmount);
	testUser1.validateWalletIncreased(liquidityAssetId,liquidityAssetsMinted);

	await testUser2.validateWalletsUnmodified();
	
	pallet.validateWalletIncreased(firstCurrency, firstCurrencyAssetAmount);
	pallet.validateWalletIncreased(secondCurrency, secondAssetAmount);

	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	poolBalanceBefore[0].add(firstCurrencyAssetAmount),	poolBalanceBefore[1].add(secondAssetAmount)	])
	.toEqual(pool_balance);
	
	var total_liquidity_assets = await getAssetSupply(liquidityAssetId);
	expect(totalLiquidityAssetsBefore.add(liquidityAssetsMinted))
	.toEqual(total_liquidity_assets);

});

