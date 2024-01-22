import { BuildBlockMode, connectParachains } from "@acala-network/chopsticks";
import {
  BN_BILLION,
  BN_HUNDRED,
  BN_THOUSAND,
  Mangata,
} from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";
import { mangataChopstick } from "../../utils/api";
import { AssetId } from "../../utils/ChainSpecs";
import { waitForEvents } from "../../utils/eventListeners";
import { ApiContext, upgradeMangata } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, api, setupApi, setupUsers } from "../../utils/setup";
import { expectEvent } from "../../utils/validators";
import { jest } from "@jest/globals";
jest.setTimeout(300000);

/**
 * @group xcm
 */
describe("XCM transfers", () => {
  let turing: ApiContext;
  let mangata: ApiContext;

  beforeAll(async () => {
    await setupApi();
    await setupUsers();
    turing = await XcmNetworks.turing({
      buildBlockMode: BuildBlockMode.Instant,
    });
    await setupApi();
    mangata = mangataChopstick!;
    await connectParachains([turing.chain, mangata.chain]);
    setupUsers();
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[alice.keyRingPair.address, { token: 7 }], { free: 1000e10 }],
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
        ],
      },
      Sudo: {
        Key: alice.keyRingPair.address,
      },
    });
    await upgradeMangata(mangata);
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: BN_THOUSAND.mul(AssetId.Mgx.unit).toString() },
          ],
          [
            [alice.keyRingPair.address, { token: 7 }],
            { free: BN_THOUSAND.mul(AssetId.Mgx.unit).toString() },
          ],
        ],
      },
    });
    await turing.dev.setStorage({
      System: {
        Account: [
          [
            [alice.keyRingPair.address],
            {
              data: {
                free: BN_HUNDRED.mul(AssetId.Tur.unit).toString(),
              },
            },
          ],
        ],
      },
    });
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.withdraw({
      account: alice.keyRingPair,
      amount: new BN(15e10),
      destinationAddress: alice.keyRingPair.address,
      parachainId: 2114,
      tokenSymbol: "TUR",
      withWeight: 4000000000,
    });
    await turing.chain.newBlock();
    await turing.chain.newBlock();
  });

  // todo repeat for every other asset
  it("send TUR from turing to mangata", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.depositFromParachain({
      account: alice.keyRingPair,
      asset: {
        V3: {
          id: {
            Concrete: {
              parents: 1,
              interior: {
                X1: {
                  parachain: 2114,
                },
              },
            },
          },
          fun: {
            Fungible: 10e10,
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
                  id: alice.keyRingPair.publicKey,
                },
              },
            ],
          },
        },
      },
      url: turing.uri,
      weightLimit: {
        Limited: {
          ref_time: "4000000000",
          proof_size: 0,
        },
      },
    });
    await waitForEvents(api, "xcmpQueue.Success");

    expectEvent(await waitForEvents(api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
          amount: "99,677,440,000",
        }),
      }),
    });
  });

  it("send TUR from mangata to turing", async () => {
    const mgaSdk = Mangata.instance([mangata.uri]);
    await mgaSdk.xTokens.withdraw({
      account: alice.keyRingPair,
      amount: new BN(5e10),
      destinationAddress: alice.keyRingPair.address,
      parachainId: 2114,
      tokenSymbol: "TUR",
      withWeight: 4000000000,
    });

    await waitForEvents(api, "system.ExtrinsicSuccess");
    await waitForEvents(turing.api, "xcmpQueue.Success");

    expectEvent(await waitForEvents(turing.api, "balances.Deposit"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "6AwtFW6sYcQ8RcuAJeXdDKuFtUVXj4xW57ghjYQ5xyciT1yd",
          amount: "48,336,000,000",
        }),
      }),
    });
  });
});
