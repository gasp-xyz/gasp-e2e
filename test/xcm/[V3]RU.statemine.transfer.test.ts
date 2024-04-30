import { connectParachains } from "@acala-network/chopsticks";
import { KeyringPair } from "@polkadot/keyring/types";
import { BN_THOUSAND, BN } from "@polkadot/util";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext, upgradeMangata } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { devTestingPairs, setupApi, setupUsers } from "../../utils/setup";
import {
  expectExtrinsicSuccess,
  expectJson,
  matchSystemEvents,
} from "../../utils/validators";
import { mangataChopstick } from "../../utils/api";
import { BN_BILLION, Mangata } from "@mangata-finance/sdk";
import { Codec } from "@polkadot/types/types";
import { expectEvent, matchEvents } from "../../utils/eventListeners";

/**
 * @group xcm
 * @group proxied
 */
describe("XCM tests for Mangata <-> Statemine", () => {
  let statemine: ApiContext;
  let mangata: ApiContext;
  let alice: KeyringPair;

  beforeAll(async () => {
    await setupApi();
    await setupUsers();
    statemine = await XcmNetworks.statemine();
    mangata = mangataChopstick!;
    await connectParachains([statemine.chain, mangata.chain]);
    alice = devTestingPairs().alice;
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[alice.address, { token: 30 }], { free: 1000e6 }],
          [[alice.address, { token: 31 }], { free: 1000e10 }],
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
    await upgradeMangata(mangata);
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[alice.address, { token: 30 }], { free: 1000e6 }],
          [[alice.address, { token: 31 }], { free: 1000e10 }],
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
    await statemine.dev.setStorage({
      System: {
        Account: [[[alice.address], { providers: 1, data: { free: 10e12 } }]],
      },
      Assets: {
        Account: [
          [[1984, alice.address], { balance: 1000e6 }],
          [[8, alice.address], { balance: 1000e10 }],
        ],
      },
    });
  });

  it("mangata transfer assets to statemine", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.withdraw({
      account: alice,
      amount: new BN(10e6),
      destinationAddress: alice.address,
      parachainId: 1000,
      tokenSymbol: "USDT",
      withWeight: "Unlimited",
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

    await statemine.chain.newBlock();
    await statemine.chain.newBlock();
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 30),
    ).toMatchSnapshot();
    expect(
      await statemine.api.query.assets.account(1984, alice.address),
    ).toMatchSnapshot();

    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });

  it("statemine transfer assets to mangata", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.depositFromStatemine({
      account: alice,
      assets: {
        V3: [
          {
            id: {
              Concrete: {
                parents: 0,
                interior: {
                  X2: [{ PalletInstance: 50 }, { GeneralIndex: 1984 }],
                },
              },
            },
            fun: { Fungible: 10e6 },
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
          parents: 1,
          interior: {
            X1: { Parachain: 2110 },
          },
        },
      },
      feeAssetItem: 0,
      url: statemine.uri,
      weightLimit: "Unlimited",
      txOptions: {
        async extrinsicStatus(events) {
          await matchEvents(events as any as Codec[], "polkadotXcm");
        },
      },
    });

    /**
    const tx = await sendTransaction(
      statemine.api.tx.polkadotXcm
        .limitedReserveTransferAssets(
          {
            V3: {
              parents: 1,
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
                id: {
                  Concrete: {
                    parents: 0,
                    interior: {
                      X2: [{ PalletInstance: 50 }, { GeneralIndex: 1984 }],
                    },
                  },
                },
                fun: { Fungible: 10e6 },
              },
            ],
          },
          0,
          "Unlimited"
        )
        .signAsync(alice, { nonce: 0 })
    );
     */
    await statemine.chain.newBlock();

    //  await matchEvents(tx.events, "polkadotXcm");

    expect(
      await statemine.api.query.assets.account(1984, alice.address),
    ).toMatchSnapshot();

    await mangata.chain.newBlock();

    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 30),
    ).toMatchSnapshot();

    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });
  it("[RMRK] mangata transfer assets to statemine", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.withdraw({
      account: alice,
      amount: new BN(10e10),
      destinationAddress: alice.address,
      parachainId: 1000,
      tokenSymbol: "RMRK",
      withWeight: "Unlimited",
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

    await statemine.chain.newBlock();
    await statemine.chain.newBlock();
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 31),
    ).toMatchSnapshot();

    expect(
      await statemine.api.query.assets.account(8, alice.address),
    ).toMatchSnapshot();

    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });

  it("[RMRK] statemine transfer assets to mangata", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.depositFromStatemine({
      account: alice,
      assets: {
        V3: [
          {
            id: {
              Concrete: {
                parents: 0,
                interior: {
                  X2: [{ PalletInstance: 50 }, { GeneralIndex: 8 }],
                },
              },
            },
            fun: { Fungible: 10e10 },
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
          parents: 1,
          interior: {
            X1: { Parachain: 2110 },
          },
        },
      },
      feeAssetItem: 0,
      url: statemine.uri,
      weightLimit: "Unlimited",
      txOptions: {
        async extrinsicStatus(events) {
          await matchEvents(events as any as Codec[], "polkadotXcm");
        },
      },
    });
    await statemine.chain.newBlock();
    await statemine.chain.newBlock();
    expect(
      await statemine.api.query.assets.account(8, alice.address),
    ).toMatchSnapshot();

    await mangata.chain.newBlock();

    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 31),
    ).toMatchSnapshot();

    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });
});
