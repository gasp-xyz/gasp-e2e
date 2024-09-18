import { getApi } from "../utils/api";
import { setupApi } from "../utils/setup";
import { getStorageKey } from "../utils/setupsOnTheGo";

// @ts-ignore
// Fetch storage values for all modules and their storage items at a specific block
async function getStorageForBlock(api, blockHash) {
  const storageValues = [];

  // Retrieve runtime metadata
  const metadata = api.runtimeMetadata.asLatest;

  // Iterate over all pallets (modules)
  for (const pallet of metadata.pallets) {
    const moduleName = pallet.name.toString();
    //moduleName = moduleName.charAt(0).toLowerCase() + moduleName.slice(1);

    // Check if the pallet has storage items
    if (pallet.storage.isSome) {
      const storage = pallet.storage.unwrap().items;
      let values;
      // Iterate over all storage items
      for (const storageItem of storage) {
        const storageItemName = storageItem.name.toString();
        //storageItemName =
        //  storageItemName.charAt(0).toLowerCase() + storageItemName.slice(1);
        const key = getStorageKey(moduleName, storageItemName);
        try {
          let keys = await api.rpc.state.getKeysPaged(key, 1000);
          console.log("key::" + keys.length);
          values = [];
          while (keys.length > 0) {
            for (let index = 0; index < keys.length; index++) {
              values.push(
                (await api.rpc.state.getStorage(keys[index], blockHash)) ===
                  "None"
                  ? undefined
                  : (await api.rpc.state.getStorage(keys[index], blockHash))
                      .unwrap()
                      .toHuman(),
              );
              //console.log("val ::" + values[index]);
            }
            const nKeys = await api.rpc.state.getKeysPaged(
              key,
              1000,
              keys[keys.length - 1],
            );
            //console.log("nKeys ::" + nKeys.length);
            //console.log("nKeys ::" + keys[keys.length - 1] + nKeys);
            if (nKeys.includes(keys[keys.length - 1]) || nKeys.length === 0) {
              keys = [];
            } else {
              keys = nKeys;
            }
            console.log("keys2 ::" + keys.length);
          }
        } catch (e) {
          //@ts-ignore
          console.log("Error on quering storage" + e.message);
        }

        // Store the results for later comparison
        storageValues.push({
          module: moduleName,
          storageItem: storageItemName,
          value: values, // Decode the value into a human-readable format
        });
      }
    }
  }
  return storageValues;
}

// Compare storage between two blocks and print the differences
// @ts-ignore
// Compare the storage between two blocks and print differences
async function printStorageDiff(api, blockHashA, blockHashB) {
  // Get storage values for both blocks
  const [storageAtBlockA, storageAtBlockB] = await Promise.all([
    getStorageForBlock(api, blockHashA),
    getStorageForBlock(api, blockHashB),
  ]);

  console.log(
    `Comparing storage at Block ${blockHashA} and Block ${blockHashB}...`,
  );

  // Compare the storage between the two blocks
  storageAtBlockA.forEach((itemA) => {
    const matchingItem = storageAtBlockB.find(
      (itemB) =>
        itemA.module === itemB.module &&
        itemA.storageItem === itemB.storageItem,
    );

    if (matchingItem && itemA.value !== matchingItem.value) {
      console.log(`Difference found in ${itemA.module}::${itemA.storageItem}`);
      console.log(`  Block A: ${itemA.value}`);
      console.log(`  Block B: ${matchingItem.value}`);
    }
  });
}

// Subscribe to new blocks and compare their storage with the previous block
// @ts-ignore
async function subscribeToNewBlocks(api) {
  let lastBlockHash: null = null;
  let num = 0;
  // Subscribe to new finalized blocks
  // @ts-ignore
  const unsubscribe = await api.rpc.chain.subscribeFinalizedHeads(
    // @ts-ignore
    async (header) => {
      num++;
      const newBlockHash = header.hash;

      if (lastBlockHash) {
        console.log(`New Block ${header.number}: ${newBlockHash}`);

        // Compare storage between the last block and the new block
        await printStorageDiff(api, lastBlockHash, newBlockHash);
        console.log(`DoneHERE: ${newBlockHash}`);
      } else {
        console.log(`First block detected: ${newBlockHash}`);
      }
      // Set current block as the last block for the next comparison
      lastBlockHash = newBlockHash;
      if (num > 2) {
        unsubscribe();
      }
    },
  );
  return unsubscribe;
}

// Main function to connect to the Polkadot node and subscribe to block events
async function main() {
  await setupApi();
  await getApi();
  const api = getApi();
  // Subscribe to new finalized blocks and compare storage
  await subscribeToNewBlocks(api);

  // Keep the connection alive
}

main().catch(console.error);
