import {EventTest} from './utils/actions'
import {getApi, initApi} from "./utils/api";

import BN from 'bn.js'
require('dotenv').config()

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export const main = async () => {
  console.log('main start')

  try {
    getApi();
  } catch(e) {
    await initApi()
  }




// eventListener()
   await EventTest(new BN(0),new BN(1))
   

}


main().then(() => {
  console.log('end')
  process.exit(0)
})

