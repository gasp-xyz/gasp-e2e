import { ApiPromise } from "@polkadot/api";
import { Balance } from "@polkadot/types/interfaces";
import { BN, BN_FIVE, BN_TEN } from "@polkadot/util";
import _ from "lodash";
import { AssetId, ChainId } from "../../utils/ChainSpecs";
import { getEvents, waitForEvent, waitForEvents } from "../../utils/eventListeners";
import { XcmNode } from "../../utils/Framework/Node/XcmNode";
import { alice, api, setupApi, setupUsers } from "../../utils/setup";
import { signSendFinalized, signSendSuccess } from "../../utils/sign";
import { XToken } from "../../utils/xToken";

describe("XCM transfers", () => {
    let bifrost: XcmNode

    beforeAll(async () => {
        // devops/chopsticks/bifrost.yml port
        bifrost = await XcmNode.create("ws://127.0.0.1:9948", ChainId.Bifrost)
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