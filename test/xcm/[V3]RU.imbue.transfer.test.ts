import { connectParachains } from "@acala-network/chopsticks";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext, upgradeMangata } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, setupApi, setupUsers } from "../../utils/setup";
import {
  expectEvent,
  expectExtrinsicSuccess,
  expectJson,
  matchEvents,
  matchSystemEvents,
} from "../../utils/validators";
import { BN_BILLION, Mangata, BN_TEN } from "@mangata-finance/sdk";
import { mangataChopstick } from "../../utils/api";
import { Codec } from "@polkadot/types/types";
import { BN } from "@polkadot/util";

/**
 * @group skip-xcm
 * @group proxied
 */
describe("[V3][V3] XCM tests for Mangata <-> imbue", () => {
  let imbue: ApiContext;
  let mangata: ApiContext;

  beforeAll(async () => {
    await setupApi();
    imbue = await XcmNetworks.imbue();
    mangata = mangataChopstick!;
    await connectParachains([imbue.chain, mangata.chain]);
    setupUsers();
    await mangata.dev.setStorage({
      Sudo: {
        Key: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      },
      Tokens: {
        Accounts: [
          [[alice.keyRingPair.address, { token: 11 }], { free: 1000e12 }],
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
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
          [[alice.keyRingPair.address, { token: 11 }], { free: 1000e12 }],
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
        ],
      },
    });
    await imbue.dev.setStorage({
      System: {
        Account: [
          [
            [alice.keyRingPair.address],
            { data: { free: 10e12 }, providers: 1 },
          ],
        ],
      },
    });
  });
  it("[V3] mangata transfer assets to [V3] imbue", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 11),
    ).toMatchSnapshot("Before");

    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address),
    ).toMatchSnapshot("Before");
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.withdraw({
      account: alice.keyRingPair,
      amount: BN_TEN.mul(BN_TEN.pow(new BN(12))),
      destinationAddress: alice.keyRingPair.address,
      parachainId: 2121,
      tokenSymbol: "IMBU",
      withWeight: "Unlimited",
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

    await imbue.chain.newBlock();
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 11),
    ).toMatchSnapshot("After");

    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address),
    ).toMatchSnapshot("After");

    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });

  it("[V3] imbue transfer assets to [V3] mangata", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 11),
    ).toMatchSnapshot("Before");
    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address),
    ).toMatchSnapshot("Before");
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.depositFromParachain({
      account: alice.keyRingPair,
      asset: {
        V3: {
          id: {
            Concrete: {
              parents: 1,
              interior: {
                X2: [
                  { Parachain: 2121 },
                  {
                    GeneralKey: {
                      length: 2,
                      data: "0x0096000000000000000000000000000000000000000000000000000000000000",
                    },
                  },
                ],
              },
            },
          },
          fun: {
            Fungible: 5e12,
          },
        },
      },
      destination: {
        V3: {
          parents: 1,
          interior: {
            X2: [
              { Parachain: 2110 },
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
      url: imbue.uri,
      weightLimit: {
        Limited: {
          refTime: 800000000,
          proofSize: 0,
        },
      },
      txOptions: {
        async extrinsicStatus(events) {
          await matchEvents(events as any[] as Codec[], "polkadotXcm");
        },
      },
    });

    await imbue.chain.newBlock();
    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address),
    ).toMatchSnapshot("After");

    await mangata.chain.newBlock();

    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 11),
    ).toMatchSnapshot("After");
    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });
});
