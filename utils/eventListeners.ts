import { getApi } from './api'

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