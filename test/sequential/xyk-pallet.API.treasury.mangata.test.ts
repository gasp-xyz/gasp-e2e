import {api, getApi, initApi} from "../../utils/api";
import { signSendAndWaitToFinish, sellAsset, getTreasury, getTreasuryBurn, getAssetId} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult, getUserEventResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateTreasuryAmountsEqual } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

var first_asset_amount = new BN(50000);
const defaultCurrecyValue = 250000;
const {sudo:sudoUserName} = getEnvironmentRequiredVars();


describe('xyk-pallet - treasury tests [Mangata]: on treasury we store', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;
	var secondCurrency :BN;
	var mngTokenId:BN;

	//creating pool
	
	beforeAll( async () => {
		try {
			getApi();
		  } catch(e) {
			await initApi();
		}
	});

	beforeEach(async () => {
		await waitNewBlock();
		keyring = new Keyring({ type: 'sr25519' });
	
		// setup users
		testUser1 = new User(keyring);
	
		sudo = new User(keyring, sudoUserName);
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);

		await waitNewBlock();
		mngTokenId  = await getAssetId('MNG');
		await sudo.mint(mngTokenId, testUser1,new BN(defaultCurrecyValue));
		testUser1.addAsset(mngTokenId);
	    secondCurrency = (await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue], sudo))[0];
		await testUser1.setBalance(sudo);
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(mngTokenId, first_asset_amount, secondCurrency, first_asset_amount.div(new BN(2))), 
			testUser1.keyRingPair 
		);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

	});

	test('assets won when assets are sold [Selling Mangata] - 5', async () => {

		await waitNewBlock();
		let sellAssetAmount = new BN(10000);
		
		const treasuryBefore = await getTreasury(mngTokenId);
		const treasuryBurnBefore = await getTreasuryBurn(mngTokenId);


		let eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
		sellAsset(testUser1.keyRingPair, mngTokenId, secondCurrency, sellAssetAmount, new BN(1));
		let eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		
		//pool is [50000M,25000Y]
		//user sell [10000] of M.
		//Stano sheet tells: Treasury- 5 , burned destroyed!
		const treasuryAfter = await getTreasury(mngTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mngTokenId);

		expect(treasuryAfter).toEqual(treasuryBefore.add(new BN(5)));
		expect(treasuryBurnAfter).toEqual(treasuryBurnBefore);
		await validateTreasuryAmountsEqual(secondCurrency,[new BN(0),new BN(0)]);
		
	});

	test.skip('TODO:assets won when assets are bought [Buying Mangata]', async () => {

	});

	test('assets won when assets are sold [Selling other in MNG pool] - 6', async () => {

		await waitNewBlock();
		let sellAssetAmount = new BN(20000);
		
		const treasuryBefore = await getTreasury(mngTokenId);
		const treasuryBurnBefore = await getTreasuryBurn(mngTokenId);

		let eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
		sellAsset(testUser1.keyRingPair, secondCurrency, mngTokenId, sellAssetAmount, new BN(1));
		let eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		
		//pool is [50000M,25000Y]
		//user sell [20000] of Y.
		//Changed to 20kY, in order to unbalance the pools. -> MNG value increases [10Y=6MNG].
		//Stano sheet tells: Treasury- 6 , burned destroyed!

		const treasuryAfter = await getTreasury(mngTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mngTokenId);

		expect(treasuryAfter).toEqual(treasuryBefore.add(new BN(6)));
		expect(treasuryBurnAfter).toEqual(treasuryBurnBefore);
		await validateTreasuryAmountsEqual(secondCurrency,[new BN(0),new BN(0)]);
		
	});

	test.skip('TODO:assets won when assets are bought [Buying other in MNG pool]', async () => {

		
	});

});