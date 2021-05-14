import {getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, transferAsset} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult, getUserEventResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateAssetsWithValues, validateEmptyAssets } from "../../utils/validators";
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
	[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [defaultCurrecyValue,defaultCurrecyValue +1], sudo );
	await testUser1.setBalance(sudo);
	
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

test('xyk-pallet - AssetsOperation: transferAsset', async() => {
    //Refactor Note: [Missing Wallet assert?] Did not considered creating a liquity asset. Transaction does nothing with it.
	var pool_balance_before = await getBalanceOfPool(firstCurrency, secondCurrency);
	var amount = new BN(100000);
	console.log("testUser1: transfering asset " + firstCurrency + " to testUser2");

	const eventPromise = getUserEventResult("tokens", "Transferred", 12, testUser1.keyRingPair.address);
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






