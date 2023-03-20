import { BuildBlockMode, connectParachains } from "@acala-network/chopsticks";
import { BN_HUNDRED, BN_THOUSAND } from "@mangata-finance/sdk";
import { BN_FIVE, BN_TEN } from "@polkadot/util";
import { AssetId, ChainId } from "../../utils/ChainSpecs";
import { expectEvent, waitForEvents } from "../../utils/eventListeners";
import { XcmNode } from "../../utils/Framework/Node/XcmNode";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, api, setupApi, setupUsers } from "../../utils/setup";
import { signSendSuccess } from "../../utils/sign";
import { XToken } from "../../utils/xToken";
import { mangataChopstick } from "../../utils/api";

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
      Tokens: {
        Accounts: [
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: BN_THOUSAND.mul(AssetId.Mgx.unit).toString() },
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
  });

  // todo repeat for every other asset
  it("send BNC to mangata and back", async () => {
    const op = bifrostApi.xTokenTransfer(
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

    await XToken.transfer(
      ChainId.Bifrost,
      AssetId.Bnc,
      AssetId.Bnc.unit.mul(BN_FIVE),
      alice
    ).signAndSend(alice.keyRingPair);

    await waitForEvents(api, "system.ExtrinsicSuccess");
    await waitForEvents(bifrost.api, "xcmpQueue.Success");

    expectEvent(await waitForEvents(bifrost.api, "balances.Deposit"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "eCSrvbA5gGNYdM3UjBNxcBNBqGxtz3SEEfydKragtL4pJ4F",
          amount: "6,465,920,000",
        }),
      }),
    });
  });
});
