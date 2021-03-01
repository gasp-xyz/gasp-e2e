import { getCurrentNonce, signTx, getBalanceOfAsset, getBalanceOfPool, getNextAssetId } from './tx'
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
  const first_asset_id = new BN(nextAssetId.toString())
  const second_asset_id = first_asset_id.add(new BN(1))
  
 //issue asset 1
  console.log("issuing asset " + first_asset_id)
  var eventPromise = expectAssetIssued()
  issueAsset(alice,new BN(100000))
  var eventResponse = await eventPromise
  console.log(eventResponse)

  await waitNewBlock()

   //issue asset 2
  console.log("issuing asset " + second_asset_id)
  eventPromise = expectAssetIssued()
  issueAsset(alice,new BN(100000))
  eventResponse = await eventPromise
  console.log(eventResponse)

  await waitNewBlock()

  console.log("creating pool " + first_asset_id + "-" + second_asset_id)
  eventPromise = expectPoolCreated()
  createPool(alice, first_asset_id, new BN(10000), second_asset_id, new BN(10000))
  eventResponse = await eventPromise
  console.log(eventResponse)

  await waitNewBlock()

  console.log("swapping asset " + first_asset_id + "for" + second_asset_id)
  eventPromise = expectAssetsSwapped();
  sellAsset(alice,soldAssetId, boughtAssetId, new BN(300), new BN(0))
  eventResponse = await eventPromise
  console.log(eventResponse)


//TODO transfers


 
}

export const issueAsset = async (account: any, total_balance: BN) => {
  const api = getApi()

  signTx(
    api.tx.assets.issue(total_balance),
    account,
    await getCurrentNonce(account.address)
  )
}


