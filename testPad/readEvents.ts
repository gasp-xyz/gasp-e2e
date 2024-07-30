//README:
//Configure uris constant.
//Build And Run!
// npx ts-node test/exploratory/eventListener.ts

import { Mangata } from "gasp-sdk";

import { testLog } from "../utils/Logger";

const uris = [
  "wss://staging.mangatafinance.cloud:9944",
  "wss://integration.mangatafinance.cloud:9944",
];

//this constant will skip some traces.
const onlyrelevant = true;
// this will handle if printing in pretty-multilines.
const pretty = false;

async function main() {
  const promises = [];
  for (let index = 0; index < uris.length; index++) {
    const uri = uris[index];
    const mangata = Mangata.instance([uri]);
    const api = await mangata.api();
    const p = new Promise((): void => {
      // Subscribe to system events via storage
      api.query.system.events((events: any): void => {
        testLog
          .getLog()
          .info(
            `[ ${new Date().toUTCString()}] - W[${uri}] - Received ${
              events.length
            } events: -------`,
          );

        // Loop through the Vec<EventRecord>
        events.forEach((record: any) => {
          // Extract the phase, event and the event types
          const { event, phase } = record;
          const types = event.typeDef;

          // Show what we are busy with
          let eventMessage = `[ ${new Date().toUTCString()}] - W[${uri}] \t${
            event.section
          }:${event.method}`;

          if (!onlyrelevant) {
            eventMessage += `:: (phase=${phase.toString()} \n
                            W[${uri}] \t\t${event.meta.documentation.toString()}`;
          }

          // Loop through each of the parameters, displaying the type and data
          event.data.forEach((data: any, index: any) => {
            if (pretty) {
              eventMessage += `\n \t\t\t\t\t\t\t${
                types[index].type
              }: ${data.toString()}`;
            } else {
              eventMessage += ` [${types[index].type}: ${data.toString()}] `;
            }
          });
          testLog.getLog().info(eventMessage);
        });
      });
    });
    promises.push(p);
  }
  await Promise.all(promises).then((values) => {
    testLog.getLog().info(values.toString());
  });
  testLog.getLog().info("----------------");
}

main().catch((error) => {
  testLog.getLog().error(error);
  process.exit(-1);
});
