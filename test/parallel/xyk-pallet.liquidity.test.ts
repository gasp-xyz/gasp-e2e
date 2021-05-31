import {getApi, initApi} from "../../utils/api";
import { calcuate_mint_liquidity_price_local, calcuate_burn_liquidity_price_local, getBalanceOfPool, getLiquidityAssetId, getAssetSupply, mintLiquidity, burnLiquidity} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult, getUserEventResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

let testUser1 : User;
let testUser2 : User;
let pallet : User;

let keyring : Keyring;
let firstCurrency :BN;
let secondCurrency :BN;
let liquidityAssetId: BN;

const {pallet: pallet_address,sudo:sudoUserName} = getEnvironmentRequiredVars();
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
	const sudo = new User(keyring, sudoUserName);
	
	// setup Pallet.
	pallet = new User(keyring);
	pallet.addFromAddress(keyring,pallet_address);
	
	//add two curerncies and balance to testUser:
	[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue,defaultCurrecyValue +1], sudo );
    await testUser1.setBalance(sudo);
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

	let poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	let totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
	let liquidityAssetsBurned = new BN(20000);
	let [firstAssetAmount, second_asset_amount] = await calcuate_burn_liquidity_price_local(firstCurrency, secondCurrency, liquidityAssetsBurned);

	console.log("burning liquidity " + liquidityAssetsBurned + "of pool " + firstCurrency + " - " + secondCurrency);

	const eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, testUser1.keyRingPair.address);
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

	let pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	poolBalanceBefore[0].sub(firstAssetAmount),	poolBalanceBefore[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);

	let total_liquidity_assets = await getAssetSupply(liquidityAssetId);
	expect(totalLiquidityAssetsBefore.sub(liquidityAssetsBurned))
	.toEqual(total_liquidity_assets);

});

test('xyk-pallet - Liqudity : Burn all the liquidity', async () => {
	
	let poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	let totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
	let liquidityAssetsBurned: BN = testUser1.getAsset(liquidityAssetId)?.amountBefore!;

	let [firstAssetAmount, secondAssetAmount] = await calcuate_burn_liquidity_price_local(firstCurrency, secondCurrency, liquidityAssetsBurned);

	console.log("TestUser1: burning liquidity " + liquidityAssetsBurned + "of pool " + firstCurrency + " - " + secondCurrency);

	const eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, testUser1.keyRingPair.address);
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

	let pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	poolBalanceBefore[0].sub(firstAssetAmount),	poolBalanceBefore[1].sub(secondAssetAmount)	])
	.toEqual(pool_balance);

	let totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
	expect(totalLiquidityAssetsBefore.sub(liquidityAssetsBurned))
	.toEqual(totalLiquidityAssets);

});

test('xyk-pallet - LiquidityOperation: mintLiquidity', async () => {
	let firstCurrencyAssetAmount = new BN(30000);
	let poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	let totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
	let [secondAssetAmount, liquidityAssetsMinted] = await calcuate_mint_liquidity_price_local(firstCurrency, secondCurrency, firstCurrencyAssetAmount);
  	
    console.log("User: minting liquidity " + firstCurrency + " - " + secondCurrency);
	const eventPromise = getUserEventResult("xyk", "LiquidityMinted", 14, testUser1.keyRingPair.address);
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

	let pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	poolBalanceBefore[0].add(firstCurrencyAssetAmount),	poolBalanceBefore[1].add(secondAssetAmount)	])
	.toEqual(pool_balance);
	
	let total_liquidity_assets = await getAssetSupply(liquidityAssetId);
	expect(totalLiquidityAssetsBefore.add(liquidityAssetsMinted))
	.toEqual(total_liquidity_assets);

});

