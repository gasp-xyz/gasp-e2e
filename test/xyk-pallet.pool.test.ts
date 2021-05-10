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

// Assuming the pallet's AccountId
const pallet_address = "5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2"
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
	
	// add users to pair.
	keyring.addPair(testUser1.keyRingPair);
	keyring.addPair(testUser2.keyRingPair);
	keyring.addPair(sudo.keyRingPair);
	keyring.addPair(pallet.keyRingPair);

	// check users accounts.
	await waitNewBlock();
	pallet.addAssets([firstCurrency, secondCurrency]);
	testUser2.addAssets([firstCurrency, secondCurrency]);
	await pallet.refreshAmounts(AssetWallet.BEFORE);
	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	await testUser2.refreshAmounts(AssetWallet.BEFORE);

	validateAssetsWithValues([testUser1.getAsset(firstCurrency).amountBefore,testUser1.getAsset(secondCurrency).amountBefore ], [defaultCurrecyValue, defaultCurrecyValue+1]);
	validateEmptyAssets([testUser2.getAsset(firstCurrency).amountBefore,testUser2.getAsset(secondCurrency).amountBefore]);
});

test.skip('xyk-pallet - Pool tests: createPool', async () => {
	
	const pool_balance_before = [new BN(0), new BN(0)];
	const total_liquidity_assets_before = new BN(0);

	var first_asset_amount = new BN(50000);
	var second_asset_amount = new BN(50000);
	
  	console.log("testUser1: creating pool " + firstCurrency + " - " + secondCurrency);
  	var eventPromise = getEventResult("xyk","PoolCreated", 14);
  	createPool(testUser1.keyRingPair, firstCurrency, first_asset_amount, secondCurrency, second_asset_amount);
  	var eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	var liquidity_asset_id = await getLiquidityAssetId(firstCurrency, secondCurrency);
	var liquidity_assets_minted = first_asset_amount.add(second_asset_amount);

	testUser1.addAsset(liquidity_asset_id, new BN(0));
	testUser2.addAsset(liquidity_asset_id, new BN(0));
	//validate

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	await testUser1.validateWalletReduced(firstCurrency, first_asset_amount);
	await testUser1.validateWalletReduced(secondCurrency, second_asset_amount);
	await testUser1.validateLiquidity(liquidity_asset_id, liquidity_assets_minted);
	
	await testUser2.validateWalletsUnmodified();

	await pallet.validateWalletIncreased(firstCurrency, first_asset_amount);
	await pallet.validateWalletIncreased(secondCurrency, second_asset_amount);

	//TODO: pending to validate.
	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	pool_balance_before[0].add(first_asset_amount),	
				pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);

	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);

});

test.skip('xyk-pallet - LiquidityOperation: mintLiquidity', async () => {
	var first_asset_amount = new BN(30000);
	await createPoolToAsset(new BN(50000), new BN(50000), testUser1);
	
	var pool_balance_before = await getBalanceOfPool(firstCurrency, secondCurrency);
	var liquidity_asset_id = await getLiquidityAssetId(firstCurrency, secondCurrency);
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	
	// refresh amounts after the pool Asset creation
	testUser1.addAsset(liquidity_asset_id);
	testUser2.addAsset(liquidity_asset_id);
	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	await testUser2.refreshAmounts(AssetWallet.BEFORE);
	await pallet.refreshAmounts(AssetWallet.BEFORE);

	var [second_asset_amount, liquidity_assets_minted] = await calcuate_mint_liquidity_price_local(firstCurrency, secondCurrency, first_asset_amount);
  	console.log("User: minting liquidity " + firstCurrency + " - " + secondCurrency);
	const eventPromise = getEventResult("xyk", "LiquidityMinted", 14);
	mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, first_asset_amount);
	const eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletReduced(firstCurrency,first_asset_amount);
	testUser1.validateWalletReduced(secondCurrency,second_asset_amount);
	testUser1.validateWalletIncreased(liquidity_asset_id,liquidity_assets_minted);

	await testUser2.validateWalletsUnmodified();
	
	pallet.validateWalletIncreased(firstCurrency, first_asset_amount);
	pallet.validateWalletIncreased(secondCurrency, second_asset_amount);

	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	pool_balance_before[0].add(first_asset_amount),	pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);
	
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);

});

