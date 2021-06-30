import {getApi, initApi} from "../../utils/api";
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import { fromBNToUnitString, getEnvironmentRequiredVars } from "../../utils/utils";
import { getBalanceOfPool, getUserAssets } from "../../utils/tx";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';


let keyring : Keyring;

const {alice:testUserName} = getEnvironmentRequiredVars();

beforeAll( async () => {
	try {
		getApi();
	  } catch(e) {
		await initApi();
	}
	keyring = new Keyring({ type: 'sr25519' });
	
})

test.each([
	[new BN(4), new BN(5)],
	[new BN(0), new BN(5)],
	[new BN(0), new BN(6)],
	[new BN(4), new BN(6)],
])('xyk-CI - validate pools created: Pool[%s,%s]', async (assetId1,assetId2) => {
	
	var poolBalance = await getBalanceOfPool(assetId1, assetId2);
	console.info(`Pool[${assetId1},${assetId2}] has: ${fromBNToUnitString(poolBalance[0])} , ${fromBNToUnitString(poolBalance[1])} `);
	expect(poolBalance[0]).not.toEqual(new BN(0));
	expect(poolBalance[1]).not.toEqual(new BN(0));

});

test('xyk-CI - validate user got the right Assets', async() => {
	console.info(`TEST_INFO: Validating ${testUserName}, export TEST_USER_NAME env variable to change the test user`);
	
	const alice = keyring.addFromUri(testUserName);
	const aliceBalances = await getUserAssets(alice.address, [new BN(0),new BN(4),new BN(5),new BN(6)]);
	console.info(`AssetID[0] - ${fromBNToUnitString(aliceBalances[0])}`);
	console.info(`AssetID[4] - ${fromBNToUnitString(aliceBalances[1])}`);
	console.info(`AssetID[5] - ${fromBNToUnitString(aliceBalances[2])}`);
	console.info(`AssetID[6] - ${fromBNToUnitString(aliceBalances[3])}`);
	expect(aliceBalances[0]).not.toEqual(new BN(0));
	expect(aliceBalances[1]).not.toEqual(new BN(0));
	expect(aliceBalances[2]).not.toEqual(new BN(0));
	expect(aliceBalances[3]).not.toEqual(new BN(0));
})






