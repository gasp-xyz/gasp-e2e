import { BuildBlockMode, connectParachains } from "@acala-network/chopsticks";
import { BN_HUNDRED, BN_THOUSAND } from "@mangata-finance/sdk";
import { BN_FIVE } from "@polkadot/util";
import { mangataChopstick } from "../../utils/api";
import { AssetId, ChainId } from "../../utils/ChainSpecs";
import { waitForEvents } from "../../utils/eventListeners";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, api, setupApi, setupUsers } from "../../utils/setup";
import { signSendSuccess } from "../../utils/sign";
import { expectEvent } from "../../utils/validators";
import { XToken } from "../../utils/xToken";

/**
 * @group xcm
 */
describe("XCM transfers", () => {
  let turing: ApiContext;
  let mangata: ApiContext;

  beforeAll(async () => {
    turing = await XcmNetworks.turing({
      buildBlockMode: BuildBlockMode.Instant,
    });
    await setupApi();
    mangata = mangataChopstick!;
    await connectParachains([turing.chain, mangata.chain]);
    setupUsers();
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [
            [alice.keyRingPair.address, { token: 0 }],
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
            { data: { free: BN_HUNDRED.mul(AssetId.Bnc.unit).toString() } },
          ],
        ],
      },
    });
  });

  // todo repeat for every other asset
  it("send TUR to mangata and back", async () => {
    const op = turing.api.tx.xTokens.transferMultiasset(
      {
        V1: {
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
            Fungible: 10e12,
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
                  id: alice.keyRingPair.publicKey,
                },
              },
            ],
          },
        },
      },
      4000000000
    );
    await signSendSuccess(turing.api, op, alice);

    await waitForEvents(api, "xcmpQueue.Success");

    expectEvent(await waitForEvents(api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
          amount: "9,999,677,440,000",
        }),
      }),
    });

    await XToken.transfer(
      ChainId.Tur,
      AssetId.Tur,
      AssetId.Tur.unit.mul(BN_FIVE),
      alice
    ).signAndSend(alice.keyRingPair);

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
