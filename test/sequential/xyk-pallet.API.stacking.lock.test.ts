/*
 * @group sequential
 * @group api
 * 
 */

import {api, getApi, initApi} from "../../utils/api";
import { getLock} from '../../utils/tx'

import {waitNewBlock, ExtrinsicResult, getEventResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {User} from "../../utils/User";
import { getEnvironmentRequiredVars, MGA_ASSET_ID, MGA_DEFAULT_LIQ_TOKEN } from "../../utils/utils";
import { signSendAndWaitToFinishTx } from "../../utils/txHandler";

jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';
const {sudo:sudoUserName} = getEnvironmentRequiredVars();

const ASSET_ID_MGA_ETH = MGA_DEFAULT_LIQ_TOKEN;
const ASSET_ID_MGA = MGA_ASSET_ID;
describe('xyk-pallet - Sell Asset: validate Errors:', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;

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
		keyring.addFromUri(sudoUserName);

		await sudo.mint(ASSET_ID_MGA,testUser1,new BN(10000));
		await sudo.mint(ASSET_ID_MGA_ETH,testUser1,new BN(10000));
		await testUser1.addMGATokens(sudo);

	});
	test('Bond operation locks some amount', async () => {
		await waitNewBlock();
		var eventPromise = getEventResult("staking","Bonded", 14);
		//@ts-ignore: Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
		await signSendAndWaitToFinishTx( api?.tx.staking.bond(testUser1.keyRingPair.address, new BN(1000),'Staked', new BN(3)), testUser1.keyRingPair);
		var eventResponse = await eventPromise;
		  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
		expect(eventResponse.data[1]).toEqual(1000);
		const lockStatus = await getLock(testUser1.keyRingPair.address, ASSET_ID_MGA_ETH);
		expect(lockStatus[0].id).toContain('staking');
		expect(lockStatus[0].amount).toContain('1.0000 nUnit');
	});
});