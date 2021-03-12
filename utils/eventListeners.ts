import { getApi } from './api'

// for testing
export const expectEvent = (section: any, method: any, module_index: any) => {
  const api = getApi()

  return new Promise(async (resolve, reject) => {
    const unsubscribe = await api.query.system.events((events: any) => {
      events.forEach((record: any) => {
        const { event } = record
        if (event.section === section && event.method === method) {
          unsubscribe()
          resolve(['ExtrinsicSuccess', null])
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
