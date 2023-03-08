import { connectParachains } from "@acala-network/chopsticks";
import { BN, BN_FIVE, BN_TEN } from "@polkadot/util";
import _ from "lodash";
import { AssetId, ChainId } from "../../utils/ChainSpecs";
import { waitForEvent, waitForEvents } from "../../utils/eventListeners";
import { XcmNode } from "../../utils/Framework/Node/XcmNode";
import { Context } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, api, setupApi, setupUsers } from "../../utils/setup";
import { signSendSuccess } from "../../utils/sign";
import { XToken } from "../../utils/xToken";

/**
 * @group xcm
 */
describe("XCM transfers", () => {
    let bifrost: XcmNode
    let mangata: Context

    beforeAll(async () => {
        const b = await XcmNetworks.biforst()
        await XcmNetworks.mangata()
        await connectParachains([bifrost.chain, mangata.chain])

        // devops/chopsticks/bifrost.yml port
        bifrost = new XcmNode("ws://127.0.0.1:9948", ChainId.Bifrost)
        await setupApi()
        setupUsers()
    })

    // todo repeat for every other asset
    it("send BNC to mangata and back", async () => {
        const op = bifrost.xTokenTransfer(ChainId.Mg, AssetId.Bnc, AssetId.Bnc.unit.mul(BN_TEN), alice)
        await signSendSuccess(
            bifrost.api,
            op,
            alice
        )

        await waitForEvent(api, "xcmpQueue.Success")
        let deposits = await waitForEvents(api, "tokens.Deposited")
        let amount = (_.find(deposits, ({ who }) => who.toString() === "5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z")).amount.toBn()
        expect(amount).bnEqual(new BN(25_804_800_000))

        await XToken.transfer(ChainId.Bifrost, AssetId.Bnc, AssetId.Bnc.unit.mul(BN_FIVE), alice)
            .signAndSend(alice.keyRingPair)

        await waitForEvent(api, "system.ExtrinsicSuccess")
        await waitForEvent(bifrost.api, "xcmpQueue.Success")
        deposits = await waitForEvents(bifrost.api, "balances.Deposit")
        amount = (_.find(deposits, ({ who }) => who.toString() === "eCSrvbA5gGNYdM3UjBNxcBNBqGxtz3SEEfydKragtL4pJ4F")).amount.toBn()
        expect(amount).bnEqual(new BN(7_415_680_000))
    })
});