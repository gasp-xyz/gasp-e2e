//ts-node ./listenBalanceChanges.ts
/* eslint-disable no-console */
import { testLog } from "../utils/Logger";
import { getMangataInstance } from "../utils/api";
import { getEnvironmentRequiredVars } from "../utils/utils";

async function main() {
  const { chainUri } = getEnvironmentRequiredVars();
  const mangata = await getMangataInstance(chainUri);
  // const provider = new WsProvider("ws://127.0.0.1:8844");
  //const api = await new ApiPromise(options({ provider })).isReady;
  const api = await mangata.getApi();

  const ALICE = "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y";

  // Retrieve the initial data
  let previous = await api.query.tokens.accounts(ALICE, 0);

  console.log("ALICE has a balance of " + previous.free);
  console.log("Reserved Balance --    " + previous.reserved);
  // Subscribe and listen to balance changes
  await api.query.tokens.accounts(ALICE, 0, (result) => {
    // Calculate the delta
    const changed = result.free !== previous.free;
    // Only display positive value changes (Since we are pulling 'previous' above already,
    // the initial balance change will also be zero)
    if (changed) {
      console.log("New TX of - Cost -> " + previous.free.sub(result.free));
      console.log("Balance Now is         " + result.free);
      console.log("Reserved Balance --    " + result.reserved);
      previous = result;
    }
  });
}

main().catch((error) => {
  testLog.getLog().error(error);
  process.exit(-1);
});
