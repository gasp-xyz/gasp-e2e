import {getApi, initApi} from "../../utils/api";
import { calculate_sell_price_local, calculate_sell_price_rpc, getBalanceOfPool} from '../../utils/tx'
import {waitNewBlock} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { testLog } from "../../utils/Logger";


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
const defaultCurrecyValue = new BN(250000);

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
	[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue,defaultCurrecyValue.add(new BN(1))] , sudo );
	await testUser1.addMGATokens(sudo);
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


	let poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);
	let amount = new BN(30000);
	// considering the 60k of pool and the 30k amount
	const traseureAndBurn  = new BN(6).mul(new BN(2));
	let sellPriceLocal = calculate_sell_price_local(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	let sellPriceRpc = await calculate_sell_price_rpc(poolBalanceBefore[0], poolBalanceBefore[1], amount);
	expect(sellPriceLocal).toEqual(sellPriceRpc);
	testLog.getLog().info("selling asset " + firstCurrency + ", buying asset " + secondCurrency);
	
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
	let pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);

	expect	([	poolBalanceBefore[0].add(amount),	poolBalanceBefore[1].sub(sellPriceLocal).sub(traseureAndBurn)	])
	.toEqual(pool_balance);

});

test('xyk-pallet - AssetsOperation: sellAsset [minAmountOut = 0], sell an already sold asset', async () => {

	let amount = new BN(30000);
	let soldAssetId = firstCurrency;
	let boughtAssetId = secondCurrency;
	await testUser1.sellAssets(soldAssetId, boughtAssetId , amount);

	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	await testUser2.refreshAmounts(AssetWallet.BEFORE);
	await pallet.refreshAmounts(AssetWallet.BEFORE);
	let poolBalanceBefore = await getBalanceOfPool(firstCurrency, secondCurrency);

	amount = new BN(20000);
	// considering the previous bought and the 20k amount
	const traseureAndBurn  = new BN(10).mul(new BN(2));
	let sellPriceLocal = calculate_sell_price_local(poolBalanceBefore[1], poolBalanceBefore[0], amount);
	let sellPriceRpc = await calculate_sell_price_rpc(poolBalanceBefore[1], poolBalanceBefore[0], amount);
	expect(sellPriceLocal).bnEqual(sellPriceRpc);

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
	
	let pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect	([	poolBalanceBefore[0].sub(sellPriceLocal).sub(traseureAndBurn),	poolBalanceBefore[1].add(amount)	])
	.toEqual(pool_balance);
});