test.skip('xyk-pallet - AssetsOperation: transferAsset', async() => {
    //Refactor Note: [Missing Wallet assert?] Did not considered creating a liquity asset. Transaction does nothing with it.
	var pool_balance_before = await getBalanceOfPool(firstCurrency, secondCurrency);
	var amount = new BN(100000);
	console.log("testUser1: transfering asset " + firstCurrency + " to testUser2");

	const eventPromise = getEventResult("tokens", "Transferred", 12);
	transferAsset(testUser1.keyRingPair, firstCurrency, testUser2.keyRingPair.address, amount);
	const eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletReduced(firstCurrency, amount);
	testUser1.validateWalletIncreased(secondCurrency,new BN(0));

	testUser2.validateWalletIncreased(firstCurrency, amount);
	testUser1.validateWalletIncreased(secondCurrency,new BN(0));

	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	(pool_balance_before)
	.toEqual(pool_balance);


});

test.skip('xyk-pallet - AssetsOperation: sellAsset [minAmountOut = 0] , first to second currency', async() => {

	await createPoolToAsset(new BN(50000), new BN(50000), testUser1);
	await testUser1.refreshAmounts(AssetWallet.BEFORE);

	var pool_balance_before = await getBalanceOfPool(firstCurrency, secondCurrency);
	var amount = new BN(30000);
	var sell_price_local = calculate_sell_price_local(pool_balance_before[0], pool_balance_before[1], amount);
	var sell_price_rpc = await calculate_sell_price_rpc(pool_balance_before[0], pool_balance_before[1], amount);
	expect(sell_price_local).toEqual(sell_price_rpc);
	console.log("TestUser1: selling asset " + firstCurrency + ", buying asset " + secondCurrency);
	
	const soldAssetId = firstCurrency;
	const boughtAssetId = secondCurrency;
	await transferAssets(testUser1, soldAssetId, secondCurrency , amount);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletReduced(soldAssetId,amount);
	testUser1.validateWalletIncreased(boughtAssetId,sell_price_local);
	testUser2.validateWalletsUnmodified();
	pallet.validateWalletsUnmodified();
	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	pool_balance_before[0].add(amount),	pool_balance_before[1].sub(sell_price_local)	])
	.toEqual(pool_balance);

});

test('xyk-pallet - AssetsOperation: sellAsset [minAmountOut = 0], sell an already bought asset', async () => {
	await createPoolToAsset(new BN(50000), new BN(50000), testUser1);
	var amount = new BN(30000);
	var soldAssetId = firstCurrency;
	var boughtAssetId = secondCurrency;
	await transferAssets(testUser1, soldAssetId, boughtAssetId , amount);
	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	await testUser2.refreshAmounts(AssetWallet.BEFORE);
	await pallet.refreshAmounts(AssetWallet.BEFORE);
	var pool_balance_before = await getBalanceOfPool(firstCurrency, secondCurrency);

	amount = new BN(20000);
	var sell_price_local = calculate_sell_price_local(pool_balance_before[1], pool_balance_before[0], amount);
	var sell_price_rpc = await calculate_sell_price_rpc(pool_balance_before[1], pool_balance_before[0], amount);
	expect(sell_price_local).toEqual(sell_price_rpc);

	soldAssetId = secondCurrency;
	boughtAssetId = firstCurrency;
	await transferAssets(testUser1, soldAssetId, boughtAssetId , amount);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletReduced(soldAssetId,amount);
	testUser1.validateWalletIncreased(boughtAssetId,sell_price_local);
	testUser2.validateWalletsUnmodified();
	pallet.validateWalletIncreased(boughtAssetId,sell_price_local);
	pallet.validateWalletIncreased(soldAssetId,amount);
	
	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	pool_balance_before[0].add(amount),	pool_balance_before[1].sub(sell_price_local)	])
	.toEqual(pool_balance);
});

test.skip('xyk-pallet - AssetsOperation: buyAsset [maxAmountIn = 1M], buy asset', async() => {
	await createPoolToAsset(new BN(50000), new BN(50000), testUser1);
	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	await testUser2.refreshAmounts(AssetWallet.BEFORE);
	await pallet.refreshAmounts(AssetWallet.BEFORE);
	var pool_balance_before = await getBalanceOfPool(firstCurrency, secondCurrency);

	var amount = new BN(10000);
	var buy_price_local = calculate_buy_price_local(pool_balance_before[0], pool_balance_before[1], amount);
	var buy_price_rpc = await calculate_buy_price_rpc(pool_balance_before[0], pool_balance_before[1], amount);
	expect(buy_price_local).toEqual(buy_price_rpc);

	console.log("Bob: buying asset " + secondCurrency + ", selling asset " + firstCurrency);
	const soldAssetId = firstCurrency;
	const boughtAssetId = secondCurrency;
  	const eventPromise = getEventResult("xyk", "AssetsSwapped", 14);
  	buyAsset(testUser1.keyRingPair, soldAssetId, boughtAssetId, amount, new BN(1000000));
  	const eventResult = await eventPromise;
	expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletIncreased(boughtAssetId, amount);
	testUser1.validateWalletReduced(soldAssetId, buy_price_local);
	testUser2.validateWalletsUnmodified();
	pallet.validateWalletIncreased(soldAssetId,buy_price_local);
	pallet.validateWalletReduced(boughtAssetId,amount);
	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	pool_balance_before[0].add(buy_price_local),	pool_balance_before[1].sub(amount)	])
	.toEqual(pool_balance);

});

