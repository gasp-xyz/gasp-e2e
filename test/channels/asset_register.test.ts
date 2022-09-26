import { api, initApi } from "../../utils/api";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { AcalaNode } from "../../utils/Framework/Node/AcalaNode";
import { Utils } from "./Utils";
import { testLog } from "../../utils/Logger";
import { BN } from "bn.js";
import { Assets } from "../../utils/Assets";

const { acalaUri } = getEnvironmentRequiredVars();
jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());

let alice: User;
let acala: AcalaNode;

beforeAll(async () => {
  await initApi();
  acala = new AcalaNode(acalaUri);
  await acala.connect();

  const keyring = new Keyring({ type: "sr25519" });
  alice = new User(keyring, "//Alice");
});

test("asset register - register MGR on Acala", async () => {
  const tx = acala.api!.tx.assetRegistry.registerForeignAsset(
    Utils.assetLocation(2110, "0x00000000"),
    {
      name: "mangata",
      symbol: "MGR",
      decimals: 18,
      minimalBalance: Utils.amount(10, 18),
    }
  );
  await Utils.signAndSend(alice, acala.api!.tx.sudo.sudo(tx));
});

test.skip("asset register - register LKSM on Mangata", async () => {
  //@ts-ignore
  const tx = api!.tx.assetRegistry.registerAsset(
    Utils.assetLocation(2000, "0x0083")
    //    {
    //      decimals: 12,
    //      name: "liquid kusama",
    //      symbol: "LKSM",
    //      existentialDeposit: Utils.amount(10, 9), // 1000MGX
    //      location: Utils.assetLocation(2000, "0x0083"),
    //    },
    //    null
  );
  await Utils.signAndSend(alice, api!.tx.sudo.sudo(tx));
});

test("register LKSM", async () => {
  const tx = api!.tx.assetRegistry.registerAsset(
    {
      decimals: 12,
      name: "KAR- 0x0083",
      symbol: "LKSM",
      existentialDeposit: 0,
      location: {
        V1: {
          parents: 1,
          interior: {
            X2: [
              {
                Parachain: 2000,
              },
              {
                GeneralKey: "0x0080",
              },
            ],
          },
        },
      },
    },
    8
  );

  await Utils.signAndSend(alice, api!.tx.sudo.sudo(tx));
});
test("register incorrect", async () => {
  const tx = api!.tx.assetRegistry.registerAsset(
    {
      decimals: 12,
      name: "KAR- 0x0083",
      symbol: "LKSM",
      existentialDeposit: 0,
      location: {
        V1: {
          parents: 1,
          interior: {
            X3: [
              {
                Parachain: 2000,
              },
              {
                GeneralKey: "0x00080",
              },
              {
                PalletInstance: 50,
              },
            ],
          },
        },
      },
    },
    8
  );

  await Utils.signAndSend(alice, api!.tx.sudo.sudo(tx));
});

test("get 2000, 0x0080", async () => {
  const asset = await api!.query.assetRegistry.locationToAssetId({
    parents: 1,
    interior: {
      X2: [
        {
          Parachain: 2000,
        },
        {
          GeneralKey: "0x0080",
        },
      ],
    },
  });
  testLog.getLog().warn(asset.toHuman());

  const asset2 = await api!.query.assetRegistry.locationToAssetId({
    parents: 1,
    interior: {
      X2: [
        {
          Parachain: 2000,
        },
        {
          GeneralKey: "0x00080",
        },
        {
          PalletInstance: 50,
        },
      ],
    },
  });
  testLog.getLog().warn(asset2.toHuman());
});

test("reproduceBug", async () => {
  const generatedAsset = true;
  if (!generatedAsset) {
    const tx = api!.tx.assetRegistry.registerAsset(
      {
        decimals: 12,
        name: "KAR- 0x0083",
        symbol: "LKSM",
        existentialDeposit: 0,
        location: {
          V1: {
            parents: 1,
            interior: {
              X3: [
                {
                  Parachain: 2000,
                },
                {
                  GeneralKey: "0x00080",
                },
                {
                  PalletInstance: 50,
                },
              ],
            },
          },
        },
      },
      8
    );
    await Utils.signAndSend(alice, api!.tx.sudo.sudo(tx));
  }
  const asset = await api!.query.assetRegistry.locationToAssetId({
    parents: 1,
    interior: {
      X2: [
        {
          Parachain: 2000,
        },
        {
          GeneralKey: "0x0080",
        },
      ],
    },
  });
  testLog.getLog().warn(asset.toHuman());

  const asset2 = await api!.query.assetRegistry.locationToAssetId({
    parents: 1,
    interior: {
      X3: [
        {
          Parachain: 2000,
        },
        {
          GeneralKey: "0x00080",
        },
        {
          PalletInstance: 50,
        },
      ],
    },
  });
  testLog.getLog().warn(asset2.toHuman());
  expect(new BN(asset.toString())).bnEqual(new BN(6));
  expect(new BN(asset2.toString())).bnEqual(new BN(8));
});

test("fromX3 to X2 bug", async () => {
  const generatedAsset = false;
  const tokenId = (
    await Assets.setupUserWithCurrencies(alice, undefined, alice)
  )[0];
  if (!generatedAsset) {
    const tx = api!.tx.assetRegistry.registerAsset(
      {
        decimals: 12,
        name: "KAR- 0x00832",
        symbol: "LKSM2",
        existentialDeposit: 0,
        location: {
          V1: {
            parents: 1,
            interior: {
              X3: [
                {
                  Parachain: 3210,
                },
                {
                  GeneralKey: "0x00834",
                },
                {
                  PalletInstance: 10,
                },
              ],
            },
          },
        },
      },
      tokenId
    );
    await Utils.signAndSend(alice, api!.tx.sudo.sudo(tx));
  }
  const assetBef = await (
    await api!.query.assetRegistry.locationToAssetId.entries()
  )
    .map((element) => [element[0].toHuman(), element[1].toHuman()])
    .filter((x) => x[1] === tokenId.toString());

  const tx = api!.tx.assetRegistry.updateAsset(
    tokenId,
    12,
    "KAR- 0x00832",
    "LKSM2",
    0,
    {
      V1: {
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: 3210,
            },
            {
              GeneralKey: "0x00834",
            },
          ],
        },
      },
    },
    null
  );
  await Utils.signAndSend(alice, api!.tx.sudo.sudo(tx));

  const assetAfter = await (
    await api!.query.assetRegistry.locationToAssetId.entries()
  )
    .map((element) => [element[0].toHuman(), element[1].toHuman()])
    .filter((x) => x[1] === tokenId.toString());

  testLog.getLog().warn(JSON.stringify(assetBef));
  testLog.getLog().warn(JSON.stringify(assetAfter));
});
