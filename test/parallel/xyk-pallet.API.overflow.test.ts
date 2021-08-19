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
		// add users to pair.
        keyring.addPair(testUser1.keyRingPair);
        keyring.addPair(sudo.keyRingPair);

		//add two curerncies and balance to testUser:
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [MAX_BALANCE,MAX_BALANCE.sub(new BN(1))], sudo);
		await testUser1.addMGATokens(sudo);

	
		// check users accounts.
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

	});
	test('Create pool of [MAX,MAX]: OverFlow [a+b] - liquidityAsset calculation', async () => {
		await waitNewBlock();
        await sudo.mint(secondCurrency,testUser1, new BN(1));
        //UPDATE: Liq assets  = asset1 /2 + asset2/2.
		await createPool(testUser1.keyRingPair ,secondCurrency, MAX_BALANCE, firstCurrency, MAX_BALANCE)
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);	
        const poolBalances = await getBalanceOfPool(firstCurrency,secondCurrency);
        expect(poolBalances[0]).bnEqual(MAX_BALANCE);
        expect(poolBalances[1]).bnEqual(MAX_BALANCE);

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

        expect(testUser1.getAsset(firstCurrency)?.amountAfter).bnEqual(MAX_BALANCE);
        expect(testUser2.getAsset(firstCurrency)?.amountAfter).bnEqual(new BN(1));

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
		await testUser1.addMGATokens(sudo);

	
		// check users accounts.
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

        testUser2 = new User(keyring);
        keyring.addPair(testUser2.keyRingPair);
        await sudo.mint(firstCurrency,testUser2, MAX_BALANCE);
        await sudo.mint(secondCurrency,testUser2, MAX_BALANCE);
        testUser2.addAssets([firstCurrency,secondCurrency]);
        await testUser2.addMGATokens(sudo);
        //Lets create a pool with MAX-2,1 -> liquidity is at 1 token to be overflowed.
        await createPool(testUser2.keyRingPair ,secondCurrency, MAX_BALANCE.sub(new BN(10)), firstCurrency, MAX_BALANCE.sub(new BN(10)))
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

        expect(testUser1.getAsset(firstCurrency)?.amountAfter).bnEqual(MAX_BALANCE);

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

        expect(testUser1.getAsset(firstCurrency)?.amountAfter).bnEqual(MAX_BALANCE);

	});	
    test('Mint liquidities [1000] assets to a wallet with Max-1000,1000 => overflow.', async () => {
        
        await mintLiquidity(testUser1.keyRingPair, firstCurrency,secondCurrency,  new BN(100), MAX_BALANCE)
        .then(
            (result) => {
                const eventResponse = getEventResultFromTxWait(result);
                expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
                //TODO: validate with Stano.
                //expect(eventResponse.data).toEqual(XyzErrorCodes.MathOverflow);				
                expect(eventResponse.data).toEqual(XyzErrorCodes.PoolAlreadyExists);				

            }
        );
        await testUser1.refreshAmounts(AssetWallet.AFTER);

        expect(testUser1.getAsset(firstCurrency)?.amountAfter).bnEqual(MAX_BALANCE);

	});	
    test.skip('[BUG] Burn liquidities [MAX -1] assets to a wallet wich is full => overflow. NOT  a bug https://trello.com/c/J3fzuwH5', async () => {
        
        const amountToFillAsset = MAX_BALANCE.sub(testUser2.getAsset(firstCurrency)?.amountBefore!).sub(new BN(2));
        const amountToFillAssetSeccondC = MAX_BALANCE.sub(testUser2.getAsset(secondCurrency)?.amountBefore!).sub(new BN(2));
        await sudo.mint(firstCurrency,testUser2, amountToFillAsset);
        await sudo.mint(secondCurrency,testUser2, amountToFillAssetSeccondC);

      //burn 1 token less than the pool amount created in the setup.
      await burnLiquidity(testUser2.keyRingPair, secondCurrency, firstCurrency, MAX_BALANCE.sub(new BN(1001)))
        .then(
            (result) => {
                const eventResponse = getEventResultFromTxWait(result);
                expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
                expect(eventResponse.data).toEqual(XyzErrorCodes.MathOverflow);				
            }
        );
        await testUser2.refreshAmounts(AssetWallet.AFTER);

        expect(testUser2.getAsset(firstCurrency)?.amountAfter).bnEqual(MAX_BALANCE.sub(new BN(2)));
        expect(testUser2.getAsset(secondCurrency)?.amountAfter).bnEqual(MAX_BALANCE.sub(new BN(2)));

	});	

});

