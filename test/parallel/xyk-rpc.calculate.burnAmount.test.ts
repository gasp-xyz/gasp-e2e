import {getApi, initApi} from "../../utils/api";
import { getBalanceOfPool, get_burn_amount} from '../../utils/tx'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {User} from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';
const defaultCurrencyAmount = 100000;

beforeAll( async () => {
	try {
		getApi();
	  } catch(e) {
		await initApi();
	}

});

//TODO,  fix when bug gets resolved.
describe('xyk-rpc - calculate burn amount', () => {

	let dictAssets = new Map<number, BN>();

	beforeAll( async () => {
		const {sudo:sudoUserName} = getEnvironmentRequiredVars();
		const keyring = new Keyring({ type: 'sr25519' });
		const sudo = new User(keyring, sudoUserName);
		keyring.addPair(sudo.keyRingPair);
		
		//the idea of this mess is to have some pools with different values,
		//pool1 [0,1]: with [defaultCurrencyAmount,defaultCurrencyAmount]
		const assetIds = await Assets.setupUserWithCurrencies(sudo, [defaultCurrencyAmount,defaultCurrencyAmount], sudo);	
		const assetValues = [defaultCurrencyAmount,defaultCurrencyAmount];
		for (let index = 0; index < assetIds.length; index++) {
			dictAssets.set(index,assetIds[index]);
			if(index < assetIds.length -1){
				await sudo.createPoolToAsset(new BN(assetValues[index]), new BN(assetValues[index+1]), assetIds[index], assetIds[index+1]);
			}
		}
	})
	//now with the dict indexes we do the testing.
	//ie, pool1, assets(0 and 1) in the dictionary, requesting amount of 0 , we expect 1. Weird.
	test.each([
		[0,1,new BN(1000),new BN(0)],		
		[0,1,new BN(10000),new BN(0)],		
		[0,1,new BN(100000),new BN(1)]		
	])
	('validate parameters - buy [soldTokenId->%s,boughtTokenId->%s,amount->%s,expected->%s]', async(soldTokenId,boughtTokenId,amount, expected) => {
		
		const poolBalance = await getBalanceOfPool(dictAssets.get(soldTokenId)!, dictAssets.get(boughtTokenId)!);
		const burnAmount = await get_burn_amount(dictAssets.get(boughtTokenId)!,dictAssets.get(soldTokenId)!, amount);
		expect(burnAmount).toEqual(expected);
	});
})

