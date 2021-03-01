import { getCurrentNonce, signTx, getBalanceOfAsset, getBalanceOfPool, getNextAssetId, issueAsset, createPool, sellAsset} from './tx'
import {waitNewBlock, expectAssetIssued, expectPoolCreated, expectAssetsSwapped } from './eventListeners'
import { getApi } from './api'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {sleep} from "./utils";

export const EventTest = async (soldAssetId: BN, boughtAssetId: BN) => {
  const api = getApi()
  const keyring = new Keyring({ type: 'sr25519' })
  const alice = keyring.addFromUri('//Alice')
  const bob = keyring.addFromUri('//Bob')
  const charlie = keyring.addFromUri('//Charlie')


  const aliceSoldAssetIdBalance = new BN(await getBalanceOfAsset(soldAssetId,alice))
  const aliceBoughtAssetIdBalance = new BN(await getBalanceOfAsset(boughtAssetId,alice))

  const nextAssetId = await getNextAssetId()
  const firstAssetId = new BN(nextAssetId.toString())
  const secondAssetId = firstAssetId.add(new BN(1))
  
 //issue asset 1
  console.log("issuing asset " + firstAssetId)
  var eventPromise = expectAssetIssued()
  issueAsset(alice,new BN(100000))
  var eventResponse = await eventPromise
  console.log(eventResponse)

  await waitNewBlock()

   //issue asset 2
  console.log("issuing asset " + secondAssetId)
  eventPromise = expectAssetIssued()
  issueAsset(alice,new BN(100000))
  eventResponse = await eventPromise
  console.log(eventResponse)

  await waitNewBlock()

  console.log("creating pool " + firstAssetId + "-" + secondAssetId)
  eventPromise = expectPoolCreated()
  createPool(alice, firstAssetId, new BN(10000), secondAssetId, new BN(10000))
  eventResponse = await eventPromise
  console.log(eventResponse)

  await waitNewBlock()

  console.log("swapping asset " + firstAssetId + "for" + secondAssetId)
  eventPromise = expectAssetsSwapped();
  sellAsset(alice,soldAssetId, boughtAssetId, new BN(300), new BN(0))
  eventResponse = await eventPromise
  console.log(eventResponse)


//TODO buy, mint, burn


 
}





