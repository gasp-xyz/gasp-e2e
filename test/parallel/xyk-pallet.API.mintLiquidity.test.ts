import {api, getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, mintLiquidity, getLiquidityAssetId} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult, EventResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateMintedLiquidityEvent, validateTreasuryAmountsEqual } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromTxWait, signSendAndWaitToFinishTx } from "../../utils/txHandler";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

const {sudo:sudoUserName} = getEnvironmentRequiredVars();

const defaultCurrecyValue = 250000;

describe('xyk-pallet - Mint liquidity tests: with minting you can', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;

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

	});

	test('Add all the wallet assets to the pool', async () => {
		//valdiated with Gleb the rounding issue to preserve the x*y =k
		const roundingIssue =  new BN(1);
		await waitNewBlock();
		// The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue +1 ,defaultCurrecyValue +1 + 1], sudo);
		await testUser1.setBalance(sudo);
		const amounttoThePool = new BN(1);
		await signSendAndWaitToFinishTx( 
			api?.tx.xyk.createPool(firstCurrency, amounttoThePool, secondCurrency,amounttoThePool), 
			testUser1.keyRingPair 
		);
		const liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);
		testUser1.addAsset(liquidityAssetId);

		var poolBalanceWhenCreated = await getBalanceOfPool(firstCurrency, secondCurrency);
		await waitNewBlock();
		
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		await testUser1.mintLiquidity(firstCurrency,secondCurrency,new BN(defaultCurrecyValue));
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		
		var poolBalanceAfterMinting = await getBalanceOfPool(firstCurrency, secondCurrency);
		expect([poolBalanceWhenCreated[0].add(new BN(defaultCurrecyValue)), poolBalanceWhenCreated[0].add(new BN(defaultCurrecyValue)).add(roundingIssue)])
		.toEqual(poolBalanceAfterMinting);

		testUser1.validateWalletReduced(firstCurrency,new BN(defaultCurrecyValue));
		testUser1.validateWalletReduced(secondCurrency,new BN(defaultCurrecyValue).add(roundingIssue));

		//minting must not add any treasury
		testUser1.validateWalletIncreased(liquidityAssetId,new BN(defaultCurrecyValue).mul(new BN(2)));
		await validateTreasuryAmountsEqual(firstCurrency, [new BN(0),new BN(0)]);
		await validateTreasuryAmountsEqual(secondCurrency,[new BN(0),new BN(0)]);
		
	});
	
	test('Expect an event when liquidirty is minted', async () => {

		await waitNewBlock();
		// The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue,defaultCurrecyValue], sudo);
		await testUser1.setBalance(sudo);
		const amounttoThePool = new BN(defaultCurrecyValue).div(new BN(2));
		await signSendAndWaitToFinishTx( 
			api?.tx.xyk.createPool(firstCurrency, amounttoThePool, secondCurrency,amounttoThePool), 
			testUser1.keyRingPair 
		);
		const liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);
		testUser1.addAsset(liquidityAssetId);

		var poolBalanceWhenCreated = await getBalanceOfPool(firstCurrency, secondCurrency);
		await waitNewBlock();
		
		await testUser1.refreshAmounts(AssetWallet.BEFORE);
		const injectedValue = amounttoThePool.div(new BN(2));
		let eventResponse : EventResult = new EventResult(0,'');
		await mintLiquidity(testUser1.keyRingPair, firstCurrency, secondCurrency, injectedValue)
		.then(
			(result) => {
					eventResponse = getEventResultFromTxWait(result,["xyk", "LiquidityMinted", testUser1.keyRingPair.address]);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
				}
		);			
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		var poolBalanceAfterMinting = await getBalanceOfPool(firstCurrency, secondCurrency);
		const secondCurrencyAmountLost = testUser1.getAsset(secondCurrency)?.amountBefore.sub(testUser1.getAsset(secondCurrency)?.amountAfter!)!;
		// liquidity value matches with 2*minted_amount, since the pool is balanced.
		validateMintedLiquidityEvent(eventResponse, testUser1.keyRingPair.address, firstCurrency,injectedValue, secondCurrency, secondCurrencyAmountLost, liquidityAssetId, injectedValue.mul(new BN(2)))
		
		expect([poolBalanceWhenCreated[0].add(injectedValue), poolBalanceWhenCreated[1].add(secondCurrencyAmountLost)])
		.toEqual(poolBalanceAfterMinting);

		testUser1.validateWalletReduced(firstCurrency,injectedValue);
		testUser1.validateWalletReduced(secondCurrency, secondCurrencyAmountLost);
		// TODO: miss that rounding value. to check with Gleb or Stano.
		testUser1.validateWalletIncreased(liquidityAssetId,new BN(injectedValue).mul(new BN(2)));
		await validateTreasuryAmountsEqual(firstCurrency, [new BN(0),new BN(0)]);
		await validateTreasuryAmountsEqual(secondCurrency,[new BN(0),new BN(0)]);

	});

});


