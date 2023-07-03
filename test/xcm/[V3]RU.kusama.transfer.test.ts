import { connectVertical } from "@acala-network/chopsticks";
import { KeyringPair } from "@polkadot/keyring/types";
import { balance } from "../../utils/Assets";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { devTestingPairs, setupApi, setupUsers } from "../../utils/setup";
import { sendTransaction } from "../../utils/sign";
import { mangataChopstick } from "../../utils/api";
import {
  expectEvent,
  expectExtrinsicSuccess,
  expectJson,
  matchEvents,
} from "../../utils/validators";
import { BN_BILLION } from "@mangata-finance/sdk";
import { testLog } from "../../utils/Logger";

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
    const tx = await sendTransaction(
      mangata.api.tx.xTokens
        .transfer(
          4,
          1e12,
          {
            V3: {
              parents: 1,
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
          "Unlimited"
        )
        .signAsync(alice)
    );

    await mangata.chain.newBlock();

    expectExtrinsicSuccess(await tx.events);
    expectEvent(await tx.events, {
      event: expect.objectContaining({
        section: "xTokens",
        method: "TransferredMultiAssets",
      }),
    });

    await kusama.chain.newBlock();
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 4)
    ).toMatchSnapshot();

    expect(await balance(kusama.api, alice.address)).toMatchSnapshot();
    testLog.getLog().info("sleeping");
    expectEvent(await kusama.api.query.system.events(), {
      event: expect.objectContaining({
        method: "Processed",
        section: "messageQueue",
        data: {
          id: "0xf1480be6240549d36471d3e41c5a784a2976f75b99e1b0329f271d43987eca6f",
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
    const tx = await sendTransaction(
      kusama.api.tx.xcmPallet
        .limitedReserveTransferAssets(
          {
            V3: {
              parents: 0,
              interior: {
                X1: { Parachain: 2110 },
              },
            },
          },
          {
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
          {
            V3: [
              {
                id: { Concrete: { parents: 0, interior: "Here" } },
                fun: { Fungible: 1e12 },
              },
            ],
          },
          0,
          "Unlimited"
        )
        .signAsync(alice, { nonce: 0 })
    );

    await kusama.chain.newBlock();

    await matchEvents(tx.events, "xcmPallet");

    expect(await balance(kusama.api, alice.address)).toMatchSnapshot();
    //TODO: Somehow I can not get the events from the dcmp.
    //    const hashBef = await mangata.api.rpc.chain.getBlockHash(
    //      await getBlockNumber()
    //    );
    await mangata.chain.newBlock();
    // Lets validate balances. Should be enough I guess.
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 4)
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
