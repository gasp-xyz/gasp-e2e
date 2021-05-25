import {getApi, initApi} from "../../utils/api";
import { calculate_buy_price_local, calculate_buy_price_rpc, getBalanceOfPool, buyAsset} from '../../utils/tx'
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

// Assuming the pallet's AccountId
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
	[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1],sudo );
	await testUser1.setBalance(sudo);
	await waitNewBlock();
	await testUser1.createPoolToAsset(new BN(50000), new BN(50000), firstCurrency, secondCurrency);

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

test('xyk-pallet - AssetsOperation: buyAsset [maxAmountIn = 1M], buy asset', async() => {

	let poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);

	let amount = new BN(10000);
	// considering the pool and the 10k amount
	const traseureAndBurn  = new BN(3).mul(new BN(2));
	let buyPriceLocal = calculate_buy_price_local(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	let buyPriceRpc = await calculate_buy_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	expect(buyPriceLocal).toEqual(buyPriceRpc);

	console.log("Bob: buying asset " + secondCurrency + ", selling asset " + firstCurrency);
	const soldAssetId = firstCurrency;
	const boughtAssetId = secondCurrency;
  	const eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
  	buyAsset(testUser1.keyRingPair, soldAssetId, boughtAssetId, amount, new BN(1000000));
  	const eventResult = await eventPromise;
	expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletIncreased(boughtAssetId, amount);
	testUser1.validateWalletReduced(soldAssetId, buyPriceLocal);
	testUser2.validateWalletsUnmodified();
	pallet.validateWalletIncreased(soldAssetId,buyPriceLocal);
	pallet.validateWalletReduced(boughtAssetId,amount);
	let pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	
	expect	([	poolBalanceBefore[0].add(buyPriceLocal),	poolBalanceBefore[1].sub(amount).sub(traseureAndBurn)	])
	.toEqual(pool_balance);

});

test('xyk-pallet - AssetsOperation: buyAsset [maxAmountIn = 1M], sell a bought asset', async() =>{

	let amount = new BN(10000);

	console.log("buying asset " + secondCurrency + ", selling asset " + firstCurrency);
	let soldAssetId = firstCurrency;
	let boughtAssetId = secondCurrency;
	await testUser1.buyAssets(soldAssetId, boughtAssetId, amount);
	
	
	amount = new BN(15000);
	// considering the pool and the 15k amount
	const traseureAndBurn  = new BN(5).mul(new BN(2));
	let poolBalanceBefore = await getBalanceOfPool(secondCurrency, firstCurrency);
	let buyPriceLocal = calculate_buy_price_local(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	let buypriceRpc = await calculate_buy_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	expect(buyPriceLocal).toEqual(buypriceRpc);

	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	await testUser2.refreshAmounts(AssetWallet.BEFORE);
	await pallet.refreshAmounts(AssetWallet.BEFORE);
	
	soldAssetId = secondCurrency;
	boughtAssetId = firstCurrency;

	await testUser1.buyAssets( soldAssetId, boughtAssetId, amount);

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser2.refreshAmounts(AssetWallet.AFTER);
	await pallet.refreshAmounts(AssetWallet.AFTER);

	testUser1.validateWalletIncreased(boughtAssetId, amount);
	testUser1.validateWalletReduced(soldAssetId, buyPriceLocal);
	testUser2.validateWalletsUnmodified();
	pallet.validateWalletIncreased(soldAssetId,buyPriceLocal);
	pallet.validateWalletReduced(boughtAssetId,amount);
	let pool_balance = await getBalanceOfPool(secondCurrency, firstCurrency);
	expect	([	poolBalanceBefore[0].add(buyPriceLocal),	poolBalanceBefore[1].sub(amount).sub(traseureAndBurn)	])
	.toEqual(pool_balance);

});
