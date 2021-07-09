import {getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, createPool, transferAsset, sellAsset, buyAsset, burnLiquidity, mintLiquidity} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars, TokensErrorCodes, XyzErrorCodes } from "../../utils/utils";
import { getEventResultFromTxWait } from "../../utils/txHandler";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';
const {sudo:sudoUserName} = getEnvironmentRequiredVars();

const MAX_BALANCE = new BN('340282366920938463463374607431768211455'); //max balance

describe('xyk-pallet - Check operations are not executed because of overflow in asset token', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;


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
		sudo = new User(keyring, sudoUserName);
		// add users to pair.
        keyring.addPair(testUser1.keyRingPair);
        keyring.addPair(sudo.keyRingPair);

		//add two curerncies and balance to testUser:
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [MAX_BALANCE,MAX_BALANCE.sub(new BN(1))], sudo);
		await testUser1.setBalance(sudo);

	
		// check users accounts.
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

	});
	test('Create pool of [MAX,1]: OverFlow [a+b] - liquidityAsset calculation', async () => {
		await waitNewBlock();

		await createPool(testUser1.keyRingPair ,secondCurrency, new BN(1), firstCurrency, MAX_BALANCE)
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
					expect(eventResponse.data).toEqual(XyzErrorCodes.MathOverflow);				
			}
		);	
        const poolBalances = await getBalanceOfPool(firstCurrency,secondCurrency);
        expect(poolBalances[0]).toEqual(new BN(0));
        expect(poolBalances[1]).toEqual(new BN(0));

	});	
    test('Transfer [MAX] assets to other user when that user has 1 asset. Max+1 => overflow.', async () => {

		const testUser2 = new User(keyring);
        keyring.addPair(testUser2.keyRingPair);
        await sudo.mint(firstCurrency,testUser2, new BN(1));
        testUser2.addAsset(firstCurrency);
        testUser2.refreshAmounts(AssetWallet.BEFORE);

        await transferAsset(testUser1.keyRingPair, firstCurrency,testUser2.keyRingPair.address, MAX_BALANCE)
        .then(
            (result) => {
                const eventResponse = getEventResultFromTxWait(result);
                expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
                expect(eventResponse.data).toEqual(TokensErrorCodes.BalanceOverflow);				
            }
        );
        await testUser1.refreshAmounts(AssetWallet.AFTER);
        await testUser2.refreshAmounts(AssetWallet.AFTER);

        expect(testUser1.getAsset(firstCurrency)?.amountAfter).toEqual(MAX_BALANCE);
        expect(testUser2.getAsset(firstCurrency)?.amountAfter).toEqual(new BN(1));

	});	
});

describe('xyk-pallet - Operate with a pool close to overflow', () => {
	
	var testUser1 : User;
	var testUser2 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;


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
		sudo = new User(keyring, sudoUserName);
		// add users to pair.
        keyring.addPair(testUser1.keyRingPair);
        keyring.addPair(sudo.keyRingPair);
        
		//add two curerncies and balance to testUser:
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [MAX_BALANCE,MAX_BALANCE.sub(new BN(1))], sudo);
		await testUser1.setBalance(sudo);

	
		// check users accounts.
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

        testUser2 = new User(keyring);
        keyring.addPair(testUser2.keyRingPair);
        await sudo.mint(firstCurrency,testUser2, MAX_BALANCE);
        await sudo.mint(secondCurrency,testUser2, MAX_BALANCE);
        testUser2.addAssets([firstCurrency,secondCurrency]);
        await testUser2.setBalance(sudo);
        //Lets create a pool with MAX-2,1 -> liquidity is at 1 token to be overflowed.
        await createPool(testUser2.keyRingPair ,secondCurrency, MAX_BALANCE.sub(new BN(1000)), firstCurrency, new BN(1000))
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
			}
		);
        
		await testUser2.refreshAmounts(AssetWallet.BEFORE);

	});

    test('Sell [MAX -2] assets to a wallet with Max-1000,1000 => overflow.', async () => {

        await sellAsset(testUser1.keyRingPair, firstCurrency,secondCurrency, MAX_BALANCE.sub(new BN(2)), new BN(1))
        .then(
            (result) => {
                const eventResponse = getEventResultFromTxWait(result);
                expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
                expect(eventResponse.data).toEqual(XyzErrorCodes.MathOverflow);				
            }
        );
        await testUser1.refreshAmounts(AssetWallet.AFTER);

        expect(testUser1.getAsset(firstCurrency)?.amountAfter).toEqual(MAX_BALANCE);

	});	
    test('Buy [100] assets to a wallet with Max-1000,1000 => overflow.', async () => {

        await buyAsset(testUser1.keyRingPair, secondCurrency, firstCurrency, new BN(100), MAX_BALANCE)
        .then(
            (result) => {
                const eventResponse = getEventResultFromTxWait(result);
                expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
                expect(eventResponse.data).toEqual(XyzErrorCodes.MathOverflow);				
            }
        );
        await testUser1.refreshAmounts(AssetWallet.AFTER);

        expect(testUser1.getAsset(firstCurrency)?.amountAfter).toEqual(MAX_BALANCE);

	});	
    test('Mint liquidities [1000] assets to a wallet with Max-1000,1000 => overflow.', async () => {

        await mintLiquidity(testUser1.keyRingPair, firstCurrency,secondCurrency,  new BN(100), MAX_BALANCE)
        .then(
            (result) => {
                const eventResponse = getEventResultFromTxWait(result);
                expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
                expect(eventResponse.data).toEqual(XyzErrorCodes.MathOverflow);				
            }
        );
        await testUser1.refreshAmounts(AssetWallet.AFTER);

        expect(testUser1.getAsset(firstCurrency)?.amountAfter).toEqual(MAX_BALANCE);

	});	
    test.skip('TODO::Burn liquidities [1000] assets to a wallet with Max-1000,1000 => overflow.', async () => {
        
        const amountToFillAsset = MAX_BALANCE.sub(testUser2.getAsset(firstCurrency)?.amountBefore!).sub(new BN(2));
        await sudo.mint(firstCurrency,testUser2, amountToFillAsset);

        await burnLiquidity(testUser2.keyRingPair, secondCurrency, firstCurrency, new BN(10))
        .then(
            (result) => {
                const eventResponse = getEventResultFromTxWait(result);
                expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
                expect(eventResponse.data).toEqual(XyzErrorCodes.MathOverflow);				
            }
        );
        await testUser1.refreshAmounts(AssetWallet.AFTER);

        expect(testUser1.getAsset(firstCurrency)?.amountAfter).toEqual(MAX_BALANCE);

	});	



});


