import { connectParachains } from "@acala-network/chopsticks";
import { KeyringPair } from "@polkadot/keyring/types";
import { BN_THOUSAND } from "@polkadot/util";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext, upgradeMangata } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { devTestingPairs, setupApi, setupUsers } from "../../utils/setup";
import { sendTransaction } from "../../utils/sign";
import {
  expectEvent,
  expectExtrinsicSuccess,
  expectJson,
  matchEvents,
  matchSystemEvents,
} from "../../utils/validators";
import { mangataChopstick } from "../../utils/api";
import { BN_BILLION } from "@mangata-finance/sdk";

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
        Account: [[[1984, alice.address], { balance: 1000e6 }]],
      },
    });
  });

  it("mangata transfer assets to statemine", async () => {
    const tx = await sendTransaction(
      mangata.api.tx.xTokens
        .transfer(
          30,
          10e6,
          {
            V3: {
              parents: 1,
              interior: {
                X2: [
                  { Parachain: 1000 },
                  {
                    AccountId32: {
                      network: undefined,
                      id: alice.addressRaw,
                    },
                  },
                ],
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

    await statemine.chain.newBlock();
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 30)
    ).toMatchSnapshot();

    expect(
      await statemine.api.query.assets.account(1984, alice.address)
    ).toMatchSnapshot();

    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });

  it("statemine transfer assets to mangata", async () => {
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

    await statemine.chain.newBlock();

    await matchEvents(tx.events, "polkadotXcm");

    expect(
      await statemine.api.query.assets.account(1984, alice.address)
    ).toMatchSnapshot();

    await mangata.chain.newBlock();

    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 30)
    ).toMatchSnapshot();

    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });
});
