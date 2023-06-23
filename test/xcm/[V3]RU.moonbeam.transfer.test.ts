import { connectParachains } from "@acala-network/chopsticks";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, setupApi, setupUsers } from "../../utils/setup";
import {
  expectEvent,
  expectExtrinsicSuccess,
  expectJson,
  matchEvents,
  matchSystemEvents,
} from "../../utils/validators";
import { BN_BILLION, Mangata, BN_TEN, BN_HUNDRED } from "@mangata-finance/sdk";
import { mangataChopstick } from "../../utils/api";
import { Codec } from "@polkadot/types/types";
import { BN } from "@polkadot/util";
import { sleep } from "../../utils/utils";

/**
 * @group xcm
 * @group proxied
 */
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
            [alice.keyRingPair.address],
            {
              data: { free: "100000000000000000000000" },
              providers: 1,
            },
          ],
        ],
      },
    });
    // await upgradeMangata(mangata);
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
            [alice.keyRingPair.address],
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
  it.only("[V3] mangata transfer assets to [V3] moonriver", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 39)
    ).toMatchSnapshot("Before");

    expect(
      await moonriver.api.query.system.account(alice.keyRingPair.address)
    ).toMatchSnapshot("Before");
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.withdraw({
      account: alice.keyRingPair,
      amount: BN_HUNDRED.mul(BN_TEN.pow(new BN(18))),
      destinationAddress: alice.keyRingPair.address,
      parachainId: 2023,
      tokenSymbol: "MGX",
      withWeight: 800000000,
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
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 39)
    ).toMatchSnapshot("After");

    expect(
      await moonriver.api.query.system.account(alice.keyRingPair.address)
    ).toMatchSnapshot("After");
    await matchSystemEvents(moonriver, "xcmpQueue", "Success");
    await sleep(100000000);
  });

  it("[V3] moonriver transfer assets to [V3] mangata", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 39)
    ).toMatchSnapshot("Before");
    expect(
      await moonriver.api.query.system.account(alice.keyRingPair.address)
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
                  { Parachain: 2023 },
                  {
                    PalletInstance: 10,
                  },
                ],
              },
            },
          },
          fun: {
            Fungible: 5e18,
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
      url: moonriver.uri,
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

    await moonriver.chain.newBlock();
    expect(
      await moonriver.api.query.system.account(alice.keyRingPair.address)
    ).toMatchSnapshot("After");

    await mangata.chain.newBlock();

    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 39)
    ).toMatchSnapshot("After");
    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });
});
