import {api, getApi, initApi} from "../../utils/api";
import { signSendAndWaitToFinish, sellAsset, getTreasury, getTreasuryBurn, getAssetId, getBalanceOfPool, calculate_sell_price_local_no_fee} from '../../utils/tx'
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
	var connectedToMNG : BN, indirectlyConnected :BN;
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
	    connectedToMNG = (await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue], sudo))[0];
	    indirectlyConnected = (await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue], sudo))[0];
		await testUser1.setBalance(sudo);

		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(mngTokenId, first_asset_amount, connectedToMNG, first_asset_amount.div(new BN(2))), 
			testUser1.keyRingPair 
		);

		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(connectedToMNG, first_asset_amount, indirectlyConnected, first_asset_amount.div(new BN(2))), 
			testUser1.keyRingPair 
		);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

	});

	test('assets won when assets are sold [Selling X connected to MNG pool] - 10', async () => {

		await waitNewBlock();
		let sellAssetAmount = new BN(20000);

		const mgPoolAmount = await getBalanceOfPool(mngTokenId,connectedToMNG);

		//10 Is the outcome of the spreasheet created by stano.
		//pool is [50000X,25000Y]
		//user sell [20000] of X.
		//Stano sheet tells: Treasury- 10 [IF SELLING  X. X HAS A POOL WITH MANGATA. Y DOESN'T] scenario.

		const swapTreasuryInMG = calculate_sell_price_local_no_fee(mgPoolAmount[1], mgPoolAmount[0], new BN(10));

		const treasuryBefore = await getTreasury(mngTokenId);
		const treasuryBurnBefore = await getTreasuryBurn(mngTokenId);

		let eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
		sellAsset(testUser1.keyRingPair, connectedToMNG, indirectlyConnected, sellAssetAmount, new BN(1));
		let eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		
		const treasuryAfter = await getTreasury(mngTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mngTokenId);


		expect(treasuryAfter).toEqual(treasuryBefore.add(swapTreasuryInMG));
		
		//burned destroyed! because is translated to MNG
		expect(treasuryBurnAfter).toEqual(treasuryBurnBefore);
		await validateTreasuryAmountsEqual(indirectlyConnected,[new BN(0),new BN(0)]);
		
	});

	test.skip('TODO:assets won when assets are bought [Buying X connected to MNG pool]', async () => {

	});

	test('assets won when assets are sold [Selling Y - X connected to MNG pool] - 6', async () => {

		await waitNewBlock();
		let sellAssetAmount = new BN(20000);

		const treasuryBefore = await getTreasury(mngTokenId);
		const treasuryBurnBefore = await getTreasuryBurn(mngTokenId);

		let eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, testUser1.keyRingPair.address);
		sellAsset(testUser1.keyRingPair, indirectlyConnected, connectedToMNG, sellAssetAmount, new BN(1));
		let eventResponse = await eventPromise;
		expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		
		const treasuryAfter = await getTreasury(mngTokenId);
		const treasuryBurnAfter = await getTreasuryBurn(mngTokenId);
		const mgPoolAmount = await getBalanceOfPool(connectedToMNG, mngTokenId);

		//10 Is the outcome of the spreasheet created by stano.
		//pool is [50000X,25000Y]
		//user sell [20000] of Y.
		//Stano sheet tells: Treasury- 6 [IF SELLING  X. Y HAS A POOL WITH MANGATA. X DOESN'T] scenario.

		const swapTreasuryInMG = calculate_sell_price_local_no_fee(mgPoolAmount[0], mgPoolAmount[1],  new BN(6));

		expect(treasuryAfter).toEqual(treasuryBefore.add(swapTreasuryInMG));
		
		//burned destroyed! because is translated to MNG
		expect(treasuryBurnAfter).toEqual(treasuryBurnBefore);
		await validateTreasuryAmountsEqual(indirectlyConnected,[new BN(0),new BN(0)]);
		
	});

	test.skip('TODO:assets won when assets are bought [Buying Y - X connected to MNG pool] - 6', async () => {

		
	});

});