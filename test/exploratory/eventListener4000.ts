//README:
//Configure uris constant.
//Build And Run!
// npx ts-node test/exploratory/eventListener4000.ts
//Example of a trace:
//[ Fri, 28 May 2021 13:49:54 GMT] - W[127.0.0.1]         xyk:LiquidityMinted [AccountId: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY]  [TokenId: 134]  [Balance: 20000]  [TokenId: 135]  [Balance: 20001]  [TokenId: 136]  [Balance: 20001] 

let uris = [
    'ws://127.0.0.1:9944',
    'ws://172.28.1.1:9944',

]
const { initApi } = require("../../utils/api");
var ipRegex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/gm;

//this constant will skip some traces.
const onlyrelevant = true;
// this will handle if printing in pretty-multilines.
const pretty = false;

async function main () {

  let promises = [];
  for (let index = 0; index < uris.length; index++) {
    const uri = uris[index];
    const worker = ipRegex.exec(uri);
    const api = await initApi(uri);
    const p = new Promise( (): void =>{
            // Subscribe to system events via storage
            api.query.system.events((events : any): void => {
                console.log(`[ ${new Date().toUTCString()}] - W[${worker}] Received ${events.length} events: -------`);

                // Loop through the Vec<EventRecord>
                events.forEach((record : any) => {
                // Extract the phase, event and the event types
                const { event, phase } = record;
                const types = event.typeDef;

                // Show what we are busy with
                let eventMessage = `[ ${new Date().toUTCString()}] - W[${worker}] \t${event.section}:${event.method}`;

                if(!onlyrelevant){
                    eventMessage += `:: (phase=${phase.toString()} \n
                            W[${worker}] \t\t${event.meta.documentation.toString()}`;
                }

                // Loop through each of the parameters, displaying the type and data
                event.data.forEach((data : any , index : any) => {
                    if(pretty)
                        eventMessage += `\n \t\t\t\t\t\t\t${types[index].type}: ${data.toString()}`;
                    else
                        eventMessage += ` [${types[index].type}: ${data.toString()}] `;
                });
                console.log(eventMessage);
            });
            });
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