describe('xyk-pallet - Operate with a user account close to overflow', () => {
	
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
		await testUser1.addMGATokens(sudo);

	
		// check users accounts.
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

        testUser2 = new User(keyring);
        keyring.addPair(testUser2.keyRingPair);
        await sudo.mint(firstCurrency,testUser2, MAX_BALANCE);
        await sudo.mint(secondCurrency,testUser2, MAX_BALANCE);
        testUser2.addAssets([firstCurrency,secondCurrency]);
        await testUser2.addMGATokens(sudo);
        //Lets create a pool with 1M-5M
        await createPool(testUser2.keyRingPair ,secondCurrency, new BN(1000000), firstCurrency, new BN(5000000))
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
			}
		);
        
		await testUser2.refreshAmounts(AssetWallet.BEFORE);

	});

    test.skip('Sell a few assets to a wallet that is full => overflow. NOT A BUG: https://trello.com/c/J3fzuwH5', async () => {

        await sellAsset(testUser1.keyRingPair, firstCurrency,secondCurrency, new BN(10000), new BN(1))
        .then(
            (result) => {
                const eventResponse = getEventResultFromTxWait(result);
                expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
                expect(eventResponse.data).toEqual(XyzErrorCodes.MathOverflow);				
            }
        );
        await testUser1.refreshAmounts(AssetWallet.AFTER);

        expect(testUser1.getAsset(firstCurrency)?.amountAfter).bnEqual(testUser1.getAsset(firstCurrency)?.amountBefore!);
        expect(testUser1.getAsset(secondCurrency)?.amountAfter).bnEqual(testUser1.getAsset(secondCurrency)?.amountBefore!);

	});	
    test.skip('Buy a few assets to a wallet that is full  => overflow. NOT A BUG: https://trello.com/c/J3fzuwH5', async () => {

        await buyAsset(testUser1.keyRingPair, firstCurrency, secondCurrency, new BN(100), MAX_BALANCE)
        .then(
            (result) => {
                const eventResponse = getEventResultFromTxWait(result);
                expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
                expect(eventResponse.data).toEqual(XyzErrorCodes.MathOverflow);				
            }
        );
        await testUser1.refreshAmounts(AssetWallet.AFTER);

        expect(testUser1.getAsset(firstCurrency)?.amountAfter).toEqual(testUser1.getAsset(firstCurrency)?.amountBefore);
        expect(testUser1.getAsset(secondCurrency)?.amountAfter).toEqual(testUser1.getAsset(secondCurrency)?.amountBefore);

	});	

});

describe.skip('xyk-pallet - Operate with a highly unbalanced pool [mg - newAsset]', () => {
	
	var testUser1 : User;
	var sudo : User;
    var testUser2 : User;
	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;


	beforeAll( async () => {
		try {
			getApi();
		  } catch(e) {
			await initApi();
		}
	
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
        
        const divNumber = new BN(100);
		//add two curerncies and balance to testUser:
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [divNumber,MAX_BALANCE.div(divNumber)], sudo);
		await testUser1.addMGATokens(sudo);

	
		// check users accounts.
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

        
        testUser2 = new User(keyring);
        keyring.addPair(testUser2.keyRingPair);
        await sudo.mint(new BN(0),testUser2, MAX_BALANCE.div(divNumber));
        await sudo.mint(secondCurrency,testUser2, MAX_BALANCE);
        await sudo.mint(firstCurrency,testUser2, MAX_BALANCE);
        testUser2.addAssets([firstCurrency,secondCurrency]);
        await testUser2.addMGATokens(sudo);
        //Lets create a pool with Lot of MGA few secondCurr.
        await createPool(testUser2.keyRingPair ,new BN(0), MAX_BALANCE.div(divNumber), secondCurrency, divNumber)
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
			}
		);
        await createPool(testUser2.keyRingPair ,firstCurrency, MAX_BALANCE.div(divNumber), secondCurrency, MAX_BALANCE.div(divNumber))
		.then(
			(result) => {
					const eventResponse = getEventResultFromTxWait(result);
					expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		
			}
		);
        
		await testUser2.refreshAmounts(AssetWallet.BEFORE);

	});
	
    test('[BUG] Buy a few assets to a wallet linked to MGA  => overflow.', async () => {

        // lets buy some asets
        var poolBalanceAssetsBefore = await getBalanceOfPool(secondCurrency, firstCurrency);
        var poolBalanceMGAAssetBefore = await getBalanceOfPool(new BN(0), secondCurrency);

        await buyAsset(testUser1.keyRingPair, secondCurrency, firstCurrency, MAX_BALANCE.div(new BN('100000000000')), MAX_BALANCE)
        .then(
            (result) => {
                const eventResponse = getEventResultFromTxWait(result);
                expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);		
            }
        );
        var poolBalanceAssetsAfter = await getBalanceOfPool(secondCurrency, firstCurrency);
        var poolBalanceMGAAssetAfter = await getBalanceOfPool(new BN(0), secondCurrency);

        await testUser1.refreshAmounts(AssetWallet.AFTER);

        expect(poolBalanceMGAAssetAfter[0]).not.bnEqual(new BN(0));
        expect(poolBalanceAssetsAfter[0]).not.bnEqual(new BN(0));
        expect(poolBalanceAssetsBefore[0]).not.bnEqual(new BN(0));
        expect(poolBalanceMGAAssetBefore[0]).not.bnEqual(new BN(0));

	});	
    
});
