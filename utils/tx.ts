import { AddressOrPair, SubmittableExtrinsic } from '@polkadot/api/types'
import { getApi } from './api'
import BN from 'bn.js'

export const signTx = async (
  tx: SubmittableExtrinsic<'promise'>,
  address: AddressOrPair,
  nonce: number
) => {
  const unsub = await tx.signAndSend(address, { nonce }, (result: any) => {
    // handleTx(result, unsub)
  })
  //   setNonce(nonce + 1)
}

export async function getCurrentNonce(account?: string) {
  const api = getApi()
  if (account) {
    const { nonce } = await api.query.system.account(account)
    //console.log('currentNonce', nonce.toNumber())
    //   setNonce(nonce.toNumber())
    return nonce.toNumber()
  }
 // console.log('currentNonce', -1)
  return -1
}

export async function getBalanceOfAsset(assetId: BN, account: any ) {
  const api = getApi()

    const balance = await api.query.assets.balances([assetId, account.address])

  //  console.log(account.address + ' asset ' + assetId + " balance: " + balance.toString())

    return balance.toString()

}

export async function getBalanceOfPool(assetId1: BN, assetId2: BN ) {
  const api = getApi()

    const balance1 = await api.query.xyk.pools([assetId1, assetId2])
    const balance2 = await api.query.xyk.pools([assetId2, assetId1])

  //  console.log("pool " + assetId1 + "-" + assetId2 + " has balance of "+ balance1 +  "-" + balance2)

    return [balance1,balance2]

}

export async function getLiquidityAssetId(assetId1: BN, assetId2: BN ) {
  const api = getApi()

    const liquidity_asset_id = await api.query.xyk.liquidityAssets([assetId1, assetId2])

    return liquidity_asset_id

}

export async function getAssetSupply(assetId1: BN) {
  const api = getApi()

    const asset_supply = await api.query.assets.totalSupply(assetId1)

    return asset_supply

}

export async function getNextAssetId() {
  const api = getApi()

  const nextAssetId = await api.query.assets.nextAssetId()

  return nextAssetId
}

export async function getSudoKey() {
  const api = getApi()

  const sudoKey = await api.query.sudo.key();

  return sudoKey
}

export const balanceTransfer = async (account: any, target:any, amount: BN) => {
  const api = getApi()

  signTx(
    api.tx.balances.transfer(target, amount),
    account,
    await getCurrentNonce(account.address)
  )
}

export const sudoIssueAsset = async (account: any, total_balance: BN, target: any) => {
  const api = getApi()

  signTx(
		api.tx.sudo.sudo(
    	api.tx.assets.issue(total_balance, target)
		),
    account,
    await getCurrentNonce(account.address)
  )
}

export const transferAsset = async (account: any, asset_id:BN, target: any, amount: BN) => {
  const api = getApi()

  signTx(
    api.tx.assets.transfer(asset_id, target, amount),
    account,
    await getCurrentNonce(account.address)
  )
}


export const createPool = async (account: any, firstAssetId: BN,firstAssetAmount: BN,secondAssetId: BN,secondAssetAmount: BN) => {
  const api = getApi()

  signTx(
    api.tx.xyk.createPool(firstAssetId, firstAssetAmount, secondAssetId, secondAssetAmount),
    account,
    await getCurrentNonce(account.address)
  )
}

export const sellAsset = async (account: any, soldAssetId: BN, boughtAssetId: BN, amount: BN, minAmountOut: BN) => {
  const api = getApi()

  signTx(
    api.tx.xyk.sellAsset(soldAssetId, boughtAssetId, amount, minAmountOut),
    account,
    await getCurrentNonce(account.address)
  )
}

export const buyAsset = async (account: any, soldAssetId: BN, boughtAssetId: BN, amount: BN, maxAmountIn: BN) => {
  const api = getApi()

  signTx(
    api.tx.xyk.buyAsset(soldAssetId, boughtAssetId, amount, maxAmountIn),
    account,
    await getCurrentNonce(account.address)
  )
}

export const mintLiquidity = async (account: any, firstAssetId: BN, secondAssetId: BN, firstAssetAmount: BN) => {
  const api = getApi()

  signTx(
    api.tx.xyk.mintLiquidity(firstAssetId, secondAssetId, firstAssetAmount),
    account,
    await getCurrentNonce(account.address)
  )
}

export const burnLiquidity = async (account: any, firstAssetId: BN, secondAssetId: BN, firstAssetAmount: BN) => {
  const api = getApi()

  signTx(
    api.tx.xyk.burnLiquidity(firstAssetId, secondAssetId, firstAssetAmount),
    account,
    await getCurrentNonce(account.address)
  )
}
