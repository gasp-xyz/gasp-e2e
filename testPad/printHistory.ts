//README:
//Configure uris constant.
//Build And Run!
// npx ts-node test/exploratory/eventListener.ts

import { Mangata } from "gasp-sdk";
import { testLog } from "../utils/Logger";

const uri = "wss://v4-collator-01.mangatafinance.cloud";

//this constant will skip some traces.
// this will handle if printing in pretty-multilines.

async function main() {
  const mangata = Mangata.instance([uri]);
  const currBlock = Number.parseInt(await mangata.getBlockNumber());
  const api = await mangata.api();
  let index = currBlock > 200 ? currBlock - 200 : 0;
  for (index; index < currBlock; index++) {
    const executionBlockHash = await api.rpc.chain.getBlockHash(index);
    const executionBlockHeader =
      await api.rpc.chain.getHeader(executionBlockHash);
    const apiAt = await api.at(executionBlockHeader.hash.toHex());
    const currentBlockEvents = await apiAt.query.system.events();

    // eslint-disable-next-line no-console
    const records = currentBlockEvents.toHuman();
    testLog
      .getLog()
      .info(` -- Block: ${index}  has ${(records! as any[]).length} events --`);
    // eslint-disable-next-line no-loop-func
    (records! as any[]).forEach((record) => {
      // Extract the phase, event and the event types
      const { event, phase } = record;
      const types = event.typeDef;
      printEvent(event, phase, types, index);
    });
  }
  while (true) {
    await mangata.waitForNewBlock();
    const block = Number.parseInt(await mangata.getBlockNumber());
    const executionBlockHash = await api.rpc.chain.getBlockHash(block);
    const executionBlockHeader =
      await api.rpc.chain.getHeader(executionBlockHash);
    const apiAt = await api.at(executionBlockHeader.hash.toHex());
    const currentBlockEvents = await apiAt.query.system.events();

    // eslint-disable-next-line no-console
    const records = currentBlockEvents.toHuman();
    testLog
      .getLog()
      .info(` -- Block: ${block}  has ${(records! as any[]).length} events --`);
    (records! as any[]).forEach((record) => {
      // Extract the phase, event and the event types
      const { event, phase } = record;
      const types = event.typeDef;
      printEvent(event, phase, types, block);
    });
  }
}
function printEvent(event: any, phase: any, types: any, index: Number) {
  let eventMessage = `[Block: ${index}] \t${event.section}:${
    event.method
  }: ${phase} - ${JSON.stringify(event.data)}`;

  // Loop through each of the parameters, displaying the type and data
  if ((event.data as any[]).length > 0) {
    event.data.forEach((data: any, index: any) => {
      if (types) {
        eventMessage += `\n \t\t\t\t\t\t\t${
          types[index].type
        }: ${data.toString()}`;
      }
    });
  }
  testLog.getLog().info(eventMessage);
}

main().catch((error) => {
  testLog.getLog().error(error);
  process.exit(-1);
});
