import {getApi, initApi} from "../../utils/api";
import { getCurrentNonce} from '../../utils/tx'
import {ExtrinsicResult, waitNewBlock} from '../../utils/eventListeners'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { getEnvironmentRequiredVars, MGA_ASSET_ID } from "../../utils/utils";
import BN from "bn.js";
import { getEventResultFromTxWait, signAndWaitTx } from "../../utils/txHandler";


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

    await testUser1.addMGATokens(sudo);
    testUser1.addAsset(MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

})

beforeEach( async () => {
    infoUser1Before = await testUser1.getUserAccountInfo();
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
})

test('xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.create]', async () => {

    const api = getApi();

    await signAndWaitTx(
		api.tx.sudo.sudo(
            api.tx.tokens.create(testUser2.keyRingPair.address, new BN(10000000))
		),
        testUser1.keyRingPair,
        await (await getCurrentNonce(testUser1.keyRingPair.address)).toNumber()
    ).then(
        (result) => {
        const eventResponse = getEventResultFromTxWait(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });

});

test('xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.create to itself]', async () => {

    const api = getApi();

    await signAndWaitTx(
		api.tx.sudo.sudo(
            api.tx.tokens.create(testUser1.keyRingPair.address, new BN(10000000))
		),
        testUser1.keyRingPair,
        await (await getCurrentNonce(testUser1.keyRingPair.address)).toNumber()
    ).then(
        (result) => {
        const eventResponse = getEventResultFromTxWait(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });

});


test('xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.mint]', async () => {

    const api = getApi();

    await signAndWaitTx(
        api.tx.sudo.sudo(
          api.tx.tokens.mint(new BN(0), testUser2.keyRingPair.address, new BN(100000)),
          ),
        testUser1.keyRingPair,
        await (await getCurrentNonce(testUser1.keyRingPair.address)).toNumber()   
    ).then(
        (result) => {
        const eventResponse = getEventResultFromTxWait(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });

});

test('xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.mint to itself]', async () => {

    const api = getApi();

    await signAndWaitTx(
        api.tx.sudo.sudo(
          api.tx.tokens.mint(new BN(0), testUser1.keyRingPair.address, new BN(100000)),
          ),
        testUser1.keyRingPair,
        await (await getCurrentNonce(testUser1.keyRingPair.address)).toNumber()
    ).then(
        (result) => {
        const eventResponse = getEventResultFromTxWait(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });

});

afterEach(async () => {
  
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const infoUser1After = await testUser1.getUserAccountInfo();
    expect(infoUser1Before).toEqual(infoUser1After);
    const assetValue = testUser1.getAsset(MGA_ASSET_ID);
    expect(assetValue?.amountBefore.toNumber()).toBeGreaterThan(assetValue?.amountAfter.toNumber()!);

})





