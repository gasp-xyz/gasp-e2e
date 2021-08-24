import {getApi, initApi} from "../../utils/api";
import { getCurrentNonce} from '../../utils/tx'
import {ExtrinsicResult, waitNewBlock} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateAssetsWithValues } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { fromBNToUnitString, getEnvironmentRequiredVars, MGA_ASSET_ID } from "../../utils/utils";
import { SignerOptions } from "@polkadot/api/types";
import { getEventResultFromTxWait, signAndWaitTx } from "../../utils/txHandler";
import { RuntimeDispatchInfo } from "@polkadot/types/interfaces";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.spyOn(console, 'error').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

var testUser1 : User;
var sudo : User;

var keyring : Keyring;
var firstCurrency :BN;
var secondCurrency :BN;
var first_asset_amount = new BN(50000);
var second_asset_amount = new BN(50000);
//creating pool

const {sudo:sudoUserName} = getEnvironmentRequiredVars();

let cost:RuntimeDispatchInfo;

const defaultCurrecyValue = new BN(250000);

beforeEach( async () => {
	try {
		getApi();
		} catch(e) {
		await initApi();
	}

	await waitNewBlock();
	keyring = new Keyring({ type: 'sr25519' });

	// setup users
	testUser1 = new User(keyring);
	sudo = new User(keyring, sudoUserName);
	
	//add two curerncies and balance to testUser:
	[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue,defaultCurrecyValue.add(new BN(1))], sudo);
	//add zero MGA tokens.
	await testUser1.addMGATokens(sudo);
	// add users to pair.
	keyring.addPair(testUser1.keyRingPair);
	keyring.addPair(sudo.keyRingPair);
	testUser1.addAsset(MGA_ASSET_ID);
	// check users accounts.
	await testUser1.refreshAmounts(AssetWallet.BEFORE);
	validateAssetsWithValues([testUser1.getAsset(firstCurrency)?.amountBefore!,testUser1.getAsset(secondCurrency)?.amountBefore! ], [defaultCurrecyValue.toNumber(), defaultCurrecyValue.add(new BN(1)).toNumber()]);

})

	test('xyk-pallet - Calculate required MGA fee - CreatePool', async () => {

			const api = getApi();
			const nonce = await  getCurrentNonce(testUser1.keyRingPair.address) ;
			const opt : Partial<SignerOptions> = {
				nonce: nonce,
				tip: 0
			}
			cost = 
				await api?.tx.xyk.createPool(firstCurrency, first_asset_amount, secondCurrency, second_asset_amount)
				.paymentInfo(
					testUser1.keyRingPair,
					opt
				)			
			await signAndWaitTx( 
					api?.tx.xyk.createPool(firstCurrency, first_asset_amount, secondCurrency, second_asset_amount), 
					testUser1.keyRingPair,
					await  (await getCurrentNonce(testUser1.keyRingPair.address)).toNumber()
				).then(
					(result) => {
						const eventResponse = getEventResultFromTxWait(result);
						expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
					}
			);

	});

	test('xyk-pallet - Calculate required MGA fee - BuyAsset', async () => {

		const api = getApi();
		const nonce = await  getCurrentNonce(testUser1.keyRingPair.address) ;
		const opt : Partial<SignerOptions> = {
			nonce: nonce,
			tip: 0
		}
		
		cost = 
			await api.tx.xyk.buyAsset(firstCurrency, secondCurrency, new BN(100), new BN(1000000))
			.paymentInfo(
				testUser1.keyRingPair,
				opt
			)			
		await signAndWaitTx( 
				api.tx.xyk.buyAsset(firstCurrency, secondCurrency, new BN(100), new BN(1000000)), 
				testUser1.keyRingPair,
				await  (await getCurrentNonce(testUser1.keyRingPair.address)).toNumber()
			).then(
				(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
				}
		);
		expect(cost).toEqual('0');
	});

afterEach(async () => {

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	const feeCalculated = JSON.parse( JSON.stringify( cost.toHuman() ) ).partialFee
	const deductedMGATkns = testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.sub(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter!);
	const deductedMGAString = fromBNToUnitString(deductedMGATkns!);
	//Create pools takes some money as network fee,
	expect(deductedMGAString).toEqual(feeCalculated);

})
