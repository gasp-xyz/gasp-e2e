import {api, getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, signSendAndWaitToFinish} from '../../utils/tx'
import {waitNewBlock} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {User} from "../../utils/User";
import { Assets } from "../../utils/Assets";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(15000000000);
process.env.NODE_ENV = 'test';

//The idea of this is to use it as a playground, so whenever its needed to test any specifics,
// we can setup the specific scenario and test.
// always skip the test suite to avoid long test executions.
// node ./node_modules/jest/bin/jest.js test/exploratory/playground.ts --testRegex='.*' 
describe.skip('Playground', () => {
	
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
	
		// build Maciatko, he is sudo. :S
		sudo = new User(keyring, '//Maciatko');
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);

	});

	test('WhileTrue selling the same assets', async () => {
        //creates an unfair pool,
        //add balance
        //mint token to give tokens to the user
        //while true
        // sell assts 
		await waitNewBlock();
		// setup users
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, 2, [10000000,10000000], sudo);
		await testUser1.setBalance(sudo);
		await signSendAndWaitToFinish( 
			api?.tx.xyk.createPool(firstCurrency, 1, secondCurrency, 1), 
			testUser1.keyRingPair 
		);

		while(true){
			await sudo.mint(firstCurrency, testUser1,new BN(10000));

			try {
				const status = await signSendAndWaitToFinish( 
					api?.tx.xyk.sellAsset(firstCurrency, secondCurrency, new BN(10000), new BN(0)),
					testUser1.keyRingPair 
				);
				console.info(status);
			} catch (error) {
				await sudo.mint(firstCurrency, testUser1,new BN(10000));
			}
			let balance = await getBalanceOfPool(secondCurrency, firstCurrency);
			console.info(balance.toString())
		}

	});

});