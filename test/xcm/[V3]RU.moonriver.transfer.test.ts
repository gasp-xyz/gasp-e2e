import { connectParachains } from "@acala-network/chopsticks";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext, upgradeMangata } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, setupApi, setupUsers } from "../../utils/setup";
import {
  expectEvent,
  expectExtrinsicSuccess,
  expectJson,
  matchSystemEvents,
} from "../../utils/validators";
import { BN_BILLION, Mangata, BN_TEN, BN_HUNDRED } from "@mangata-finance/sdk";
import { mangataChopstick } from "../../utils/api";
import { Codec } from "@polkadot/types/types";
import { BN, BN_THOUSAND } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { waitForEvents } from "../../utils/eventListeners";
import { testLog } from "../../utils/Logger";
import { jest } from "@jest/globals";

/**
 * @group xcm
 * @group proxied
 */

jest.setTimeout(140000);

const keyring = new Keyring({ type: "ethereum" });
const alith = keyring.addFromUri(
  "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133",
  undefined,
  "ethereum",
);

describe("[V3][V3] XCM tests for Mangata <-> moonriver", () => {
  let moonriver: ApiContext;
  let mangata: ApiContext;

  beforeAll(async () => {
    await setupApi();
    moonriver = await XcmNetworks.moonriver();
    mangata = mangataChopstick!;
    await connectParachains([moonriver.chain, mangata.chain]);
    setupUsers();
    await mangata.dev.setStorage({
      Sudo: {
        Key: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      },
      Tokens: {
        Accounts: [
          [
            [alice.keyRingPair.address, { token: 39 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
        ],
      },
    });
    await moonriver.dev.setStorage({
      System: {
        Account: [
          [
            ["0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"],
            {
              data: { free: "100000000000000000000000" },
              providers: 1,
            },
          ],
        ],
      },
    });
    await upgradeMangata(mangata);
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Sudo: {
        Key: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      },
      Tokens: {
        Accounts: [
          [
            [alice.keyRingPair.address, { token: 39 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
        ],
      },
    });
    await moonriver.dev.setStorage({
      System: {
        Account: [
          [
            ["0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"],
            { data: { free: "100000000000000000000000" }, providers: 1 },
          ],
        ],
      },
      TechCommitteeCollective: {
        Members: ["0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"],
      },
      CouncilCollective: {
        Members: ["0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"],
      },
      TreasuryCouncilCollective: {
        Members: ["0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"],
      },
      AuthorFilter: {
        EligibleRatio: 100,
        EligibleCount: 100,
      },
    });
  });

  it("[V3] mangata transfer MGX assets to [V3] moonriver", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 0),
    ).toMatchSnapshot("Before");

    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.withdrawToMoonriver({
      account: alice.keyRingPair,
      amount: BN_HUNDRED.mul(BN_TEN.pow(new BN(18))),
      moonriverAddress: alith.address,
      tokenSymbol: "MGX",
      txOptions: {
        async extrinsicStatus(events) {
          expectExtrinsicSuccess(events as any[] as Codec[]);
          expectEvent(events as any as Codec[], {
            event: expect.objectContaining({
              section: "xTokens",
              method: "TransferredMultiAssets",
            }),
          });
        },
      },
    });

    await mangata.chain.newBlock();

    await moonriver.chain.newBlock();

    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 0),
    ).toMatchSnapshot("After");
    await matchSystemEvents(moonriver, "xcmpQueue", "Success");
  });

  it("[V3] moonriver transfer MGX assets to [V3] mangata", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.withdrawToMoonriver({
      account: alice.keyRingPair,
      amount: BN_THOUSAND.mul(BN_TEN.pow(new BN(18))),
      moonriverAddress: alith.address,
      tokenSymbol: "MGX",
      txOptions: {
        async extrinsicStatus(events) {
          expectExtrinsicSuccess(events as any[] as Codec[]);
          expectEvent(events as any as Codec[], {
            event: expect.objectContaining({
              section: "xTokens",
              method: "TransferredMultiAssets",
            }),
          });
        },
      },
    });

    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 0),
    ).toMatchSnapshot("Before");

    const asset = {
      V3: {
        id: {
          Concrete: {
            parents: 1,
            interior: {
              X2: [
                {
                  Parachain: 2110,
                },
                {
                  GeneralKey: {
                    length: 4,
                    data: "0x0000000000000000000000000000000000000000000000000000000000000000",
                  },
                },
              ],
            },
          },
        },
        fun: {
          Fungible: BN_HUNDRED.mul(BN_TEN.pow(new BN(18))),
        },
      },
    };

    const destination = {
      V3: {
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: 2110,
            },
            {
              AccountId32: {
                id: moonriver.api
                  .createType(
                    "AccountId32",
                    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", // Alice address on Mangata
                  )
                  .toHex(),
              },
            },
          ],
        },
      },
    };
    const depositMgxArgs = {
      account: alith,
      url: moonriver.uri,
      asset,
      destination,
      weightLimit: "Unlimited",
    };
    await mgaSdk.xTokens.depositFromParachain(depositMgxArgs);

    //    await moonriver.api.tx.xTokens
    //      .transferMultiasset(asset, destination, "Unlimited")
    //      .signAndSend(alith);

    await moonriver.chain.newBlock();
    await mangata.chain.newBlock();

    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 0),
    ).toMatchSnapshot("After");
    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });

  it("[V3] mangata transfer MOVR assets to [V3] moonriver", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    //setup_add tokens from moonriver to mga.
    const asset = {
      V3: {
        id: {
          Concrete: {
            parents: 0,
            interior: {
              X1: {
                PalletInstance: 10,
              },
            },
          },
        },
        fun: {
          Fungible: BN_HUNDRED.mul(BN_TEN.pow(new BN(18))),
        },
      },
    };

    const destination = {
      V3: {
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: 2110,
            },
            {
              AccountId32: {
                id: moonriver.api
                  .createType(
                    "AccountId32",
                    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", // Alice address on Mangata
                  )
                  .toHex(),
              },
            },
          ],
        },
      },
    };

    const depositMovrArgs = {
      account: alith,
      url: moonriver.uri,
      asset,
      destination,
      weightLimit: "Unlimited",
    };
    await mgaSdk.xTokens.depositFromParachain(depositMovrArgs);

    //    await moonriver.api.tx.xTokens
    //      .transferMultiasset(asset, destination, "Unlimited")
    //      .signAndSend(alith);
    await moonriver.chain.newBlock();
    await mangata.chain.newBlock();

    //act
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 39),
    ).toMatchSnapshot("Before");
    await moonriver.chain.newBlock();
    await mgaSdk.xTokens.withdrawToMoonriver({
      account: alice.keyRingPair,
      amount: BN_TEN.mul(BN_TEN.pow(new BN(18))),
      moonriverAddress: alith.address,
      tokenSymbol: "MOVR",
      txOptions: {
        async extrinsicStatus(events) {
          expectExtrinsicSuccess(events as any[] as Codec[]);
          expectEvent(events as any as Codec[], {
            event: expect.objectContaining({
              section: "xTokens",
              method: "TransferredMultiAssets",
            }),
          });
        },
      },
    });

    await mangata.chain.newBlock();
    await moonriver.chain.newBlock();

    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 39),
    ).toMatchSnapshot("After");

    await matchSystemEvents(moonriver, "xcmpQueue", "Success");
  });

  it("[V3] moonriver transfer MOVR assets to [V3] mangata", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 39),
    ).toMatchSnapshot("Before");

    const asset = {
      V3: {
        id: {
          Concrete: {
            parents: 0,
            interior: {
              X1: {
                PalletInstance: 10,
              },
            },
          },
        },
        fun: {
          Fungible: BN_HUNDRED.mul(BN_TEN.pow(new BN(18))),
        },
      },
    };

    const destination = {
      V3: {
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: 2110,
            },
            {
              AccountId32: {
                id: moonriver.api
                  .createType(
                    "AccountId32",
                    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", // Alice address on Mangata
                  )
                  .toHex(),
              },
            },
          ],
        },
      },
    };
    const depositMovrArgs = {
      account: alith,
      url: moonriver.uri,
      asset,
      destination,
      weightLimit: "Unlimited",
    };
    await mgaSdk.xTokens.depositFromParachain(depositMovrArgs);

    //    await moonriver.api.tx.xTokens
    //      .transferMultiasset(asset, destination, "Unlimited")
    //      .signAndSend(alith);
    await moonriver.chain.newBlock();
    testLog.getLog().info("Waiting for event2 - setup");
    await waitForEvents(mangata.api, "xcmpQueue.Success");
    testLog.getLog().info("done waiting ");
    expectEvent(await waitForEvents(mangata.api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
          amount: "99,998,387,200,000,000,000",
        }),
      }),
    });
    testLog.getLog().info("end expect");
    await mangata.chain.newBlock();
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 39),
    ).toMatchSnapshot("After");
  });
});
