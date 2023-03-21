import { connectVertical } from "@acala-network/chopsticks";
import { KeyringPair } from "@polkadot/keyring/types";
import { BN_THOUSAND } from "@polkadot/util";
import { balance } from "../../utils/Assets";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { devTestingPairs } from "../../utils/setup";
import { sendTransaction } from "../../utils/sign";
import {
  expectEvent,
  expectExtrinsicSuccess,
  expectJson,
  matchEvents,
  matchSystemEvents,
} from "../../utils/validators";

/**
 * @group xcm
 * @group proxied
 */
describe("XCM tests for Mangata <-> Kusama", () => {
  let kusama: ApiContext;
  let mangata: ApiContext;
  let alice: KeyringPair;

  beforeAll(async () => {
    kusama = await XcmNetworks.kusama();
    mangata = await XcmNetworks.mangata();
    await connectVertical(kusama.chain, mangata.chain);
    alice = devTestingPairs().alice;
  });

  afterAll(async () => {
    await kusama.teardown();
    await mangata.teardown();
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[alice.address, { token: 4 }], { free: 10 * 1e12 }],
          [
            [alice.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
        ],
      },
      Sudo: {
        Key: alice.address,
      },
    });
    await kusama.dev.setStorage({
      System: {
        Account: [[[alice.address], { data: { free: 10 * 1e12 } }]],
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
            V1: {
              parents: 1,
              interior: {
                X1: {
                  AccountId32: {
                    network: "Any",
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
    expectJson(await mangata.api.query.tokens.accounts(alice.address, 4))
      .toMatchInlineSnapshot(`
          {
            "free": 9000000000000,
            "frozen": 0,
            "reserved": 0,
          }
        `);

    expect(await balance(kusama.api, alice.address)).toMatchInlineSnapshot(`
      {
        "feeFrozen": 0,
        "free": 10999895428355,
        "miscFrozen": 0,
        "reserved": 0,
      }
    `);

    expectEvent(await kusama.api.query.system.events(), {
      event: expect.objectContaining({
        method: "ExecutedUpward",
        section: "ump",
        data: [
          "0x42669dcaba8e3857f2c30c983ca7dd5de3d728cba346a307ca444e1fd1d9e473",
          {
            Complete: expect.anything(),
          },
        ],
      }),
    });
  });

  it("Kusama transfer assets to mangata", async () => {
    const tx = await sendTransaction(
      kusama.api.tx.xcmPallet
        .limitedReserveTransferAssets(
          {
            V1: {
              parents: 0,
              interior: {
                X1: { Parachain: 2110 },
              },
            },
          },
          {
            V1: {
              parents: 0,
              interior: {
                X1: {
                  AccountId32: {
                    id: alice.addressRaw,
                  },
                },
              },
            },
          },
          {
            V1: [
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

    expect(await balance(kusama.api, alice.address)).toMatchInlineSnapshot(`
      {
        "feeFrozen": 0,
        "free": 8999371447895,
        "miscFrozen": 0,
        "reserved": 0,
      }
    `);

    await mangata.chain.newBlock();

    expectJson(await mangata.api.query.tokens.accounts(alice.address, 4))
      .toMatchInlineSnapshot(`
      {
        "free": 10999472300000,
        "frozen": 0,
        "reserved": 0,
      }
    `);

    await matchSystemEvents(mangata, "parachainSystem", "dmpQueue");
  });
});
