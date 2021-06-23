//README:
//Configure uris constant.
//Build And Run!
// npx ts-node test/exploratory/eventListener4000.ts
//Example of a trace:
//[ Fri, 28 May 2021 13:49:54 GMT] - W[127.0.0.1]         xyk:LiquidityMinted [AccountId: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY]  [TokenId: 134]  [Balance: 20000]  [TokenId: 135]  [Balance: 20001]  [TokenId: 136]  [Balance: 20001] 
export {};

let uris = [
    'ws://127.0.0.1:9944',
//    'ws://172.28.1.1:9944',

]
const { initApi } = require("../../utils/api");
var ipRegex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/gm;



async function main () {

  let promises = [];
  for (let index = 0; index < uris.length; index++) {
    const uri = uris[index];
    const worker = ipRegex.exec(uri);
    const api = await initApi(uri);
    const p = new Promise( (): void =>{

      api.rpc.chain.subscribeNewHeads(async (header: any) => {
        console.info(`Chain is at block: #${header.number}`);
        const allRecords = await api.query.system.events.at(header.hash) as any[]
        console.info('-----Events-----');
        
        allRecords.forEach(chainEvent => {
          const { event } = chainEvent;
          const types = event.typeDef;

          let eventMessage = `[ ${new Date().toUTCString()}] - W[${worker}] \t${event.section}:${event.method}`;
                          // Loop through each of the parameters, displaying the type and data
          event.data.forEach((data : any , index : any) => {
                  eventMessage += ` [${types[index].type}: ${data.toString()}] `;
          });
          console.log(eventMessage);

        });
        

        console.info('-----EoEvents-----');
      })
    })
    promises.push(p);
  }
  await Promise.all(promises).then((values) => {
    console.log(values);
  });
  console.info('----------------');
  
}

main().catch((error) => {
  console.error(error);
  process.exit(-1);
});
