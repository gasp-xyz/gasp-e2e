/* eslint-disable no-console */
//README:
//Configure uris constant.
//Build And Run!
// npx ts-node test/exploratory/eventListener.ts

import BN from "bn.js";
import { ApiPromise } from "@polkadot/api";
//import { KeyringPair } from "@polkadot/keyring/types";
import { WsProvider } from "@polkadot/rpc-provider/ws";
//import { Mangata } from "mangata-sdk";
import type { DefinitionRpc, DefinitionRpcSub } from "@polkadot/types/types";
const { testLog } = require("./../utils/Logger");

//this constant will skip some traces.
// this will handle if printing in pretty-multilines.

async function main() {
  const users = [
    "5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY",
    "5FfBQ3kwXrbdyoqLPvcXRp7ikWydXawpNs2Ceu3WwFdhZ8W4",
  ];
  const provider = new WsProvider("ws://10.0.0.6:9944");
  const rpcOptions: Record<
    string,
    Record<string, DefinitionRpc | DefinitionRpcSub>
  > = {
    xyk: {
      calculate_rewards_amount: {
        description: "",
        params: [
          {
            name: "user",
            type: "AccountId",
          },
          {
            name: "liquidity_asset_id",
            type: "u32",
          },
        ],
        type: "RpcResult<Balance>",
      },
    },
  };
  const api = await new ApiPromise({
    provider,
    rpc: rpcOptions,
  }).isReady;
  await api.connect();
  const asd = await api.isConnected;
  //const mangata = Mangata.getInstance("ws://10.0.0.6:9944");
  //const api = await mangata.getApi();
  console.log(asd);
  users.forEach((user) => {
    (api.rpc as any).xyk
      .calculate_rewards_amount(user, new BN(5))
      .then((result: any) => {
        console.info(`${Date.now}` + (result as any).toString());
      });
  });
}

main().catch((error) => {
  testLog.getLog().error(error);
  process.exit(-1);
});
