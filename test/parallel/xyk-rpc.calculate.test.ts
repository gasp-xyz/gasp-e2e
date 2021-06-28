import {getApi, initApi} from "../../utils/api";
import { calculate_buy_price_rpc, calculate_sell_price_rpc, getBalanceOfPool} from '../../utils/tx'
import {waitNewBlock} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

let testUser1 : User;


let keyring : Keyring;
let firstCurrency :BN;
let secondCurrency :BN;

// Assuming the pallet's AccountId
const {sudo:sudoUserName} = getEnvironmentRequiredVars();
const firstAssetAmount = 1000;
const seccondAssetAmount = 1000;

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
	const sudo = new User(keyring, sudoUserName);

	
	//add two curerncies and balance to testUser:
	[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [firstAssetAmount *2 ,seccondAssetAmount *2] , sudo );
	await testUser1.setBalance(sudo);
	await testUser1.createPoolToAsset(new BN(firstAssetAmount), new BN(seccondAssetAmount), firstCurrency, secondCurrency);
	
    // add users to pair.
	keyring.addPair(testUser1.keyRingPair);
	keyring.addPair(sudo.keyRingPair);

});

beforeEach( async () => {
	// check users accounts.
	await waitNewBlock();
	await testUser1.refreshAmounts(AssetWallet.BEFORE);
})

test('xyk-rpc - calculate_sell_price and calculate_buy_price matches, 1000,1000', async() => {

	let poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	
	const numberOfAssets = new BN(100);
	let sellPriceRpc = await calculate_sell_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], numberOfAssets);
	let sellPriceRpcInverse = await calculate_sell_price_rpc(poolBalanceBefore[1], poolBalanceBefore[0], numberOfAssets);

	let buyPriceRpc= await calculate_buy_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], sellPriceRpc);
	let buyPriceRpcInverse = await calculate_buy_price_rpc(poolBalanceBefore[1], poolBalanceBefore[0], sellPriceRpc);

	//in a perfect balanced pool, those number match
	expect(sellPriceRpcInverse).toEqual(sellPriceRpc);
	expect(buyPriceRpc).toEqual(buyPriceRpcInverse);

	//the relation of buy and sell is maintained.
	expect(buyPriceRpc).toEqual(numberOfAssets);
	
});

test('xyk-rpc - calculate_sell_price and calculate_buy_price matches, 2000,1000', async() => {

	let poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	//lets unbalance it artificailly, now the relation is 2000X=1000Y
	poolBalanceBefore[0] = poolBalanceBefore[0].add(new BN(1000));
	
	const numberOfAssets = new BN(100);
	let sellPriceRpc = await calculate_sell_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], numberOfAssets);
	let sellPriceRpcInverse = await calculate_sell_price_rpc(poolBalanceBefore[1], poolBalanceBefore[0], numberOfAssets);

	let buyPriceRpc= await calculate_buy_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], sellPriceRpc);
	let buyPriceRpcInverse = await calculate_buy_price_rpc(poolBalanceBefore[1], poolBalanceBefore[0], sellPriceRpc);

	//in a not perfect balanced pool, those number can not match
	expect(sellPriceRpcInverse).not.toEqual(sellPriceRpc);
	expect(buyPriceRpc).not.toEqual(buyPriceRpcInverse);

	//the relation of buy and sell is maintained.
	//because of rounding, we need to expend one unit more
	expect(buyPriceRpc.add(new BN(1))).toEqual(numberOfAssets);
	
});

test('xyk-rpc - calculate_sell_price matches with the real sell', async() => {

	let poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	
	const numberOfAssets = new BN(100);
	let sellPriceRpc = await calculate_sell_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], numberOfAssets);
	await testUser1.sellAssets(firstCurrency, secondCurrency , numberOfAssets);
	await testUser1.refreshAmounts(AssetWallet.AFTER);
	const assetsSold = testUser1.getAsset(firstCurrency)?.amountAfter;
	const assetsBought = testUser1.getAsset(secondCurrency)?.amountAfter;

	expect(assetsSold).toEqual(testUser1.getAsset(firstCurrency)?.amountBefore.sub(numberOfAssets));
	expect(assetsBought).toEqual(testUser1.getAsset(secondCurrency)?.amountBefore.add(sellPriceRpc));
	
});

test('xyk-rpc - calculate_buy_price matches with the real buy', async() => {

	let poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	
	const numberOfAssets = new BN(100);
	let sellPriceRpc = await calculate_buy_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], numberOfAssets);
	await testUser1.buyAssets(firstCurrency, secondCurrency , numberOfAssets);
	await testUser1.refreshAmounts(AssetWallet.AFTER);
	const assetsSold = testUser1.getAsset(firstCurrency)?.amountAfter;
	const assetsBought = testUser1.getAsset(secondCurrency)?.amountAfter;

	expect(assetsSold).toEqual(testUser1.getAsset(firstCurrency)?.amountBefore.sub(sellPriceRpc));
	expect(assetsBought).toEqual(testUser1.getAsset(secondCurrency)?.amountBefore.add(numberOfAssets));
	
});