export const createPool = async (account: any, first_asset_id: BN,first_asset_amount: BN,second_asset_id: BN,second_asset_amount: BN) => {
  const api = getApi()

  signTx(
    api.tx.xyk.createPool(first_asset_id,first_asset_amount,second_asset_id,second_asset_amount),
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

export const buyAsset = async (account: any, soldAssetId: BN, boughtAssetId: BN, amount: BN, maxAmountOut: BN) => {
  const api = getApi()

  signTx(
    api.tx.xyk.buyAsset(soldAssetId, boughtAssetId, amount, maxAmountOut),
    account,
    await getCurrentNonce(account.address)
  )
}

export const mintLiquidity = async (account: any, first_asset_id: BN, second_asset_id: BN, first_asset_amount: BN) => {
  const api = getApi()

  signTx(
    api.tx.xyk.mintLiquidity(first_asset_id, second_asset_id, first_asset_amount),
    account,
    await getCurrentNonce(account.address)
  )
}

export const burnLiquidity = async (account: any, first_asset_id: BN, second_asset_id: BN, first_asset_amount: BN) => {
  const api = getApi()

  signTx(
    api.tx.xyk.burnLiquidity(first_asset_id, second_asset_id, first_asset_amount),
    account,
    await getCurrentNonce(account.address)
  )
}

export const waitNewBlock = () =>  {
  const api = getApi();
  let count = 0;
  return new Promise(async (resolve) => {
    const unsubscribe = await api.rpc.chain.subscribeNewHeads((header) => {
     
      console.log(`Chain is at block: #${header.number}`);

        if (++count === 2) {
          unsubscribe();
          resolve(true)
        }
      });
    
  })
}

export const expectAssetIssued = () =>  {
  const api = getApi();

  return new Promise(async (resolve) => {
    const unsubscribe = await api.query.system.events<any>((events) => {
    
      events.forEach((record:any) => {
        const { event } = record;

         if (event.method === "Issued") {

          const response:any = {};
          response["event"] = `${event.section}:${event.method}`;
          response["AssetId"] = event.data[0].toString()
          response["AccountId"] = event.data[1].toString()
          response["TotalAssetBalance"] = event.data[2].toString()
         
          unsubscribe()
          resolve(response)
        }      
      })
    })
  })
}



export const expectPoolCreated = () =>  {
  const api = getApi();
 console.log("startexpectpool")
  return new Promise(async (resolve) => {
    const unsubscribe = await api.query.system.events<any>((events) => {
     
      events.forEach((record:any) => {
        const { event } = record;

        console.log(`${event.section}:${event.method}`)
        console.log(event.typeDef)
        event.data.forEach((data:any) => {
          console.log("data " + data)
        })
        if (event.method === "PoolCreated") {

         
      //  const types = event.typeDef;
  
          const response:any = {};
          response["event"] = `${event.section}:${event.method}`;
          response["AccountId"] = event.data[0].toString()
          response["FirstAssetId"] = event.data[1].toString()
          response["FirstAssetAmount"] = event.data[2].toString()
          response["SecondAssetId"] = event.data[3].toString()
          response["SecondAssetAmount"] = event.data[4].toString()
          //console.log(`${event.section}:${event.method}`);
          // console.log(`\t\t${event.meta.documentation.toString()}`);
    
          // Loop through each of the parameters, displaying the type and data
          // event.data.forEach((data:any, index:any) => {
          //   response[types[index].type.toString()] = data.toString()
          //   console.log(`\t\t\t${types[index].type.toString()}: ${data.toString()}`);
          //   console.log()
          // });
          unsubscribe()
          resolve(response)
        }    
      })
    })
  })
}

export const expectAssetsSwapped = () =>  {
  const api = getApi();

  return new Promise(async (resolve) => {
    const unsubscribe = await api.query.system.events<any>((events) => {
     
      events.forEach((record:any) => {
        const { event } = record;

        if (event.method === "AssetsSwapped") {
  
          const response:any = {};
          response["event"] = `${event.section}:${event.method}`;
          response["AccountId"] = event.data[0].toString()
          response["SoldAssetId"] = event.data[1].toString()
          response["SoldAssetAmount"] = event.data[2].toString()
          response["BoughtAssetId"] = event.data[3].toString()
          response["BoughtAssetAmount"] = event.data[4].toString()

          unsubscribe()
          resolve(response)
        }
      })
    })
  })
}

export const expectLiquidityMinted = () =>  {
  const api = getApi();

  return new Promise(async (resolve) => {
    const unsubscribe = await api.query.system.events<any>((events) => {
     
      events.forEach((record:any) => {
        const { event } = record;

        if (event.method === "LiquidityMinted") {
  
          const response:any = {};
          response["event"] = `${event.section}:${event.method}`;
          response["AccountId"] = event.data[0].toString()
          response["FirstAssetId"] = event.data[1].toString()
          response["FirstAssetAmount"] = event.data[2].toString()
          response["SecondAssetId"] = event.data[3].toString()
          response["SecondAssetAmount"] = event.data[4].toString()
          response["LiquidityAssetId"] = event.data[5].toString()
          response["LiquidityAssetAmount"] = event.data[6].toString()

          unsubscribe()
          resolve(response)
        }
      })
    })
  })
}

export const expectLiquidityBurned = () =>  {
  const api = getApi();

  return new Promise(async (resolve) => {
    const unsubscribe = await api.query.system.events<any>((events) => {
     
      events.forEach((record:any) => {
        const { event } = record;

        if (event.method === "LiquidityBurned") {
  
          const response:any = {};
          response["event"] = `${event.section}:${event.method}`;
          response["AccountId"] = event.data[0].toString()
          response["FirstAssetId"] = event.data[1].toString()
          response["FirstAssetAmount"] = event.data[2].toString()
          response["SecondAssetId"] = event.data[3].toString()
          response["SecondAssetAmount"] = event.data[4].toString()
          response["LiquidityAssetId"] = event.data[5].toString()
          response["LiquidityAssetAmount"] = event.data[6].toString()

          unsubscribe()
          resolve(response)
        }
      })
    })
  })
}