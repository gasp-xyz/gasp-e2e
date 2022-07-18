import { ApiPromise } from "@polkadot/api";
import { resolve } from "path";

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
  let finished = false;
  let cancel = () => (finished = true);
  const p = new Promise(async (_, reject) => {
    cancel = () => {
      reject();
      return finished;
    };
    await api.rpc.chain.subscribeNewHeads(async (lastHeader): Promise<void> => {
      if (finished) {
        resolve();
        return;
      }
      const currentBlock = await api.rpc.chain.getBlock(lastHeader.hash);
      const events = await api.query.system.events.at(lastHeader.hash);
      await logLine(
        eventsFileName,
        `\n \n [ ${new Date().toUTCString()}] - Received ${
          (events as any).length
        } events: ------- Block: ${currentBlock}`
      );

      // Loop through the Vec<EventRecord>
      (events as any).forEach(async (record: any) => {
        // Extract the phase, event and the event types
        const { event } = record;
        const types = event.typeDef;

        // Show what we are busy with
        let eventMessage = `[ ${new Date().toUTCString()}] - \t${
          event.section
        }:${event.method}`;

        // Loop through each of the parameters, displaying the type and data
        event.data.forEach((data: any, index: any) => {
          eventMessage += `\n \t\t\t\t\t\t\t${
            types[index].type
          }: ${data.toString()}`;
        });
        await logLine(eventsFileName, eventMessage);
      });
    });
  });
  return { p, cancel };
}

export async function pendingExtrinsics(logName: string, api: ApiPromise) {
  const fileName = logName + "_pendingExtrinsics";
  let finished = false;
  let cancel = () => (finished = true);
  const p = new Promise(async (_, reject) => {
    cancel = () => {
      reject();
      return finished;
    };

    await api.rpc.chain.subscribeNewHeads(async (): Promise<void> => {
      await api.rpc.author.pendingExtrinsics(async (extrinsics) => {
        if (finished) {
          resolve();
          return;
        }
        await logLine(
          fileName,
          `\n \n Pending extrinsics ![ ${new Date().toUTCString()}] - PendingExtrinsics ${
            extrinsics.length
          }`
        );
      });
    });
  });
  return { p, cancel };
}
