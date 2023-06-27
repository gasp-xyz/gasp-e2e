import { BuildBlockMode, connectParachains } from "@acala-network/chopsticks";
import { BN_BILLION, BN_HUNDRED } from "@mangata-finance/sdk";
import { BN_FIVE, BN_TEN } from "@polkadot/util";
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
import { alice, api, setupApi, setupUsers } from "../../utils/setup";
import { signSendSuccess } from "../../utils/sign";
import { expectEvent } from "../../utils/validators";
/**
 * @group xcm
 */
describe("XCM transfers", () => {
  let bifrost: ApiContext;
  let mangata: ApiContext;
  let bifrostApi: XcmNode;

  beforeAll(async () => {
    bifrost = await XcmNetworks.biforst({
      buildBlockMode: BuildBlockMode.Instant,
    });
    await setupApi();
    mangata = mangataChopstick!;
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
        ],
      },
    });
    await bifrost.dev.setStorage({
      System: {
        Account: [
          [
            [alice.keyRingPair.address],
            { data: { free: BN_HUNDRED.mul(AssetId.Bnc.unit).toString() } },
          ],
        ],
      },
    });
    // await upgradeMangata(mangata);
  });

  it("[ BNC V2 -> MGA -> BNC V3 ] send BNC to mangata and back", async () => {
    const op = bifrostApi.xTokenTransferV2(
      ChainId.Mg,
      AssetId.Bnc,
      AssetId.Bnc.unit.mul(BN_TEN),
      alice
    );
    await signSendSuccess(bifrost.api, op, alice);

    await waitForEvents(api, "xcmpQueue.Success");

    expectEvent(await waitForEvents(api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z",
          amount: "25,804,800,000",
        }),
      }),
    });
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

    await waitForEvents(api, "system.ExtrinsicSuccess");
    await waitForEvents(bifrost.api, "xcmpQueue.Success");

    expectEvent(await waitForEvents(bifrost.api, "balances.Deposit"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "eCSrvbA5gGNYdM3UjBNxcBNBqGxtz3SEEfydKragtL4pJ4F",
          amount: "6,410,240,000",
        }),
      }),
    });
  });
});
