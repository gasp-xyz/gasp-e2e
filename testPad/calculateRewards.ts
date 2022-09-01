/* eslint-disable no-console */
import BN from "bn.js";
import fs from "fs";
import { testLog } from "../utils/Logger";
import { getMangataInstance } from "../utils/api";

async function main() {
  const users = [
    "5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY",
    "5FfBQ3kwXrbdyoqLPvcXRp7ikWydXawpNs2Ceu3WwFdhZ8W4",
    "5FRL15Qj6DdoULKswCz7zevqe97bnHuEix794pTeGK7MhfDS",
    "5H6YCgW24Z8xJDvxytQnKTwgiJGgye3uqvfQTprBEYqhNbBy",
  ];
  const liq = process.env.liq ? process.env.liq : 16;
  const liqId = new BN(liq);
  const mangata = await getMangataInstance("ws://127.0.0.1:8844");
  // const provider = new WsProvider("ws://127.0.0.1:8844");
  //const api = await new ApiPromise(options({ provider })).isReady;
  const api = await mangata.getApi();
  await api.rpc.chain.subscribeNewHeads((header) => {
    api.query.xyk.rewardsInfo.entries().then((value) => {
      value.forEach((value) => {
        console.log(`${value[0].toHuman()} - ${value[1].toHuman()}`);
      });
    });
    api.query.issuance.promotedPoolsRewardsV2.entries().then((value) => {
      value.forEach((value) => {
        console.log(`${value[0].toHuman()} - ${value[1].toHuman()}`);
      });
    });
    users.forEach((user) => {
      mangata
        .calculateRewardsAmountV2(user, liqId.toString())
        .then((result: any) => {
          console.log("foo: " + liq + "-" + JSON.stringify(result));
          if (result.toString() !== "0") {
            const str = `${user}:${header.number}:${(
              result as any
            ).notYetClaimed.toString()}:${(
              result as any
            ).toBeClaimed.toString()}`;

            const plott = `${header.number},${(
              result as any
            ).notYetClaimed.toString()},${(
              result as any
            ).toBeClaimed.toString()} \n`;

            fs.appendFile(
              `/home/goncer/projects/${liqId}_${user}.txt`,
              plott,
              function (err) {
                if (err) throw err;
                console.log("ohoh" + err + str);
              }
            );
          }
        });
    });
  });
  //await api.disconnect();
}

main().catch((error) => {
  testLog.getLog().error(error);
  process.exit(-1);
});
