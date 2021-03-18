import {getApi, initApi} from "./utils/api";

import BN from 'bn.js'
require('dotenv').config()


export const main = async () => {
  console.log('main start')

  try {
    getApi();
  } catch(e) {
    await initApi()
  }

}


main().then(() => {
  console.log('end')
  process.exit(0)
})
