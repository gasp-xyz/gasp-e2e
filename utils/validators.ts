import BN from "bn.js";
import { EventResult, ExtrinsicResult } from "./eventListeners";
import { getAssetSupply, getBalanceOfPool, getLiquidityAssetId } from "./tx";
import { AssetWallet, User } from "./User";

export function validateTransactionSucessful(eventResult: EventResult, tokensAmount: number, user : User) {
	expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
	expect(eventResult.data[1]).toEqual(user.keyRingPair.address);
	expect(eventResult.data[2]).toEqual(tokensAmount);
}

export function validateEmptyAssets(assets : BN[]){
	assets.forEach( asset => expect(asset.toString()).toEqual('0') );
}

export function validateAssetsWithValues(assets : BN[], values : number []){
	for (let idx = 0; idx < values.length; idx++) {
		expect(assets[idx].toString()).toEqual(values[idx].toString())
		
	}
	expect(assets).toHaveLength(values.length);
}

export function validatePoolCreatedEvent(result : EventResult, userAddress : string,  firstCurrency : BN , first_asset_amount : BN, secondCurrency : BN, second_asset_amount : BN){
	//validate the pool created event contract.
	const rawData = result.data;
	expect(rawData).not.toBeNull();
	expect(rawData[0]).toEqual(userAddress);
	expect(rawData[1]).toEqual(parseInt(firstCurrency.toString()));
	expect(rawData[2].toString()).toEqual(first_asset_amount.toString());
	expect(rawData[3]).toEqual(parseInt(secondCurrency.toString()));
	expect(rawData[4].toString()).toEqual(second_asset_amount.toString());

}

export function validateAssetsSwappedEvent(result : EventResult, userAddress : string,  firstCurrency : BN , first_asset_amount : BN, secondCurrency : BN, second_asset_amount : BN){
	//validate the asset swapped created event contract.
	validatePoolCreatedEvent(result, userAddress, firstCurrency, first_asset_amount, secondCurrency, second_asset_amount);
}


export async function validateStatusWhenPoolCreated(firstCurrency: BN, secondCurrency: BN, testUser1: User, pool_balance_before: BN[], total_liquidity_assets_before: BN, first_asset_amount:BN = new BN(50000), second_asset_amount:BN = new BN(50000)) {
	var liquidity_asset_id = await getLiquidityAssetId(firstCurrency, secondCurrency);
	var liquidity_assets_minted = first_asset_amount.add(second_asset_amount);

	testUser1.addAsset(liquidity_asset_id, new BN(0));

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser1.validateWalletReduced(firstCurrency, first_asset_amount);
	await testUser1.validateWalletReduced(secondCurrency, second_asset_amount);
	await testUser1.validateWalletIncreased(liquidity_asset_id, liquidity_assets_minted);

	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect([pool_balance_before[0].add(first_asset_amount),
	pool_balance_before[1].add(second_asset_amount)])
		.toEqual(pool_balance);

	const balance = await getBalanceOfPool(secondCurrency, firstCurrency);
	expect([pool_balance_before[0].add(first_asset_amount),
	pool_balance_before[1].add(second_asset_amount)])
		.toEqual([balance[1], balance[0]]);

	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
		.toEqual(total_liquidity_assets);
}

export async function validateUnmodified(firstCurrency: BN, secondCurrency: BN, testUser1: User, pool_balance_before: BN[]) {

	await testUser1.refreshAmounts(AssetWallet.AFTER);
	await testUser1.validateWalletsUnmodified();
	
	var pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
	expect([pool_balance_before[0],pool_balance_before[1]]).toEqual(pool_balance);

	const balance = await getBalanceOfPool(secondCurrency, firstCurrency);
	expect([pool_balance_before[0],pool_balance_before[1]]).toEqual([balance[1], balance[0]]);

}
