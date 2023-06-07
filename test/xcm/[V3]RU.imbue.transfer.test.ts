import { connectParachains } from "@acala-network/chopsticks";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, setupApi, setupUsers } from "../../utils/setup";
import { sendTransaction } from "../../utils/sign";
import {
  expectEvent,
  expectExtrinsicSuccess,
  expectJson,
  matchEvents,
  matchSystemEvents,
} from "../../utils/validators";
import { BN_BILLION } from "@mangata-finance/sdk";
import { mangataChopstick } from "../../utils/api";

/**
 * @group xcm
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
          [[alice.keyRingPair.address, { token: 14 }], { free: 1000e12 }],
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
        ],
      },
    });
    await imbue.dev.setStorage({
      System: {
        Account: [[[alice.keyRingPair.address], { data: { free: 1000e12 } }]],
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
          [[alice.keyRingPair.address, { token: 14 }], { free: 1000e12 }],
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
        ],
      },
    });
    await imbue.dev.setStorage({
      System: {
        Account: [[[alice.keyRingPair.address], { data: { free: 10e12 } }]],
      },
    });
  });
  it("[V3] mangata transfer assets to [V1] imbue", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 14)
    ).toMatchSnapshot("Before");

    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address)
    ).toMatchSnapshot("Before");
    const tx = await sendTransaction(
      mangata.api.tx.xTokens
        .transfer(
          14,
          10e12,
          {
            V3: {
              parents: 1,
              interior: {
                X2: [
                  { Parachain: 2121 },
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
          "Unlimited"
        )
        .signAsync(alice.keyRingPair)
    );

    await mangata.chain.newBlock();

    expectExtrinsicSuccess(await tx.events);
    expectEvent(await tx.events, {
      event: expect.objectContaining({
        section: "xTokens",
        method: "TransferredMultiAssets",
      }),
    });

    await imbue.chain.newBlock();
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 14)
    ).toMatchSnapshot("After");

    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address)
    ).toMatchSnapshot("After");

    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });

  it("[V3] imbue transfer assets to [V3] mangata", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 14)
    ).toMatchSnapshot("Before");
    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address)
    ).toMatchSnapshot("Before");
    const tx = await sendTransaction(
      imbue.api.tx.xTokens
        .transferMultiasset(
          {
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
          {
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
          {
            Limited: {
              refTime: 800000000,
              proofSize: 0,
            },
          }
        )
        .signAsync(alice.keyRingPair, { nonce: 0 })
    );

    await imbue.chain.newBlock();

    await matchEvents(tx.events, "polkadotXcm");

    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address)
    ).toMatchSnapshot("After");

    await mangata.chain.newBlock();

    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 14)
    ).toMatchSnapshot("After");
    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });
});
