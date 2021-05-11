import {getApi, initApi} from "../utils/api";
import { getCurrentNonce, signTx, calcuate_mint_liquidity_price_local, calcuate_burn_liquidity_price_local, calculate_sell_price_local, calculate_buy_price_local, calculate_sell_price_rpc, calculate_buy_price_rpc, getUserAssets, getBalanceOfAsset, getBalanceOfPool, getNextAssetId, getLiquidityAssetId, getAssetSupply, balanceTransfer, getSudoKey, sudoIssueAsset, transferAsset, createPool, sellAsset, buyAsset, mintLiquidity, burnLiquidity} from '../utils/tx'
import {waitNewBlock, expectEvent, getEventResult, ExtrinsicResult, EventResult} from '../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {sleep} from "../utils/utils";
import {User} from "../utils/User";
import { userInfo } from "os";
import { validateTransactionSucessful } from "../utils/validators";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

var testUser : User;
var keyring : Keyring;

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
	testUser = new User(keyring);
	// build charlie, he is sudo. :S
	const sudo = new User(keyring, '//Maciatko');
	// add users to pair.
	keyring.addPair(testUser.keyRingPair);
	keyring.addPair(sudo.keyRingPair);
	
});

test('xyk-pallet - Sudo tests: Sudo Issue an asset', async () => {
	//setup
	var sudoKey = await getSudoKey();
	var sudoPair = keyring.getPair(sudoKey.toString());
	var eventPromise : Promise<EventResult>;
	var tokensAmount = 220000;
	//act
	eventPromise = getEventResult("tokens","Issued", 12);
	sudoIssueAsset(sudoPair, new BN(tokensAmount), testUser.keyRingPair.address);
	var eventResult = await eventPromise;
	// get the new  assetId from the response.
	const assetId = new BN(eventResult.data[0]);
	console.info("Sudo: issued asset " + assetId + " to " + testUser.name);
	//validate
	validateTransactionSucessful(eventResult, tokensAmount, testUser);
	var userAssets = await getUserAssets(testUser.keyRingPair.address, [assetId]);
	expect(userAssets).toEqual([new BN(tokensAmount)]);
	
});

test('xyk-pallet - Sudo tests: Sudo Issue two  different assets to the same account', async () => {

	var sudoKey = await getSudoKey();
	var sudoPair = keyring.getPair(sudoKey.toString());
	var eventPromise : Promise<EventResult>;
	var tokensFirstAmount = 220000;
	//act
	eventPromise = getEventResult("tokens","Issued", 12);
	sudoIssueAsset(sudoPair, new BN(tokensFirstAmount), testUser.keyRingPair.address);
	var eventResult = await eventPromise;
	const assetId = new BN(eventResult.data[0]);
	console.info("Sudo: asset issued " + assetId + " to " + testUser.name);
	validateTransactionSucessful(eventResult, tokensFirstAmount, testUser);
	
	await waitNewBlock();
	// act2 : send the second asset issue.
	var tokensSecondAmount = 120000;

	eventPromise = getEventResult("tokens","Issued", 12);
	sudoIssueAsset(sudoPair, new BN(tokensSecondAmount), testUser.keyRingPair.address);
	var eventResult = await eventPromise;
	const secondAssetId = new BN(eventResult.data[0]);
	validateTransactionSucessful(eventResult, tokensSecondAmount, testUser);
	// validate.
	var userAssets = await getUserAssets(testUser.keyRingPair.address, [assetId,secondAssetId]);
	expect(userAssets[0].words[0]).toEqual(tokensFirstAmount);
	expect(userAssets[1].words[0]).toEqual(tokensSecondAmount);
	
});


