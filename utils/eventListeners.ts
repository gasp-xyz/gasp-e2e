import { env } from 'process';
import { getApi } from './api'

// lets create a enum for different status.
export enum ExtrinsicResult
{
        ExtrinsicSuccess,
        ExtrinsicFailed,
        ExtrinsicUndefined,
}

///Class that stores the event result. 
export class EventResult{

  /**
   *
   */
  constructor(state : ExtrinsicResult = ExtrinsicResult.ExtrinsicUndefined, 
               data : String = '' ) {
    this.state = state;
    this.data = data;
  }

  state: ExtrinsicResult;
  data : String;
}

// for testing
export const getEventResult = (section: any, method: any, module_index: any) => {
  const api = getApi()

  return new Promise<EventResult>(async (resolve, reject) => {
    const unsubscribe = await api.query.system.events((events: any) => {
      events.forEach((record: any) => {
        const { event } = record
        if (event.section === section && event.method === method) {
          unsubscribe()
          resolve(new EventResult(ExtrinsicResult.ExtrinsicSuccess, JSON.parse(event.data.toString())))
        } else if (
									(event.section === "system" && event.method === "ExtrinsicFailed")
									&&
									(JSON.parse(event.data.toString())[0].Module.index = module_index)
									){
					unsubscribe()
          resolve(new EventResult(ExtrinsicResult.ExtrinsicFailed, JSON.parse(event.data.toString())[0].Module.error));
				}
      })
    })
  })
}

// for testing
export const getUserEventResult = (section: any, method: any, module_index: any, stringIdentifier) => {
  const api = getApi()

  return new Promise<EventResult>(async (resolve, reject) => {
    const unsubscribe = await api.query.system.events((events: any) => {
      events.forEach((record: any) => {
        console.info(`W[${env.JEST_WORKER_ID}] - waiting for: section: ${section}, Method: ${method}, ExtraParamIdentifier:  ${stringIdentifier} `)
        const { event } = record
        if (event.section === section && event.method === method && event.data.toString().includes(stringIdentifier)) {
          unsubscribe()
          console.info(`W[${env.JEST_WORKER_ID}] - All good. `);
          resolve(new EventResult(ExtrinsicResult.ExtrinsicSuccess, JSON.parse(event.data.toString())))
        } else if (
									(event.section === "system" && event.method === "ExtrinsicFailed")
									&&
									(JSON.parse(event.data.toString())[0].Module.index = module_index)
									){
					unsubscribe();
          console.info(`W[${env.JEST_WORKER_ID}] - It seems an error. `);
          resolve(new EventResult(ExtrinsicResult.ExtrinsicFailed, JSON.parse(event.data.toString())[0].Module.error));
				}
      })
    })
  })
}




// for testing
export const expectEvent = (section: any, method: any, module_index: any) => {
  const api = getApi()

  return new Promise(async (resolve, reject) => {
    const unsubscribe = await api.query.system.events((events: any) => {
      events.forEach((record: any) => {
        const { event } = record
        if (event.section === section && event.method === method) {
          unsubscribe()
          resolve(['ExtrinsicSuccess', JSON.parse(event.data.toString())])
        } else if (
									(event.section === "system" && event.method === "ExtrinsicFailed")
									&&
									(JSON.parse(event.data.toString())[0].Module.index = module_index)
									){
					unsubscribe()
          resolve(['ExtrinsicFailed', JSON.parse(event.data.toString())[0].Module.error])
				}
      })
    })
  })
}

export const waitNewBlock = () => {
  const api = getApi()
  let count = 0
  return new Promise(async (resolve) => {
    const unsubscribe = await api.rpc.chain.subscribeNewHeads((header: any) => {
      console.log(`Chain is at block: #${header.number}`)

      if (++count === 2) {
        unsubscribe()
        resolve(true)
      }
    })
  })
}




