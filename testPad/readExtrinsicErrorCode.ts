//README:
//Configure uris constant.
//Build And Run!
// npx ts-node test/exploratory/eventListener.ts
import { BN } from "@polkadot/util";
import { Mangata } from "gasp-sdk";

import { testLog } from "./../utils/Logger";

const uri = "wss://staging.mangatafinance.cloud:9944";

async function main() {
  const mangata = Mangata.instance([uri]);
  const api = await mangata.api();
  //import "BN";
  const extrinsicNo = 304;
  const eventsAt = extrinsicNo + 1;
  // returns Hash
  const blockHash = await api.rpc.chain.getBlockHash(extrinsicNo);
  const blockHashEvents = await api.rpc.chain.getBlockHash(eventsAt);
  // returns SignedBlock
  const signedBlock = await api.rpc.chain.getBlock(blockHash);

  // the hash for the block, always via header (Hash -> toHex()) - will be
  // the same as blockHash above (also available on any header retrieved,
  // subscription or once-off)
  testLog.getLog().info(signedBlock.block.header.hash.toHex());

  // the hash for each extrinsic in the block
  signedBlock.block.extrinsics.forEach((ex, index) => {
    testLog.getLog().info(index, JSON.stringify(ex.toHuman()));
  });

  const allEvents = await api.query.system.events.at(blockHashEvents);
  allEvents
    // test the events against the specific types we are looking for
    .forEach(async ({ event }) => {
      const eventH = event.toHuman();
      testLog.getLog().info(JSON.stringify(event.toHuman()));

      if (eventH.method === "ExtrinsicFailed") {
        const errorC = JSON.stringify(eventH.data[0].Module.error);
        const indexC = JSON.stringify(eventH.data[0].Module.index);
        const errordesc = await api.registry.findMetaError({
          index: new BN(indexC),
          error: new BN(errorC),
        });
        testLog.getLog().info(JSON.stringify(errordesc));
      }
    });
  testLog.getLog().info("----------------");
}

main().catch((error) => {
  testLog.getLog().error(error);
  process.exit(-1);
});
