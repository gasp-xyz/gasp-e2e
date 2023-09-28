import {
  BuildBlockMode,
  connectParachains,
  connectVertical,
} from "@acala-network/chopsticks";
import { BN_BILLION, BN_HUNDRED, Mangata, signTx } from "@mangata-finance/sdk";
import { BN_FIVE, BN_TEN, BN } from "@polkadot/util";
import { mangataChopstick } from "../../utils/api";
import {
  AssetId,
  ChainId,
  ChainSpecs,
  TRANSFER_INSTRUCTIONS,
} from "../../utils/ChainSpecs";
import { waitForEvents } from "../../utils/eventListeners";
import { XcmNode } from "../../utils/Framework/Node/XcmNode";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, api, eve, setupApi, setupUsers } from "../../utils/setup";
import { expectEvent, expectJson } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { User } from "../../utils/User";
import { KSM_ASSET_ID } from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";
import { testLog } from "../../utils/Logger";
/**
 * @group xcm
 * @group bifrost
 */
describe("XCM transfers", () => {
  let bifrost: ApiContext;
  let mangata: ApiContext;
  let kusama: ApiContext;
  let bifrostApi: XcmNode;

  beforeAll(async () => {
    bifrost = await XcmNetworks.biforst({
      buildBlockMode: BuildBlockMode.Instant,
    });
    await setupApi();
    mangata = mangataChopstick!;
    kusama = await XcmNetworks.kusama();
    await connectVertical(kusama.chain, bifrost.chain);
    await connectVertical(kusama.chain, mangata.chain);
    await connectParachains([bifrost.chain, mangata.chain]);

    bifrostApi = new XcmNode(bifrost.api, ChainId.Bifrost);
    setupUsers();
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Sudo: {
        Key: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      },
      Tokens: {
        Accounts: [
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: BN_BILLION.mul(AssetId.Mgx.unit).toString() },
          ],
          [
            [alice.keyRingPair.address, { token: 14 }],
            { free: BN_BILLION.mul(AssetId.BncV3.unit).toString() },
          ],
          [
            [alice.keyRingPair.address, { token: 4 }],
            { free: BN_BILLION.mul(AssetId.Mgx.unit).toString() },
          ],
        ],
      },
    });
    await bifrost.dev.setStorage({
      System: {
        Account: [
          [
            [alice.keyRingPair.address],
            { data: { free: BN_HUNDRED.mul(AssetId.BncV3.unit).toString() } },
          ],
        ],
      },
      Tokens: {
        Accounts: [
          [
            [alice.keyRingPair.address, { token: "ZLK" }],
            { free: BN_BILLION.mul(AssetId.Mgx.unit).toString() },
          ],
          [
            [alice.keyRingPair.address, { VToken: "ksm" }],
            { free: BN_BILLION.mul(BN_TEN.pow(new BN(12))).toString() },
          ],
          [
            [alice.keyRingPair.address, { VToken: "BNC" }],
            { free: BN_BILLION.mul(AssetId.BncV3.unit).toString() },
          ],
          [
            [alice.keyRingPair.address, { VSToken: "ksm" }],
            { free: BN_BILLION.mul(BN_TEN.pow(new BN(12))).toString() },
          ],
          [
            [alice.keyRingPair.address, { Token: "KSM" }],
            { free: BN_BILLION.mul(BN_TEN.pow(new BN(12))).toString() },
          ],
        ],
      },
    });
    await kusama.dev.setStorage({
      System: {
        Account: [
          [
            [eve.keyRingPair.address],
            { providers: 1, data: { free: 1000 * 1e12 } },
          ],
        ],
      },
    });
    // await upgradeMangata(mangata);

    //TODO: Remove when clarified how to setup tokens on Bifrost.
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.withdraw({
      account: alice.keyRingPair,
      amount: AssetId.Bnc.unit.mul(BN_TEN.add(BN_TEN)),
      destinationAddress: alice.keyRingPair.address,
      parachainId: 2001,
      tokenSymbol: "BNC",
      withWeight:
        TRANSFER_INSTRUCTIONS * ChainSpecs.get(ChainId.Bifrost)!.unitCostWeight,
    });
    await bifrost.chain.newBlock();
    //END-TODO
    await giveKSMTokensToBifrost(eve);
  });
  it("[ BNC V3 -> MGA -> BNC V3 ] send BNC to mangata and back", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    const target = ChainSpecs.get(ChainId.Mg)!;
    const asset = bifrostApi.chain.assets.get(AssetId.ImbueBncV3)!;
    await mgaSdk.xTokens.depositFromParachain({
      account: alice.keyRingPair,
      asset: {
        V3: {
          id: {
            Concrete: asset.location,
          },
          fun: {
            Fungible: AssetId.ImbueBncV3.unit.mul(BN_TEN),
          },
        },
      },
      destination: {
        V3: {
          parents: 1,
          interior: {
            X2: [
              { Parachain: target.parachain },
              {
                AccountId32: {
                  network: undefined,
                  id: alice.keyRingPair.addressRaw,
                },
              },
            ],
          },
        },
      },
      url: bifrost.uri,
      weightLimit: {
        Limited: {
          refTime: TRANSFER_INSTRUCTIONS * target.unitCostWeight,
          proofSize: 0,
        },
      },
    });

    //     const op = bifrostApi.xTokenTransferV3(
    //       ChainId.Mg,
    //       AssetId.ImbueBncV3,
    //       AssetId.ImbueBncV3.unit.mul(BN_TEN),
    //       alice
    //     );
    //     await signSendSuccess(bifrost.api, op, alice);

    await waitForEvents(api, "xcmpQueue.Success");

    expectEvent(await waitForEvents(api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z",
          amount: "25,804,800,000",
        }),
      }),
    });
    await mgaSdk.xTokens.withdraw({
      account: alice.keyRingPair,
      amount: AssetId.Bnc.unit.mul(BN_FIVE),
      destinationAddress: alice.keyRingPair.address,
      parachainId: 2001,
      tokenSymbol: "BNC",
      withWeight:
        TRANSFER_INSTRUCTIONS * ChainSpecs.get(ChainId.Bifrost)!.unitCostWeight,
    });
    /**
    await api.tx.xTokens
      .transferMultiasset(
        {
          V3: {
            id: {
              Concrete: AssetId.BncV3.location,
            },
            fun: {
              Fungible: AssetId.Bnc.unit.mul(BN_FIVE),
            },
          },
        },
        {
          V3: {
            parents: 1,
            interior: {
              X2: [
                { Parachain: ChainSpecs.get(ChainId.Bifrost)!.parachain },
                {
                  AccountId32: {
                    network: undefined,
                    id: alice.keyRingPair.publicKey,
                  },
                },
              ],
            },
          },
        },
        {
          Limited: {
            refTime:
              TRANSFER_INSTRUCTIONS *
              ChainSpecs.get(ChainId.Bifrost)!.unitCostWeight,
            proofSize: 0,
          },
        }
      )
      .signAndSend(alice.keyRingPair);
  */
    await waitForEvents(api, "system.ExtrinsicSuccess");
    await waitForEvents(bifrost.api, "xcmpQueue.Success");

    expectEvent(await waitForEvents(bifrost.api, "balances.Deposit"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "eCSrvbA5gGNYdM3UjBNxcBNBqGxtz3SEEfydKragtL4pJ4F",
          amount: "5,631,360,000",
        }),
      }),
    });
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 14)
    ).toMatchSnapshot();
  });
  it("[ BNC V3 -> MGA -> BNC V3 ] send ZLK to mangata and back", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    const target = ChainSpecs.get(ChainId.Mg)!;
    await mgaSdk.xTokens.depositFromParachain({
      account: alice.keyRingPair,
      asset: {
        V3: {
          id: {
            Concrete: {
              parents: 0,
              interior: {
                X1: {
                  GeneralKey: {
                    length: 2,
                    data: "0x0207000000000000000000000000000000000000000000000000000000000000",
                  },
                },
              },
            },
          },
          fun: {
            Fungible: BN_TEN.mul(Assets.MG_UNIT),
          },
        },
      },
      destination: {
        V3: {
          parents: 1,
          interior: {
            X2: [
              { Parachain: target.parachain },
              {
                AccountId32: {
                  network: undefined,
                  id: alice.keyRingPair.addressRaw,
                },
              },
            ],
          },
        },
      },
      url: bifrost.uri,
      weightLimit: {
        Limited: {
          refTime: TRANSFER_INSTRUCTIONS * target.unitCostWeight,
          proofSize: 0,
        },
      },
    });
    await waitForEvents(api, "xcmpQueue.Success");
    expectEvent(await waitForEvents(api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
          amount: "9,951,616,000,000,000,000",
        }),
      }),
    });
    await mgaSdk.xTokens.withdraw({
      account: alice.keyRingPair,
      amount: Assets.MG_UNIT.mul(BN_FIVE),
      destinationAddress: alice.keyRingPair.address,
      parachainId: 2001,
      tokenSymbol: "ZLK",
      withWeight:
        TRANSFER_INSTRUCTIONS * ChainSpecs.get(ChainId.Bifrost)!.unitCostWeight,
    });
    await waitForEvents(api, "system.ExtrinsicSuccess");
    await waitForEvents(bifrost.api, "xcmpQueue.Success");
    expectEvent(await waitForEvents(bifrost.api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "gXCcrjjFX3RPyhHYgwZDmw8oe4JFpd5anko3nTY8VrmnJpe",
          amount: "4,989,441,200,000,000,000",
          currencyId: expect.objectContaining({
            Token: "ZLK",
          }),
        }),
      }),
    });
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 26)
    ).toMatchSnapshot();
  });
  it("[ BNC V3 -> MGA -> BNC V3 ] send vKSM to mangata and back", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    const target = ChainSpecs.get(ChainId.Mg)!;
    await mgaSdk.xTokens.depositFromParachain({
      account: alice.keyRingPair,
      asset: {
        V3: {
          id: {
            Concrete: {
              parents: 0,
              interior: {
                X1: {
                  GeneralKey: {
                    length: 2,
                    data: "0x0104000000000000000000000000000000000000000000000000000000000000",
                  },
                },
              },
            },
          },
          fun: {
            Fungible: BN_TEN.mul(BN_TEN.pow(new BN(12))),
          },
        },
      },
      destination: {
        V3: {
          parents: 1,
          interior: {
            X2: [
              { Parachain: target.parachain },
              {
                AccountId32: {
                  network: undefined,
                  id: alice.keyRingPair.addressRaw,
                },
              },
            ],
          },
        },
      },
      url: bifrost.uri,
      weightLimit: {
        Limited: {
          refTime: 800000000,
          proofSize: 0,
        },
      },
    });
    await waitForEvents(api, "xcmpQueue.Success");
    expectEvent(await waitForEvents(api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
          amount: "9,999,677,440,000",
        }),
      }),
    });
    await mgaSdk.xTokens.withdraw({
      account: alice.keyRingPair,
      amount: BN_FIVE.mul(BN_TEN.pow(new BN(12))),
      destinationAddress: alice.keyRingPair.address,
      parachainId: 2001,
      tokenSymbol: "vKSM",
      withWeight:
        TRANSFER_INSTRUCTIONS * ChainSpecs.get(ChainId.Bifrost)!.unitCostWeight,
    });
    await waitForEvents(api, "system.ExtrinsicSuccess");
    await waitForEvents(bifrost.api, "xcmpQueue.Success");
    expectEvent(await waitForEvents(bifrost.api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "gXCcrjjFX3RPyhHYgwZDmw8oe4JFpd5anko3nTY8VrmnJpe",
          amount: "4,999,929,608,000",
          currencyId: expect.objectContaining({
            VToken: "KSM",
          }),
        }),
      }),
    });
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 15)
    ).toMatchSnapshot();
  });
  it("[ BNC V3 -> MGA -> BNC V3 ] send vsKSM to mangata and back", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    const target = ChainSpecs.get(ChainId.Mg)!;
    await mgaSdk.xTokens.depositFromParachain({
      account: alice.keyRingPair,
      asset: {
        V3: {
          id: {
            Concrete: {
              parents: 0,
              interior: {
                X1: {
                  GeneralKey: {
                    length: 2,
                    data: "0x0404000000000000000000000000000000000000000000000000000000000000",
                  },
                },
              },
            },
          },
          fun: {
            Fungible: BN_TEN.mul(BN_TEN.pow(new BN(12))),
          },
        },
      },
      destination: {
        V3: {
          parents: 1,
          interior: {
            X2: [
              { Parachain: target.parachain },
              {
                AccountId32: {
                  network: undefined,
                  id: alice.keyRingPair.addressRaw,
                },
              },
            ],
          },
        },
      },
      url: bifrost.uri,
      weightLimit: {
        Limited: {
          refTime: 800000000,
          proofSize: 0,
        },
      },
    });
    await waitForEvents(api, "xcmpQueue.Success");
    expectEvent(await waitForEvents(api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
          amount: "9,999,677,440,000",
        }),
      }),
    });
    await mgaSdk.xTokens.withdraw({
      account: alice.keyRingPair,
      amount: BN_FIVE.mul(BN_TEN.pow(new BN(12))),
      destinationAddress: alice.keyRingPair.address,
      parachainId: 2001,
      tokenSymbol: "vsKSM",
      withWeight:
        TRANSFER_INSTRUCTIONS * ChainSpecs.get(ChainId.Bifrost)!.unitCostWeight,
    });
    await waitForEvents(api, "system.ExtrinsicSuccess");
    await waitForEvents(bifrost.api, "xcmpQueue.Success");
    expectEvent(await waitForEvents(bifrost.api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "gXCcrjjFX3RPyhHYgwZDmw8oe4JFpd5anko3nTY8VrmnJpe",
          amount: "4,999,929,608,000",
          currencyId: expect.objectContaining({
            VSToken: "KSM",
          }),
        }),
      }),
    });
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 16)
    ).toMatchSnapshot();
  });
  it("[ BNC V3 -> MGA -> BNC V3 ] send KSM to mangata and back", async () => {
    await setupApi();
    setupUsers();
    await Sudo.asSudoFinalized(
      Assets.updateAsset(4, {
        location: {
          location: {
            parents: "1",
            interior: "Here",
          },
        },
      })
    );
    const mgaSdk = Mangata.instance([mangata.uri]);
    const target = ChainSpecs.get(ChainId.Mg)!;
    testLog.getLog().info("Sending from bifrost to mangata");
    await mgaSdk.xTokens.depositFromParachain({
      account: eve.keyRingPair,
      asset: {
        V3: {
          id: {
            Concrete: {
              parents: 1,
              interior: "Here",
            },
          },
          fun: {
            Fungible: BN_TEN.mul(BN_TEN.pow(new BN(12))),
          },
        },
      },
      destination: {
        V3: {
          parents: 1,
          interior: {
            X2: [
              { Parachain: target.parachain },
              {
                AccountId32: {
                  network: undefined,
                  id: alice.keyRingPair.addressRaw,
                },
              },
            ],
          },
        },
      },
      url: bifrost.uri,
      weightLimit: {
        Limited: {
          refTime: 800000000,
          proofSize: 0,
        },
      },
    });
    await kusama.chain.newBlock();
    await kusama.chain.newBlock();
    await mangata.chain.newBlock();
    await mangata.chain.newBlock();
    await kusama.chain.newBlock();
    await kusama.chain.newBlock();
    await waitForEvents(api, "dmpQueue.ExecutedDownward");
    expectEvent(await waitForEvents(api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
          amount: "9,999,441,314,656",
        }),
      }),
    });
    await signTx(
      api,
      api.tx.xTokens.transfer(
        KSM_ASSET_ID.toNumber(),
        BN_FIVE.mul(BN_TEN.pow(new BN(12))),
        {
          V3: {
            parents: 1,
            interior: {
              X2: [
                { Parachain: 2001 },
                {
                  AccountId32: {
                    network: undefined,
                    id: eve.keyRingPair.addressRaw,
                  },
                },
              ],
            },
          },
        },
        "Unlimited"
      ),
      alice.keyRingPair
    );
    await kusama.chain.newBlock();
    await kusama.chain.newBlock();
    await mangata.chain.newBlock();
    await mangata.chain.newBlock();
    await kusama.chain.newBlock();
    await kusama.chain.newBlock();
    await waitForEvents(api, "system.ExtrinsicSuccess");
    await waitForEvents(bifrost.api, "dmpQueue.ExecutedDownward");
    expectEvent(await waitForEvents(bifrost.api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "gvzCT9jPBm2tHK2eExdtanafWswum6A8prt5xTN4JjCLnzq",
          amount: "4,999,693,482,656",
          currencyId: expect.objectContaining({
            Token: "KSM",
          }),
        }),
      }),
    });
  });
  async function giveKSMTokensToBifrost(eve: User) {
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.depositFromKusama({
      account: eve.keyRingPair,
      url: kusama.uri,
      assets: {
        V3: [
          {
            id: { Concrete: { parents: 0, interior: "Here" } },
            fun: { Fungible: 100e12 },
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
                id: eve.keyRingPair.addressRaw,
              },
            },
          },
        },
      },
      destination: {
        V3: {
          parents: 0,
          interior: {
            X1: { Parachain: 2001 },
          },
        },
      },
      feeAssetItem: 0,
      weightLimit: "Unlimited",
    });

    await kusama.chain.newBlock();
    await bifrost.chain.newBlock();
  }
});
