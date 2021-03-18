import { AddressOrPair, SubmittableExtrinsic } from '@polkadot/api/types'
import { getApi } from './api'
import BN from 'bn.js'

export const signTx = async (
  tx: SubmittableExtrinsic<'promise'>,
  address: AddressOrPair,
  nonce: BN
) => {
  const unsub = await tx.signAndSend(address, { nonce }, (result: any) => {
    // handleTx(result, unsub)
  })
  //   setNonce(nonce + 1)
}

export async function calcuate_mint_liquidity_price_local(firstAssetId: BN, secondAssetId: BN, first_asset_amount: BN){

	let liquidity_asset_id = await getLiquidityAssetId(firstAssetId, secondAssetId);
	let total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	let [first_asset_reserve, second_asset_reserve] = await getBalanceOfPool(firstAssetId, secondAssetId);

	let second_asset_amount: BN = first_asset_amount.mul(second_asset_reserve).div(first_asset_reserve).add(new BN(1));
	let liquidity_assets_minted: BN = first_asset_amount.mul(total_liquidity_assets).div(first_asset_reserve);

	return [second_asset_amount, liquidity_assets_minted]
}

export async function calcuate_burn_liquidity_price_local(firstAssetId: BN, secondAssetId: BN, first_asset_amount: BN){

	let liquidity_asset_id = await getLiquidityAssetId(firstAssetId, secondAssetId);
	let total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	let [first_asset_reserve, second_asset_reserve] = await getBalanceOfPool(firstAssetId, secondAssetId);

	let liquidity_asset_burned: BN = first_asset_amount.mul(total_liquidity_assets).div(first_asset_reserve);
	let second_asset_amount: BN = second_asset_reserve.mul(liquidity_asset_burned).div(total_liquidity_assets);

	return [second_asset_amount, liquidity_asset_burned]
}

export function calculate_sell_price_local(input_reserve: BN, output_reserve: BN, sell_amount: BN){
	let input_amount_with_fee: BN = sell_amount.mul(new BN(997));
	let numerator: BN = input_amount_with_fee.mul(output_reserve);
	let denominator: BN = input_reserve.mul(new BN(1000)).add(input_amount_with_fee);
	let result: BN = numerator.div(denominator);
	return new BN(result.toString())
}

export function calculate_buy_price_local(input_reserve: BN, output_reserve: BN, buy_amount: BN){
	let numerator: BN = input_reserve.mul(buy_amount).mul(new BN(1000));
	let denominator: BN = output_reserve.sub(buy_amount).mul(new BN(997));
	let result: BN = numerator.div(denominator).add(new BN(1));
	return new BN(result.toString())
}

export async function calculate_sell_price_rpc(input_reserve: BN, output_reserve: BN, sell_amount: BN){
	const api = getApi();
	let result = await api.rpc.xyk.calculate_sell_price(input_reserve, output_reserve, sell_amount);
	return new BN(result.price.toString())
}

export async function calculate_buy_price_rpc(input_reserve: BN, output_reserve: BN, buy_amount: BN){
	const api = getApi();
	let result = await api.rpc.xyk.calculate_buy_price(input_reserve, output_reserve, buy_amount);
	return new BN(result.price.toString())
}

export async function getCurrentNonce(account?: string) {
  const api = getApi();
  if (account) {
    const { nonce } = await api.query.system.account(account)
    return new BN(nonce.toString())
  }
  return -1
}

export async function getUserAssets(account: any, assets){
	let user_asset_balances = [];
	for (const asset of assets){
		let user_asset_balance = await getBalanceOfAsset(asset, account);
		user_asset_balances.push(user_asset_balance);
	}
	return user_asset_balances;
}

export async function getBalanceOfAsset(assetId: BN, account: any ) {
  const api = getApi();

	const balance = await api.query.assets.balances([assetId, account]);

	return new BN(balance.toString())

}

export async function getBalanceOfPool(assetId1: BN, assetId2: BN ) {
  const api = getApi();

	const balance1 = await api.query.xyk.pools([assetId1, assetId2]);
	const balance2 = await api.query.xyk.pools([assetId2, assetId1]);

	return [new BN(balance1.toString()), new BN(balance2.toString())]

}

export async function getLiquidityAssetId(assetId1: BN, assetId2: BN ) {
  const api = getApi();

	const liquidity_asset_id = await api.query.xyk.liquidityAssets([assetId1, assetId2]);

	return new BN (liquidity_asset_id.toString())

}

export async function getAssetSupply(assetId1: BN) {
  const api = getApi();

	const asset_supply = await api.query.assets.totalSupply(assetId1);

	return new BN(asset_supply.toString())

}

export async function getNextAssetId() {
  const api = getApi();

  const nextAssetId = await api.query.assets.nextAssetId();

  return new BN(nextAssetId.toString())
}

export async function getSudoKey() {
  const api = getApi();

  const sudoKey = await api.query.sudo.key();

  return sudoKey
}

export const balanceTransfer = async (account: any, target:any, amount: BN) => {
  const api = getApi();

  signTx(
    api.tx.balances.transfer(target, amount),
    account,
    await getCurrentNonce(account.address)
  )
}

export const sudoIssueAsset = async (account: any, total_balance: BN, target: any) => {
  const api = getApi();

  signTx(
		api.tx.sudo.sudo(
    	api.tx.assets.issue(total_balance, target)
		),
    account,
    await getCurrentNonce(account.address)
  )
}

export const transferAsset = async (account: any, asset_id:BN, target: any, amount: BN) => {
  const api = getApi();

  signTx(
    api.tx.assets.transfer(asset_id, target, amount),
    account,
    await getCurrentNonce(account.address)
  )
}


export const createPool = async (account: any, firstAssetId: BN,firstAssetAmount: BN,secondAssetId: BN,secondAssetAmount: BN) => {
  const api = getApi();

  signTx(
    api.tx.xyk.createPool(firstAssetId, firstAssetAmount, secondAssetId, secondAssetAmount),
    account,
    await getCurrentNonce(account.address)
  )
}

export const sellAsset = async (account: any, soldAssetId: BN, boughtAssetId: BN, amount: BN, minAmountOut: BN) => {
  const api = getApi();

  signTx(
    api.tx.xyk.sellAsset(soldAssetId, boughtAssetId, amount, minAmountOut),
    account,
    await getCurrentNonce(account.address)
  )
}

export const buyAsset = async (account: any, soldAssetId: BN, boughtAssetId: BN, amount: BN, maxAmountIn: BN) => {
  const api = getApi();

  signTx(
    api.tx.xyk.buyAsset(soldAssetId, boughtAssetId, amount, maxAmountIn),
    account,
    await getCurrentNonce(account.address)
  )
}

export const mintLiquidity = async (account: any, firstAssetId: BN, secondAssetId: BN, firstAssetAmount: BN) => {
  const api = getApi();

  signTx(
    api.tx.xyk.mintLiquidity(firstAssetId, secondAssetId, firstAssetAmount),
    account,
    await getCurrentNonce(account.address)
  )
}

export const burnLiquidity = async (account: any, firstAssetId: BN, secondAssetId: BN, firstAssetAmount: BN) => {
  const api = getApi();

  signTx(
    api.tx.xyk.burnLiquidity(firstAssetId, secondAssetId, firstAssetAmount),
    account,
    await getCurrentNonce(account.address)
  )
}
