import { initApi } from "../../utils/api";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { User } from "../../utils/User";
import { ApiPromise, Keyring } from "@polkadot/api";
import { AcalaNode } from "../../utils/Framework/Node/AcalaNode";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { beforeAll, test } from "vitest";

const { sudo: sudoUserName, acalaUri } = getEnvironmentRequiredVars();

let sudo: User;
let acala: AcalaNode;

beforeAll(async () => {
  await initApi();
  acala = new AcalaNode(acalaUri);
  await acala.connect();

  const keyring = new Keyring({ type: "sr25519" });
  sudo = new User(keyring, sudoUserName);
});

test("channels - open channel to karura", async () => {
  console.log(acalaUri);
  const openChannelEncoded = "0x1700d0070000e803000000900100";
  const api = acala.api!;
  const t = await api.query.timestamp.now();
  console.log(t);
  await api.tx.sudo.sudo(sendAsSovereign(api, openChannelEncoded)).signAndSend(
    sudo.keyRingPair,
    {
      nonce: 123,
    },
    async (result) => {
      console.log(result);
    }
  );
});

function sendAsSovereign(
  api: ApiPromise,
  encoded: string
): SubmittableExtrinsic<any> {
  return api.tx.ormlXcm.sendAsSovereign(
    { V1: { parents: 1, interior: "Here" } },
    {
      V2: [
        {
          WithdrawAsset: [
            {
              id: { Concrete: { parents: 0, interior: "Here" } },
              fun: { Fungible: 1_000_000_000_000 },
            },
          ],
        },
        {
          BuyExecution: {
            fees: {
              id: { Concrete: { parents: 0, interior: "Here" } },
              fun: { Fungible: 1_000_000_000_000 },
            },
            weightLimit: "Unlimited",
          },
        },
        {
          Transact: {
            originType: "Native",
            requireWeightAtMost: 5_000_000_000,
            call: {
              encoded: encoded,
            },
          },
        },
        {
          DepositAsset: {
            assets: {
              Wild: "All",
            },
            maxAssets: 1,
            beneficiary: {
              parents: 0,
              interior: {
                X1: {
                  Parachain: 2000,
                },
              },
            },
          },
        },
      ],
    }
  );
}
