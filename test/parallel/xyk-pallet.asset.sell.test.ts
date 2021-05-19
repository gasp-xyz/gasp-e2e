import {getApi, initApi} from "../../utils/api";
import { calculate_sell_price_local, calculate_sell_price_rpc, getBalanceOfPool} from '../../utils/tx'
import {waitNewBlock} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { Assets } from "../../utils/Assets";


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
const pallet_address = process.env.TEST_PALLET_ADDRESS ? process.env.TEST_PALLET_ADDRESS : '';
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
	[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1] , sudo );
	await testUser1.setBalance(sudo);
	await testUser1.createPoolToAsset(new BN(60000), new BN(60000), firstCurrency, secondCurrency);
	
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

});

test('xyk-pallet - AssetsOperation: sellAsset [minAmountOut = 0] , first to second currency', async() => {


	var poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	var amount = new BN(30000);
	// considering the 60k of pool and the 30k amount
	const traseureAndBurn  = new BN(6).mul(new BN(2));
	var sellPriceLocal = calculate_sell_price_local(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	var sellPriceRpc = await calculate_sell_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	expect(sellPriceLocal).toEqual(sellPriceRpc);
	console.log("selling asset " + firstCurrency + ", buying asset " + secondCurrency);
	
	const soldAssetId = firstCurrency;
	const boughtAssetId = secondCurrency;
	await testUser1.sellAssets(soldAssetId, secondCurrency , amount);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletReduced(soldAssetId,amount);
	testUser1.validateWalletIncreased(boughtAssetId,sellPriceLocal);
	testUser2.validateWalletsUnmodified();
	pallet.validateWalletReduced(boughtAssetId,sellPriceLocal);
	pallet.validateWalletIncreased(soldAssetId,amount);
	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	var burned = (sellPriceLocal.mul(new BN(5))).div(new BN(10000));
	expect	([	poolBalanceBefore[0].add(amount),	poolBalanceBefore[1].sub(sellPriceLocal).sub(traseureAndBurn)	])
	.toEqual(pool_balance);

});

test('xyk-pallet - AssetsOperation: sellAsset [minAmountOut = 0], sell an already sold asset', async () => {

	var amount = new BN(30000);
	var soldAssetId = firstCurrency;
	var boughtAssetId = secondCurrency;
	await testUser1.sellAssets(soldAssetId, boughtAssetId , amount);

	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	await testUser2.refreshAmounts(AssetWallet.BEFORE);
	await pallet.refreshAmounts(AssetWallet.BEFORE);
	var poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);

	amount = new BN(20000);
	// considering the previous bought and the 20k amount
	const traseureAndBurn  = new BN(10).mul(new BN(2));
	var sellPriceLocal = calculate_sell_price_local(poolBalanceBefore[1], poolBalanceBefore[0], amount);
	var sellPriceRpc = await calculate_sell_price_rpc(poolBalanceBefore[1], poolBalanceBefore[0], amount);
	expect(sellPriceLocal).toEqual(sellPriceRpc);

	soldAssetId = secondCurrency;
	boughtAssetId = firstCurrency;
	await testUser1.sellAssets(soldAssetId, boughtAssetId , amount);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletReduced(soldAssetId,amount);
	testUser1.validateWalletIncreased(boughtAssetId,sellPriceLocal);
	testUser2.validateWalletsUnmodified();
	pallet.validateWalletReduced(boughtAssetId,sellPriceLocal);
	pallet.validateWalletIncreased(soldAssetId,amount);
	
	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	poolBalanceBefore[0].sub(sellPriceLocal).sub(traseureAndBurn),	poolBalanceBefore[1].add(amount)	])
	.toEqual(pool_balance);
});
