import {getApi, initApi} from "../../utils/api";
import { calculate_buy_price_id_rpc, calculate_buy_price_rpc, calculate_sell_price_id_rpc, calculate_sell_price_rpc, getBalanceOfPool} from '../../utils/tx'
import BN from 'bn.js'
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Assets } from "../../utils/Assets"
import { ApiPromise, Keyring } from "@polkadot/api";
import { User } from "../../utils/User";

jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';
let api :ApiPromise;
beforeAll( async () => {
	try {
		getApi();
	  } catch(e) {
		await initApi();
	}
	api = getApi();

})


test.each([
		[new BN(-1),new BN(-1),new BN(-1),"createType(Balance):: Balance: Negative number passed to unsigned type"],
		[new BN(1),new BN(-1),new BN(1),"createType(Balance):: Balance: Negative number passed to unsigned type"],
		[new BN(-1),new BN(1),new BN(1),"createType(Balance):: Balance: Negative number passed to unsigned type"],
	])
	('xyk-rpc - calculate_sell_price validates parameters - Negative params', async(input_reserve,output_reserve,amount, expected) => {

	await expect( 
		calculate_sell_price_rpc(input_reserve,output_reserve, amount)
	).rejects
	.toThrow(expected.toString())

	await expect( 
		calculate_buy_price_rpc(input_reserve,output_reserve, amount)
	).rejects
	.toThrow(expected.toString())
	
});

test.each([
	[new BN(1),new BN(1),new BN(0),new BN(0)],
	[new BN(0),new BN(0),new BN(0),new BN(0)],
	[new BN(0),new BN(1),new BN(1),new BN(1)],
	[new BN(0),new BN(0),new BN(1),new BN(0)],
])
('xyk-rpc - calculate_sell_price validates parameters - Zeroes [inputReserve->%s,outputReserve->%s,amount->%s,expected->%s]', async(input_reserve,output_reserve,amount, expected) => {

	const priceSell = await calculate_sell_price_rpc(input_reserve,output_reserve, amount);
	expect(priceSell).toEqual(expected);

});

test.each([
	[new BN(1),new BN(1),new BN(0),new BN(1)], //imput_reserve = 1 (buying 0 it cost 1)? ¡¡ weird !!
	[new BN(0),new BN(0),new BN(0),new BN(0)], // al zeroes is = 0
	[new BN(0),new BN(1),new BN(1),new BN(0)], //imput_reserve = 0 (it must cost 0) 
	[new BN(0),new BN(0),new BN(1),new BN(0)], //imput_reserve = 0 (buying 1 of nothing it must cost 0) 
	[new BN(1),new BN(0),new BN(0),new BN(0)], //imput_reserve = 1 (buying 0 it must cost 0) 
])
('xyk-rpc - calculate_buy_price validates parameters - Zeroes [inputReserve->%s,outputReserve->%s,amount->%s,expected->%s]', async(input_reserve,output_reserve,amount, expected) => {

	const priceSell = await calculate_buy_price_rpc(input_reserve,output_reserve, amount);
	expect(priceSell).toEqual(expected);

});

describe('xyk-rpc - calculate_buy_price_by_id:No pool assotiated with the assets', () => {

	let dictAssets = new Map<number, BN>();

	beforeAll( async () => {
		const {sudo:sudoUserName} = getEnvironmentRequiredVars();
		const keyring = new Keyring({ type: 'sr25519' });
		const sudo = new User(keyring, sudoUserName);
		keyring.addPair(sudo.keyRingPair);
		
		//the idea of this mess is to have assets with different values,
		const assetIds = await Assets.setupUserWithCurrencies(sudo, [10,10], sudo);	
		for (let index = 0; index < assetIds.length; index++) {
			dictAssets.set(index,assetIds[index]);
		}
	})
	//now with the dict indexes we do the testing.
	//ie, pool1, assets(0 and 1) in the dictionary, requesting amount of 0 , we expect 1. Weird.
	test.each([
		[0,1,new BN(0),new BN(0)],  
		[1,0,new BN(1),new BN(0)],   //weird scenario.		
	])
	('validate parameters [soldTokenId->%s,boughtTokenId->%s,amount->%s,expected->%s]', async(soldTokenId,boughtTokenId,amount, expected) => {
		
		const priceBuy = await calculate_buy_price_id_rpc(dictAssets.get(soldTokenId)!,dictAssets.get(boughtTokenId)!, amount);
		expect(priceBuy).toEqual(expected);
	
	});	
});

test.each([
	[new BN(-1),new BN(0),new BN(0),"createType(TokenId):: u32: Negative number passed to unsigned type"],  
	[new BN(0),new BN(-1),new BN(0),"createType(TokenId):: u32: Negative number passed to unsigned type"],  	
])
('validate parameters: negative asset ids [soldTokenId->%s,boughtTokenId->%s,amount->%s,expected->%s]', async(soldTokenId,boughtTokenId,amount, expected) => {
	
	await expect( 
		( api.rpc as any).xyk.calculate_buy_price_id(soldTokenId, boughtTokenId, amount)
	).rejects
	.toThrow(expected.toString())

	await expect( 
		( api.rpc as any).xyk.calculate_sell_price_id(soldTokenId, boughtTokenId, amount)
	).rejects
	.toThrow(expected.toString())

});




