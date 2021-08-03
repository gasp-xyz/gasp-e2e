import {getApi, initApi} from "../../utils/api";
import {waitNewBlock} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {User} from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { testLog } from "../../utils/Logger";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(15000000000);
process.env.NODE_ENV = 'test';
const {sudo:sudoUserName} = getEnvironmentRequiredVars();

//The idea of this is to use it as a playground, so whenever its needed to test any specifics,
// we can setup the specific scenario and test.
// always skip the test suite to avoid long test executions.
// node ./node_modules/jest/bin/jest.js test/exploratory/playground.ts --testRegex='.*' 
describe('Playground', () => {
	
	var testUser1 : User;
	var sudo : User;
	var api: any;
	var keyring : Keyring;

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
		api = getApi();
	});
	const MAX_BALANCE = new BN('340282366920938463463374607431768211455'); //max balance
	test('Request big numbers', async () => {

		let result = await ( api.rpc as any).xyk.calculate_buy_price(MAX_BALANCE, MAX_BALANCE, MAX_BALANCE);
		testLog.getLog().info(result);
	});
	test('Request big numbers -1', async () => {
		const b = MAX_BALANCE.sub(new BN(1));
		let result = await ( api.rpc as any).xyk.calculate_buy_price(b, b, b);
		testLog.getLog().info(result);
	});

});