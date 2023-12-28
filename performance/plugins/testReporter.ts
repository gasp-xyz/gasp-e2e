import { ApiPromise } from "@polkadot/api";
import { resolve } from "path";
import fs from "fs";
export async function logLine(logName: string, lineToLog: string) {
  await fs.appendFile(`${logName}.txt`, lineToLog, (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error("oh oh fail to log!");
    }
  });
}

export function writeToFile(fileName: string, data: [number, number][]) {
  let payload = "";

  data.forEach(([blockNr, val]) => {
    payload += `${blockNr} ${val}\n`;
  });

  fs.writeFileSync(fileName, payload);
}

export function generateHtmlReport(
  fileName: string,
  enqueued: [number, number][],
  executed: [number, number][],
  pending: [number, number][],
) {
  const contentHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Performance Tests Report</title>
  </head>
  <body>
    <div class="chartMenu">
      <p>WWW.CHARTJS3.COM (Chart JS <span id="chartVersion"></span>)</p>
    </div>
    <div class="chartCard">
      <div class="chartBox">
        <canvas id="myChart"></canvas>
      </div>
    </div>
    <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/chart.js/dist/chart.umd.min.js"></script>
    <script>

      let executed_data = ${JSON.stringify(executed)};
      let enqueued_data = ${JSON.stringify(enqueued)};
      let pending_data = ${JSON.stringify(pending)};

      const config = {
        "type": "line",
        "data": {
          "labels": executed_data.map(data => data[0]),
          "datasets": [
            {
              "label": "executed",
              "data": executed_data.map(data => data[1])
            },
            {
              "label": "pending",
              "data": pending_data.map(data => data[1])
            },
            {
              "label": "enqueued",
              "data": enqueued_data.map(data => data[1])
            },
          ]
        },

        "options": {
          "title": {
            "display": true,
            "text": "Performance benchmarks"
          },
          "scales": {
            "y":
            {
              "suggestedMin": 150,
            },
          }
        }
      } // Line chart

      // config 
      // render init block
      const myChart = new Chart(
        document.getElementById("myChart"),
        config
      );
      // Instantly assign Chart.js version
      const chartVersion = document.getElementById('chartVersion');
      chartVersion.innerText = Chart.version;
    </script>

  </body>
</html>`;
  fs.writeFileSync(fileName, contentHtml);
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
        } events: ------- Block: ${currentBlock}`,
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

export async function trackPendingExtrinsics(api: ApiPromise, count: number) {
  const results: [number, number][] = [];
  // let header = await api.rpc.chain.getHeader();

  return new Promise<[number, number][]>(async (resolve, _) => {
    const unsub = await api.rpc.chain.subscribeNewHeads(
      async (header): Promise<void> => {
        const pending = await api.rpc.author.pendingExtrinsics();
        results.push([header.number.toNumber(), pending.length]);
        if (results.length > count) {
          unsub();
          resolve(results);
        }
      },
    );
  });
}

export async function trackEnqueuedExtrinsics(api: ApiPromise, count: number) {
  const results: [number, number][] = [];

  return new Promise<[number, number][]>(async (resolve, _) => {
    const unsub = await api.rpc.chain.subscribeNewHeads(
      async (header): Promise<void> => {
        const queue = await (
          await api.at(header.hash)
        ).query.system.storageQueue();

        let enqueuedTxsCount = 0;
        //@ts-ignore
        for (let i = 0; i < queue.length; ++i) {
          //@ts-ignore
          enqueuedTxsCount += queue[i][2].length;
        }

        results.push([header.number.toNumber(), enqueuedTxsCount]);
        if (results.length > count) {
          unsub();
          resolve(results);
        }
      },
    );
  });
}

export async function trackExecutedExtrinsics(api: ApiPromise, count: number) {
  const results: [number, number][] = [];

  return new Promise<[number, number][]>(async (resolve, _) => {
    const unsub = await api.rpc.chain.subscribeNewHeads(
      async (header): Promise<void> => {
        const block = await api.rpc.chain.getBlock(header.hash);

        results.push([header.number.toNumber(), block.block.extrinsics.length]);

        if (results.length > count) {
          unsub();
          resolve(results);
        }
      },
    );
  });
}
