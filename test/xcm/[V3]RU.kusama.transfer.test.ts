import { connectVertical } from "@acala-network/chopsticks";
import { KeyringPair } from "@polkadot/keyring/types";
import { balance } from "../../utils/Assets";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { devTestingPairs, setupApi, setupUsers } from "../../utils/setup";
import { mangataChopstick } from "../../utils/api";
import {
  expectEvent,
  expectExtrinsicSuccess,
  expectJson,
  matchEvents,
} from "../../utils/validators";
import { BN_BILLION, Mangata } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";
import { Codec } from "@polkadot/types/types";

/**
 * @group xcm
 * @group proxied
 */
describe("XCM tests for Mangata <-> Kusama", () => {
  let kusama: ApiContext;
  let mangata: ApiContext;
  let alice: KeyringPair;

  beforeAll(async () => {
    await setupApi();
    await setupUsers();
    kusama = await XcmNetworks.kusama();
    mangata = mangataChopstick!;
    await connectVertical(kusama.chain, mangata.chain);
    alice = devTestingPairs().alice;
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[alice.address, { token: 4 }], { free: 10 * 1e12 }],
          [
            [alice.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
        ],
      },
      Sudo: {
        Key: alice.address,
      },
    });
    // await upgradeMangata(mangata);
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[alice.address, { token: 4 }], { free: 10 * 1e12 }],
          [
            [alice.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
        ],
      },
      Sudo: {
        Key: alice.address,
      },
    });
    await kusama.dev.setStorage({
      System: {
        Account: [
          [[alice.address], { providers: 1, data: { free: 10 * 1e12 } }],
        ],
      },
    });
  });

  it("mangata transfer assets to kusama", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.withdrawKsm({
      account: alice,
      amount: new BN(1e12),
      kusamaAddress: alice.address,
      txOptions: {
        async extrinsicStatus(events) {
          expectExtrinsicSuccess(events as any[] as Codec[]);
          expectEvent(events as any[] as Codec[], {
            event: expect.objectContaining({
              section: "xTokens",
              method: "TransferredMultiAssets",
            }),
          });
        },
      },
    });
    await mangata.chain.newBlock();

    await kusama.chain.newBlock();
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 4),
    ).toMatchSnapshot();

    expect(await balance(kusama.api, alice.address)).toMatchSnapshot();
    expectEvent(await kusama.api.query.system.events(), {
      event: expect.objectContaining({
        method: "Processed",
        section: "messageQueue",
        data: {
          id: "0xb31883a9f5588fc609fb29ff960cd525ba8dd2846ed40c34418256a591b1d13c",
          origin: {
            Ump: {
              Para: "2,110",
            },
          },
          success: true,
          weightUsed: expect.anything(),
        },
      }),
    });
  });

  it("Kusama transfer assets to mangata", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.depositFromKusama({
      account: alice,
      url: kusama.uri,
      assets: {
        V3: [
          {
            id: { Concrete: { parents: 0, interior: "Here" } },
            fun: { Fungible: 1e12 },
          },
        ],
      },
      beneficiary: {
        V3: {
          parents: 0,
          interior: {
            X1: {
              AccountId32: {
                network: undefined,
                id: alice.addressRaw,
              },
            },
          },
        },
      },
      destination: {
        V3: {
          parents: 0,
          interior: {
            X1: { Parachain: 2110 },
          },
        },
      },
      feeAssetItem: 0,
      weightLimit: "Unlimited",
      txOptions: {
        async extrinsicStatus(events) {
          await matchEvents(events as any as Codec[], "xcmPallet");
        },
      },
    });

    await kusama.chain.newBlock();

    expect(await balance(kusama.api, alice.address)).toMatchSnapshot();
    //TODO: Somehow I can not get the events from the dcmp.
    //    const hashBef = await mangata.api.rpc.chain.getBlockHash(
    //      await getBlockNumber()
    //    );
    await mangata.chain.newBlock();
    // Lets validate balances. Should be enough I guess.
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 4),
    ).toMatchSnapshot();

    //    const hashAft = await mangata.api.rpc.chain.getBlockHash(
    //      await getBlockNumber()
    //    );
    //    await sleep(3000);
    //    const events1 = await (
    //      await mangata.api.at(hashBef.toString())
    //    ).query.system.events();
    //
    //    const events2 = await (
    //      await mangata.api.at(hashAft.toString())
    //    ).query.system.events();
    //
    //    const events3 = await mangata.api.query.system.events();
    //    await sleep(10000000);
    //
    //    await matchSystemEventsAt(
    //      mangata,
    //      hashBef.toString(),
    //      "parachainSystem",
    //      "dmpQueue"
    //    );
  });
});
