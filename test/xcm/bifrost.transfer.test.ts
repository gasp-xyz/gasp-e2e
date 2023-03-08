import { BuildBlockMode, connectParachains } from "@acala-network/chopsticks";
import { BN_HUNDRED, BN_THOUSAND } from "@mangata-finance/sdk";
import { BN, BN_FIVE, BN_TEN } from "@polkadot/util";
import _ from "lodash";
import { AssetId, ChainId } from "../../utils/ChainSpecs";
import { waitForEvent, waitForEvents } from "../../utils/eventListeners";
import { XcmNode } from "../../utils/Framework/Node/XcmNode";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, api, setupApi, setupUsers } from "../../utils/setup";
import { signSendSuccess } from "../../utils/sign";
import { getMangataApiUrlPort } from "../../utils/utils";
import { XToken } from "../../utils/xToken";

/**
 * @group xcm
 */
describe("XCM transfers", () => {
  let bifrost: ApiContext;
  let mangata: ApiContext;
  let bifrostApi: XcmNode;

  beforeAll(async () => {
    const port = getMangataApiUrlPort();
    bifrost = await XcmNetworks.biforst({
      buildBlockMode: BuildBlockMode.Instant,
    });
    mangata = await XcmNetworks.mangata({
      localPort: port,
      buildBlockMode: BuildBlockMode.Instant,
    });
    await connectParachains([bifrost.chain, mangata.chain]);

    bifrostApi = new XcmNode(bifrost.api, ChainId.Bifrost);
    await setupApi();
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

    await waitForEvent(api, "xcmpQueue.Success");
    let deposits = await waitForEvents(api, "tokens.Deposited");
    let amount = _.find(
      deposits,
      ({ who }) =>
        who.toString() === "5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z"
    ).amount.toBn();
    expect(amount).bnEqual(new BN(25_804_800_000));

    await XToken.transfer(
      ChainId.Bifrost,
      AssetId.Bnc,
      AssetId.Bnc.unit.mul(BN_FIVE),
      alice
    ).signAndSend(alice.keyRingPair);

    await waitForEvent(api, "system.ExtrinsicSuccess");
    await waitForEvent(bifrost.api, "xcmpQueue.Success");
    deposits = await waitForEvents(bifrost.api, "balances.Deposit");
    amount = _.find(
      deposits,
      ({ who }) =>
        who.toString() === "eCSrvbA5gGNYdM3UjBNxcBNBqGxtz3SEEfydKragtL4pJ4F"
    ).amount.toBn();
    expect(amount).bnEqual(new BN(6_465_920_000));
  });
});
