import { BN, BN_FIVE, BN_TEN } from "@polkadot/util";
import _ from "lodash";
import { AssetId, ChainId } from "../../utils/ChainSpecs";
import { waitForEvent, waitForEvents } from "../../utils/eventListeners";
import { StatemineNode } from "../../utils/Framework/Node/StatemineNode";
import { alice, api, setupApi, setupUsers } from "../../utils/setup";
import { signSendSuccess } from "../../utils/sign";
import { XToken } from "../../utils/xToken";

describe("XCM transfers", () => {
    let statemine: StatemineNode

    beforeAll(async () => {
        // devops/chopsticks/statemine.yml port
        statemine = await StatemineNode.create("ws://127.0.0.1:9948", ChainId.Statemine)
        await setupApi()
        setupUsers()
    })

    // todo repeat for every other asset
    it("send USDt to mangata and back", async () => {
        // const op = statemine.xTokenTransfer(ChainId.Mg, AssetId.USDt, AssetId.USDt.unit.mul(BN_TEN), alice)
        // await signSendSuccess(
        //     statemine.api,
        //     op,
        //     alice
        // )

        // await waitForEvent(api, "xcmpQueue.Success")
        // let deposits = await waitForEvents(api, "tokens.Deposited")
        // let amount = (_.find(deposits, ({ who }) => who.toString() === "5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z")).amount.toBn()
        // expect(amount).bnEqual(new BN(25_804_800_000))

        // await XToken.transfer(ChainId.Statemine, AssetId.USDt, AssetId.USDt.unit.mul(BN_FIVE), alice)
        await XToken.transfer(ChainId.Statemine, AssetId.Mgx, AssetId.Mgx.unit.mul(BN_FIVE), alice)
            .signAndSend(alice.keyRingPair)

        await waitForEvent(api, "system.ExtrinsicSuccess")
        await waitForEvent(statemine.api, "xcmpQueue.Success")
        deposits = await waitForEvents(statemine.api, "balances.Deposit")
        amount = (_.find(deposits, ({ who }) => who.toString() === "eCSrvbA5gGNYdM3UjBNxcBNBqGxtz3SEEfydKragtL4pJ4F")).amount.toBn()
        expect(amount).bnEqual(new BN(7_415_680_000))
    })
});