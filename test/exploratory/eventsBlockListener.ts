//README:
//Configure uris constant.
//Build And Run!

import { testLog } from "../../utils/Logger";

// npx ts-node test/exploratory/eventsBlockListener.ts
export {};

const uris = [
    'ws://127.0.0.1:9944',
//    'ws://172.28.1.1:9944',

]
const { initApi } = require("../../utils/api");
const ipRegex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/gm;



async function main () {

  const promises = [];
  for (let index = 0; index < uris.length; index++) {
    const uri = uris[index];
    const worker = ipRegex.exec(uri);
    const api = await initApi(uri);
    const p = new Promise( (): void =>{

      api.rpc.chain.subscribeNewHeads(async (header: any) => {
        testLog.getLog().info(`Chain is at block: #${header.number}`);
        const allRecords = await api.query.system.events.at(header.hash) as any[]
        testLog.getLog().info('-----Events-----');
        
        allRecords.forEach(chainEvent => {
          const { event } = chainEvent;
          const types = event.typeDef;

          let eventMessage = `[ ${new Date().toUTCString()}] - W[${worker}] \t${event.section}:${event.method}`;
                          // Loop through each of the parameters, displaying the type and data
          event.data.forEach((data : any , index : any) => {
                  eventMessage += ` [${types[index].type}: ${data.toString()}] `;
          });
          testLog.getLog().info(eventMessage);

        });
        

        testLog.getLog().info('-----EoEvents-----');
      })
    })
    promises.push(p);
  }
  await Promise.all(promises).then((values) => {
    testLog.getLog().info(values);
  });
  testLog.getLog().info('----------------');
  
}

main().catch((error) => {
  testLog.getLog().error(error);
  process.exit(-1);
});
