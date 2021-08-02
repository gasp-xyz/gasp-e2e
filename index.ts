import {getApi, initApi} from "./utils/api";
import { testLog } from "./utils/Logger";

require('dotenv').config()


export const main = async () => {
  testLog.getLog().info('main start')

  try {
    getApi();
  } catch(e) {
    await initApi()
  }

}


main().then(() => {
  testLog.getLog().info('end')
  process.exit(0)
})
