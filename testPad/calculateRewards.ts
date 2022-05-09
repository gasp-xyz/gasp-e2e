/* eslint-disable no-console */
import { options } from "@mangata-finance/types";
import BN from "bn.js";
import fs from "fs";
import { ApiPromise } from "@polkadot/api";
import { WsProvider } from "@polkadot/rpc-provider/ws";
import { testLog } from "../utils/Logger";

async function main() {
  const users = [
    "5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY",
    "5FfBQ3kwXrbdyoqLPvcXRp7ikWydXawpNs2Ceu3WwFdhZ8W4",
    "5FRL15Qj6DdoULKswCz7zevqe97bnHuEix794pTeGK7MhfDS",
    "5H6YCgW24Z8xJDvxytQnKTwgiJGgye3uqvfQTprBEYqhNbBy",
  ];
  const liq = process.env.liq ? process.env.liq : 5;
  const liqId = new BN(liq);
  const provider = new WsProvider("ws://10.0.0.6:9944");
  const api = await new ApiPromise(options({ provider })).isReady;
  await api.rpc.chain.subscribeNewHeads((header) => {
    api.query.xyk.liquidityMiningActiveUser.entries().then((value) => {
      value.forEach((value) => {
        console.log(`${value[0].toHuman()} - ${value[1].toHuman()}`);
      });
    });
    api.query.issuance.promotedPoolsRewards.entries().then((value) => {
      value.forEach((value) => {
        console.log(`${value[0].toHuman()} - ${value[1].toHuman()}`);
      });
    });

    users.forEach((user) => {
      (api.rpc as any).xyk
        .calculate_rewards_amount(user, liqId)
        .then((result: any) => {
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
          fs.appendFile(`${liqId}_${user}.txt`, plott, function (err) {
            if (err) throw err;
            console.log(str);
          });
        });
    });
  });
  //await api.disconnect();
}

main().catch((error) => {
  testLog.getLog().error(error);
  process.exit(-1);
});
