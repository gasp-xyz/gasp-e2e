import { ApiPromise } from "@polkadot/api";

export async function logLine(logName: string, lineToLog: string) {
  const fs = require("fs");
  await fs.appendFile(`${logName}.txt`, lineToLog, function (err: boolean) {
    if (err) {
      // eslint-disable-next-line no-console
      console.error("oh oh fail to log!");
    }
  });
}

export async function captureEvents(logName: string, api: ApiPromise) {
  const eventsFileName = logName + "_events";
  await api.rpc.chain.subscribeNewHeads(async (lastHeader): Promise<void> => {
    const currentBlock = await api.rpc.chain.getBlock(lastHeader.hash);
    const events = await api.query.system.events.at(lastHeader.hash);
    await logLine(
      eventsFileName,
      `\n \n [ ${new Date().toUTCString()}] - Received ${
        events.length
      } events: ------- Block: ${currentBlock}`
    );

    // Loop through the Vec<EventRecord>
    events.forEach(async (record: any) => {
      // Extract the phase, event and the event types
      const { event } = record;
      const types = event.typeDef;

      // Show what we are busy with
      let eventMessage = `[ ${new Date().toUTCString()}] - \t${event.section}:${
        event.method
      }`;

      // Loop through each of the parameters, displaying the type and data
      event.data.forEach((data: any, index: any) => {
        eventMessage += `\n \t\t\t\t\t\t\t${
          types[index].type
        }: ${data.toString()}`;
      });
      await logLine(eventsFileName, eventMessage);
    });
  });
}
