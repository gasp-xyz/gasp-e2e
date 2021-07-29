import { AddressOrPair, SubmittableExtrinsic  } from '@polkadot/api/types'
import { getApi } from './api'
import BN from 'bn.js'
import { env } from 'process'
import { SudoDB } from './SudoDB';
import {AccountData} from '@polkadot/types/interfaces/balances'
import { signAndWaitTx } from './txHandler';


export const signTx = async (
  tx: SubmittableExtrinsic<'promise'>,
  address: AddressOrPair,
  nonce: BN
) => {
  await tx.signAndSend(address, { nonce }, (result: any) => {
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

export async function calcuate_burn_liquidity_price_local(firstAssetId: BN, secondAssetId: BN, liquidity_asset_amount: BN){

	let liquidity_asset_id = await getLiquidityAssetId(firstAssetId, secondAssetId);
	let total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	let [first_asset_reserve, second_asset_reserve] = await getBalanceOfPool(firstAssetId, secondAssetId);

	let first_asset_amount: BN = first_asset_reserve.mul(liquidity_asset_amount).div(total_liquidity_assets);
	let second_asset_amount: BN = second_asset_reserve.mul(liquidity_asset_amount).div(total_liquidity_assets);

	return [first_asset_amount, second_asset_amount]
}

export function calculate_sell_price_local(input_reserve: BN, output_reserve: BN, sell_amount: BN){
	let input_amount_with_fee: BN = sell_amount.mul(new BN(997));
	let numerator: BN = input_amount_with_fee.mul(output_reserve);
	let denominator: BN = input_reserve.mul(new BN(1000)).add(input_amount_with_fee);
	let result: BN = numerator.div(denominator);
	return new BN(result.toString())
}

export function calculate_sell_price_local_no_fee(input_reserve: BN, output_reserve: BN, sell_amount: BN){
	let input_amount_with_no_fee: BN = sell_amount;
	let numerator: BN = input_amount_with_no_fee.mul(output_reserve);
	let denominator: BN = input_reserve.mul(new BN(1000)).add(input_amount_with_no_fee);
	let result: BN = numerator.div(denominator);
	return new BN(result.toString())
}

export function calculate_buy_price_local(input_reserve: BN, output_reserve: BN, buy_amount: BN){
	let numerator: BN = input_reserve.mul(buy_amount).mul(new BN(1000));
	let denominator: BN = output_reserve.sub(buy_amount).mul(new BN(997));
	let result: BN = numerator.div(denominator).add(new BN(1));
	return new BN(result.toString())
}

export async function get_burn_amount(firstAssetId: BN, secondAssetId: BN, liquidity_asset_amount: BN){
	const api = getApi();
  //I could not find a way to get and inject the xyk interface in the api builder. 
	let result = await ( api.rpc as any).xyk.get_burn_amount(firstAssetId, secondAssetId, liquidity_asset_amount);
	return result.toHuman()
}

export async function calculate_sell_price_rpc(input_reserve: BN, output_reserve: BN, sell_amount: BN){
	const api = getApi();
	let result = await ( api.rpc as any).xyk.calculate_sell_price(input_reserve, output_reserve, sell_amount);
	return new BN(result.price.toString())
}

export async function calculate_buy_price_rpc(input_reserve: BN, output_reserve: BN, buy_amount: BN){
	const api = getApi();
    //I could not find a way to get and inject the xyk interface in the api builder. 
	let result = await ( api.rpc as any).xyk.calculate_buy_price(input_reserve, output_reserve, buy_amount);
	return new BN(result.price.toString())
}

export async function calculate_buy_price_id_rpc(soldTokenId: BN, boughtTokenId: BN, buy_amount: BN){
	const api = getApi();
	let result = await ( api.rpc as any).xyk.calculate_buy_price_id(soldTokenId, boughtTokenId, buy_amount);
	return new BN(result.price.toString())
}

export async function calculate_sell_price_id_rpc(soldTokenId: BN, boughtTokenId: BN, sell_amount: BN){
	const api = getApi();
	let result = await ( api.rpc as any).xyk.calculate_sell_price_id(soldTokenId, boughtTokenId, sell_amount);
	return new BN(result.price.toString())
}

export async function getCurrentNonce(account?: string) {
  const api = getApi();
  if (account) {
    const { nonce } = await api.query.system.account(account);
    return new BN(nonce.toString())
  }
  return new BN(-1)
}

export async function getUserAssets(account: any, assets : BN[]){
	let user_asset_balances = [];
	for (const asset of assets){
		let user_asset_balance = await getBalanceOfAsset(asset, account);
		user_asset_balances.push(user_asset_balance);
	}
	return user_asset_balances;
}

export async function getBalanceOfAsset(assetId: BN, account: any ) {
  const api = getApi();

	const balance = await api.query.tokens.accounts(account, assetId);
  const accountData = (balance as AccountData);
	return new BN( accountData.free.toBigInt().toString())
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

export async function getLiquiditybalance(liquidityAssetId: BN){
  const pool = await getLiquidityPool(liquidityAssetId);
  const poolBalance = await getBalanceOfPool(pool[0], pool[1]);
  return poolBalance;
}

export async function getLiquidityPool(liquidityAssetId: BN ) {
  const api = getApi();

	const liqPool = await api.query.xyk.liquidityPools(liquidityAssetId);
  const poolAssetIds = (liqPool.toHuman() as Number[]);
  if(!poolAssetIds)
    return [new BN(-1),new BN(-1)];

  const result = poolAssetIds.map( num => new BN(num.toString()) )
	return result;

}



export async function getAssetSupply(assetId1: BN) {
  const api = getApi();

	const asset_supply = await api.query.tokens.totalIssuance(assetId1.toString());

	return new BN(asset_supply.toString())

}

export async function getNextAssetId() {
  const api = getApi();

  const nextAssetId = await api.query.tokens.nextCurrencyId();
  return new BN(nextAssetId.toString())
}

export async function getAvailableCurrencies() {
  const api = getApi();
  const curerncies = await api.query.tokens.totalIssuance();
  return curerncies;
}


export async function getSudoKey() {
  const api = getApi();

  const sudoKey = await api.query.sudo.key();

  return sudoKey
}

export const balanceTransfer = async (account: any, target:any, amount: number) => {
  const api = getApi();

  const txResult = await signAndWaitTx(
    api.tx.balances.transfer(target, amount),
    account,
    await (await getCurrentNonce(account.address)).toNumber()
  )
  return txResult;
}

export const setBalance = async (sudoAccount: any, target:any, amountFree: number, amountReserved: number) => {

  const api = getApi();
  const nonce = await SudoDB.getInstance().getSudoNonce(sudoAccount.address);
  console.info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);
  const txResult = await signAndWaitTx(
		api.tx.sudo.sudo(
      api.tx.balances.setBalance(target, amountFree, amountReserved)
      ),
    sudoAccount,
    nonce
  );
  return txResult;
}

export const sudoIssueAsset = async (account: any, total_balance: BN, target: any) => {

  const api = getApi();
  const nonce = await SudoDB.getInstance().getSudoNonce(account.address);
  console.info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);

  const txResult = await signAndWaitTx(
		api.tx.sudo.sudo(
    	api.tx.tokens.create(target, total_balance)
		),
    account,
    nonce
  );
  console.log(txResult);
  return txResult;
}

export const transferAsset = async (account: any, asset_id:BN, target: any, amount: BN) => {
  const api = getApi();
  const nonce = await (await getCurrentNonce(account.address)).toString();
  const txResult = signAndWaitTx(
    api.tx.tokens.transfer(target, asset_id, amount),
    account,
    parseInt(nonce)
  )
  return txResult;
}

export const transferAll = async (account: any, asset_id:BN, target: any) => {
  const api = getApi();

  const txResult = await signAndWaitTx(
    api.tx.tokens.transferAll(target, asset_id),
    account,
    await (await getCurrentNonce(account.address)).toNumber()
  )
  return txResult;
}

export const mintAsset = async (account: any, asset_id:BN, target: any, amount: BN) => {
  const api = getApi();
  const nonce = await SudoDB.getInstance().getSudoNonce(account.address);
  console.info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);
  const txResult = await signAndWaitTx(
    api.tx.sudo.sudo(
      api.tx.tokens.mint(asset_id, target, amount),
      ),
    account,
    nonce   
  )
  return txResult;
}


export const createPool = async (account: any, firstAssetId: BN,firstAssetAmount: BN,secondAssetId: BN,secondAssetAmount: BN) => {
  const api = getApi();
  const nonce = await getCurrentNonce(account.address);
  console.info(`Creating pool:${firstAssetId},${firstAssetAmount},${secondAssetId},${secondAssetAmount}`);
  const txResult = await signAndWaitTx(
    api.tx.xyk.createPool(firstAssetId, firstAssetAmount, secondAssetId, secondAssetAmount),
    account,
    nonce.toNumber()
  )
  return txResult
}

export const sellAsset = async (account: any, soldAssetId: BN, boughtAssetId: BN, amount: BN, minAmountOut: BN) => {
  const api = getApi();
  const nonce = await getCurrentNonce(account.address);
  const txResult = await signAndWaitTx(
    api.tx.xyk.sellAsset(soldAssetId, boughtAssetId, amount, minAmountOut),
    account,
    nonce.toNumber()
  )
  return txResult
}

export const buyAsset = async (account: any, soldAssetId: BN, boughtAssetId: BN, amount: BN, maxAmountIn: BN) => {
  const api = getApi();
  const nonce = await getCurrentNonce(account.address);
  const txResult = await signAndWaitTx(
    api.tx.xyk.buyAsset(soldAssetId, boughtAssetId, amount, maxAmountIn),
    account,
    nonce.toNumber()
  )
  return txResult
}

export const mintLiquidity = async (account: any, firstAssetId: BN, secondAssetId: BN, firstAssetAmount: BN, expectedSecondAssetAmount: BN = new BN(Number.MAX_SAFE_INTEGER)) => {
  const api = getApi();
  const nonce = await (await getCurrentNonce(account.address)).toNumber();
  const txResult = await signAndWaitTx(
    api.tx.xyk.mintLiquidity(firstAssetId, secondAssetId, firstAssetAmount, expectedSecondAssetAmount),
    account,
    nonce
  )
  return txResult;
}

export const burnLiquidity = async (account: any, firstAssetId: BN, secondAssetId: BN, liquidityAssetAmount: BN) => {
  const api = getApi();
  const nonce = await getCurrentNonce(account.address);
  const txResult = await signAndWaitTx(
    api.tx.xyk.burnLiquidity(firstAssetId, secondAssetId, liquidityAssetAmount),
    account,
    nonce.toNumber()
  )
  return txResult;
}

export async function getAccountInfo(account?: string) {
  const api = getApi();
  if (account) {
    const { data } = await api.query.system.account(account);

    return JSON.parse(data.toString());
  }
  return -1
}

export async function getTreasury(currencyId : BN){
  const api = getApi();
  const treasuryBalance = await api.query.xyk.treasury(currencyId);
  return treasuryBalance.toHuman();
}

export async function getTreasuryBurn(currencyId : BN){
  const api = getApi();
  const treasuryBalance = await api.query.xyk.treasuryBurn(currencyId);
  return treasuryBalance.toHuman();
}

export async function getLock(accountAddress:string, assetId : BN){
  const api = getApi();
  const locksResponse = await api.query.tokens.locks(accountAddress,assetId)!;
  const decodedlocks = JSON.parse(JSON.stringify(locksResponse.toHuman()));
  return decodedlocks;

}
