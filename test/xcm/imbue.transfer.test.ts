import { connectParachains } from "@acala-network/chopsticks";
import { KeyringPair } from "@polkadot/keyring/types";
import { BN_THOUSAND } from "@polkadot/util";
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
describe("XCM tests for Mangata <-> imbue", () => {
  let imbue: ApiContext;
  let mangata: ApiContext;
  let alice: KeyringPair;

  beforeAll(async () => {
    imbue = await XcmNetworks.imbue();
    mangata = await XcmNetworks.mangata();
    await connectParachains([imbue.chain, mangata.chain]);
    alice = devTestingPairs().alice;
  });

  afterAll(async () => {
    await imbue.teardown();
    await mangata.teardown();
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[alice.address, { token: 11 }], { free: 1000e12 }],
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
    await imbue.dev.setStorage({
      System: {
        Account: [[[alice.address], { data: { free: 10e12 } }]],
      },
    });
  });

  it("mangata transfer assets to imbue", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 11)
    ).toMatchSnapshot("Before");

    expect(await imbue.api.query.system.account(alice.address)).toMatchSnapshot(
      "Before"
    );
    const tx = await sendTransaction(
      mangata.api.tx.xTokens
        .transfer(
          11,
          10e12,
          {
            V1: {
              parents: 1,
              interior: {
                X2: [
                  { Parachain: 2121 },
                  {
                    AccountId32: {
                      network: "Any",
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

    await imbue.chain.newBlock();
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 11)
    ).toMatchSnapshot();

    expect(
      await imbue.api.query.system.account(alice.address)
    ).toMatchSnapshot();

    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });

  it("imbue transfer assets to mangata", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 11)
    ).toMatchSnapshot("Before");

    expect(await imbue.api.query.system.account(alice.address)).toMatchSnapshot(
      "Before"
    );
    const tx = await sendTransaction(
      imbue.api.tx.xTokens
        .transferMultiasset(
          {
            V1: {
              id: {
                Concrete: {
                  parents: 1,
                  interior: {
                    X2: [{ Parachain: 2121 }, { GeneralKey: "0x0096" }],
                  },
                },
              },
              fun: {
                Fungible: 5e12,
              },
            },
          },
          {
            V1: {
              parents: 1,
              interior: {
                X2: [
                  { Parachain: 2110 },
                  {
                    AccountId32: {
                      network: "Any",
                      id: alice.addressRaw,
                    },
                  },
                ],
              },
            },
          },
          {
            Fungible: 800000000,
          }
        )
        .signAsync(alice, { nonce: 0 })
    );

    await imbue.chain.newBlock();

    await matchEvents(tx.events, "polkadotXcm");

    expect(
      await imbue.api.query.system.account(alice.address)
    ).toMatchSnapshot();

    await mangata.chain.newBlock();

    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, 11)
    ).toMatchSnapshot();
    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });
});
