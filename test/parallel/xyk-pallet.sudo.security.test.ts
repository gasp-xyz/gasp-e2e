import {getApi, initApi} from "../../utils/api";
import { getCurrentNonce, signTx} from '../../utils/tx'
import {ExtrinsicResult, getUserEventResult, waitNewBlock} from '../../utils/eventListeners'
import { Keyring } from '@polkadot/api'
import {User} from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import BN from "bn.js";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.spyOn(console, 'error').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

var testUser1 : User;
var testUser2 : User;
var sudo : User;
var infoUser1Before:any;

var keyring : Keyring;
//creating pool

const {sudo:sudoUserName} = getEnvironmentRequiredVars();


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
	testUser2 = new User(keyring);
	sudo = new User(keyring, sudoUserName);

	keyring.addPair(testUser1.keyRingPair);
	keyring.addPair(testUser2.keyRingPair);
	keyring.addPair(sudo.keyRingPair);

    await testUser1.setBalance(sudo);

})

beforeEach( async () => {
    infoUser1Before = await testUser1.getUserAccountInfo();
})

test('xyk-pallet - SecurityTests - Only sudo can perform actions [balancecs.setBalance to other user]', async () => {

        const api = getApi();
        let eventPromise = getUserEventResult("balances","BalanceSet", 14, testUser1.keyRingPair.address);
        waitNewBlock();
        waitNewBlock();

        signTx(
            api.tx.sudo.sudo(
                api.tx.balances.setBalance(testUser2.keyRingPair.address, Math.pow(10,11) -1, Math.pow(10,11) -1)
                ),
                testUser1.keyRingPair,
                await getCurrentNonce(testUser1.keyRingPair.address)
        )

		const result = await eventPromise;
        expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);

		const infoUser2 = await testUser2.getUserAccountInfo();

        expect(infoUser2.free).toBe(0);
        expect(infoUser2.feeFrozen).toBe(0);
        expect(infoUser2.miscFrozen).toBe(0);
        expect(infoUser2.reserved).toBe(0);
         
});

test('xyk-pallet - SecurityTests - Only sudo can perform actions [balances.setBalance to itself]', async () => {

    const api = getApi();
    let eventPromise = getUserEventResult("balances","BalanceSet", 14, testUser1.keyRingPair.address);
    waitNewBlock();
    waitNewBlock();

    const infoUser1Before = await testUser1.getUserAccountInfo();

    signTx(
        api.tx.sudo.sudo(
            api.tx.balances.setBalance(testUser1.keyRingPair.address, Math.pow(10,11) -1, Math.pow(10,11) -1)
            ),
            testUser1.keyRingPair,
            await getCurrentNonce(testUser1.keyRingPair.address)
    )

    const result = await eventPromise;
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);

    const infoUser1After = await testUser1.getUserAccountInfo();
    expect(infoUser1Before).not.toEqual(infoUser1After);
    expect(infoUser1Before.free).toBeGreaterThan(infoUser1After.free);

});

test('xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.create]', async () => {

    const api = getApi();
    let eventPromise = getUserEventResult("tokens","Issued", 12, testUser2.keyRingPair.address);

    signTx(
		api.tx.sudo.sudo(
            api.tx.tokens.create(testUser2.keyRingPair.address, new BN(10000000))
		),
        testUser1.keyRingPair,
        await getCurrentNonce(testUser1.keyRingPair.address)
    );

    const result = await eventPromise;
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);

});

test('xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.create to itself]', async () => {

    const api = getApi();
    let eventPromise = getUserEventResult("tokens","Issued", 12, testUser1.keyRingPair.address);

    signTx(
		api.tx.sudo.sudo(
            api.tx.tokens.create(testUser1.keyRingPair.address, new BN(10000000))
		),
        testUser1.keyRingPair,
        await getCurrentNonce(testUser1.keyRingPair.address)
    );

    const result = await eventPromise;
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);

});


test('xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.mint]', async () => {

    const api = getApi();
    const eventPromise = getUserEventResult("tokens", "Minted", 14, testUser2.keyRingPair.address);
    signTx(
        api.tx.sudo.sudo(
          api.tx.tokens.mint(new BN(0), testUser2.keyRingPair.address, new BN(100000)),
          ),
        testUser1.keyRingPair,
        await getCurrentNonce(testUser1.keyRingPair.address)   
    )

    const result = await eventPromise;
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);

});

test('xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.mint to itself]', async () => {

    const api = getApi();
    const eventPromise = getUserEventResult("tokens", "Minted", 14, testUser1.keyRingPair.address);
    signTx(
        api.tx.sudo.sudo(
          api.tx.tokens.mint(new BN(0), testUser1.keyRingPair.address, new BN(100000)),
          ),
        testUser1.keyRingPair,
        await getCurrentNonce(testUser1.keyRingPair.address)   
    )

    const result = await eventPromise;
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);

});

afterEach(async () => {

    const infoUser1After = await testUser1.getUserAccountInfo();
    expect(infoUser1Before).not.toEqual(infoUser1After);
    expect(infoUser1Before.free).toBeGreaterThan(infoUser1After.free);
    await waitNewBlock();
    await waitNewBlock();
})