test.skip('xyk-pallet - AssetsOperation: buyAsset [maxAmountIn = 1M], sell a bought asset', async() =>{

	await createPoolToAsset(new BN(50000), new BN(50000), testUser1);
	var amount = new BN(10000);

	console.log("Bob: buying asset " + secondCurrency + ", selling asset " + firstCurrency);
	var soldAssetId = firstCurrency;
	var boughtAssetId = secondCurrency;
	await buyAssets(testUser1, soldAssetId, boughtAssetId, amount);
	
	var pool_balance_before = await getBalanceOfPool(secondCurrency, firstCurrency);
	var buy_price_local = calculate_buy_price_local(pool_balance_before[0], pool_balance_before[1], amount);
	var buy_price_rpc = await calculate_buy_price_rpc(pool_balance_before[0], pool_balance_before[1], amount);
	expect(buy_price_local).toEqual(buy_price_rpc);

	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	await testUser2.refreshAmounts(AssetWallet.BEFORE);
	await pallet.refreshAmounts(AssetWallet.BEFORE);
	
	soldAssetId = secondCurrency;
	boughtAssetId = firstCurrency;
	//buy asset swiching the assetIds
	await buyAssets(testUser1, soldAssetId, boughtAssetId, amount);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletIncreased(boughtAssetId, amount);
	testUser1.validateWalletReduced(soldAssetId, buy_price_local);
	testUser2.validateWalletsUnmodified();
	pallet.validateWalletIncreased(soldAssetId,buy_price_local);
	pallet.validateWalletReduced(boughtAssetId,amount);
	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	pool_balance_before[1].add(buy_price_local),	pool_balance_before[0].sub(amount)	])
	.toEqual(pool_balance);

})

test.skip('xyk-pallet - remaining tests', async () => {

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = alice;
	var liquidity_assets_burned = new BN(20000);
	var [first_asset_amount, second_asset_amount] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, liquidity_assets_burned);

  console.log("Alice: burning liquidity " + liquidity_assets_burned + "of pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
  burnLiquidity(user, firstAssetId, secondAssetId, liquidity_assets_burned);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(first_asset_amount.toString());
	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_burned.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].add(first_asset_amount),	alice_assets_before[1].add(second_asset_amount),	alice_assets_before[2].sub(liquidity_assets_burned)	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(first_asset_amount),	pallet_assets_before[1].sub(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(first_asset_amount),	pool_balance_before[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.sub(liquidity_assets_burned))
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());


	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = alice;
	var liquidity_assets_burned: BN = alice_assets_before[2];
	var [first_asset_amount, second_asset_amount] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, liquidity_assets_burned);

  console.log("Alice: burning all liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
  burnLiquidity(user, firstAssetId, secondAssetId, liquidity_assets_burned);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(first_asset_amount.toString());
	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_burned.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].add(first_asset_amount),	alice_assets_before[1].add(second_asset_amount),	alice_assets_before[2].sub(liquidity_assets_burned)	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(first_asset_amount),	pallet_assets_before[1].sub(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(first_asset_amount),	pool_balance_before[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.sub(liquidity_assets_burned))
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

});

async function buyAssets(user:User , soldAssetId: BN, boughtAssetId: BN, amount: BN, maxExpected = new BN(1000000)) {
	const eventPromise = getEventResult("xyk", "AssetsSwapped", 14);
	buyAsset(user.keyRingPair, soldAssetId, boughtAssetId, amount, maxExpected);
	const eventResult = await eventPromise;
	expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
	await waitNewBlock();
}

async function transferAssets(user : User, soldAssetId : BN, boughtAssetId: BN ,amount: BN) {

	const eventPromise = getEventResult("xyk", "AssetsSwapped", 14);
	sellAsset(user.keyRingPair, soldAssetId, boughtAssetId, amount, new BN(0));
	const eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
	await waitNewBlock();
}

async function createPoolToAsset(first_asset_amount: BN, second_asset_amount: BN, user: User) {
	console.log("testUser1: creating pool " + firstCurrency + " - " + secondCurrency);
	var eventPromise = getEventResult("xyk", "PoolCreated", 14);
	createPool(user.keyRingPair, firstCurrency, first_asset_amount, secondCurrency, second_asset_amount);
	var eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
	await waitNewBlock();
}
