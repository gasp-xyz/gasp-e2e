import {getApi, initApi} from "../../utils/api";
import { calculate_buy_price_rpc, calculate_sell_price_rpc} from '../../utils/tx'
import BN from 'bn.js'


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

beforeAll( async () => {
	try {
		getApi();
	  } catch(e) {
		await initApi();
	}

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


