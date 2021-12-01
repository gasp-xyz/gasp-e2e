import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { User } from "../utils/User";
import { Mangata } from "mangata-sdk";
import { each } from "lodash";
import { error } from "console";

require("dotenv").config();

process.env.NODE_ENV = "test";
const uris = [
  "ws://127.0.0.1:9944",
  //    'ws://172.28.1.1:9944',
];

const ipRegex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/gm;

//this constant will skip some traces.
const onlyrelevant = true;
// this will handle if printing in pretty-multilines.
const pretty = false;

async function main() {
  const promises = [];
  let count = 0;
  const uri = uris[0];
  const mangata = Mangata.getInstance(uri);
  const api = await mangata.getApi();
  const keyring = new Keyring({ type: "sr25519" });
  const alice = new User(keyring, "//Alice");
  const bob = new User(keyring, "//Bob");
  keyring.addPair(bob.keyRingPair);
  keyring.addPair(alice.keyRingPair);

  while (true) {
    count++;
    if (count % 2 === 0) {
      mangata
        .transferToken(
          alice.keyRingPair,
          "0",
          bob.keyRingPair.address,
          new BN(count)
        )
        .then((x) =>
          x.forEach((event) => {
            console.log(`${event.section} - ${event.method} Count: ${count}`);
          })
        )
        .catch((error) => console.error("ooh oh" + error));
    } else {
      mangata
        .transferToken(
          bob.keyRingPair,
          "0",
          alice.keyRingPair.address,
          new BN(count)
        )
        .then((x) =>
          x.forEach((event) => {
            console.log(`${event.section} - ${event.method} Count: ${count}`);
          })
        )
        .catch((error) => console.error("ooh oh" + error));
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });
  }
}

main().catch((error) => {
  console.error("Error:" + error);
  process.exit(-1);
});
