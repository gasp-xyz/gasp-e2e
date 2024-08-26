/*
 *
 * @group L2Batches
 */

import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Assets } from "../../utils/Assets";
import BN from "bn.js";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import { Rolldown } from "../../utils/rollDown/Rolldown";
import { BN_ZERO, signTx } from "gasp-sdk";
import { getApi } from "../../utils/api";
import { expectExtrinsicSucceed } from "../../utils/utils";

let assetId: BN;
let tokenAddress: string;
let testUser1: User;
const chain = "Ethereum";
describe("updateL1FromL1", () => {
  beforeAll(async () => {
    await setupApi();
    [testUser1] = setupUsers();
    const sudo = getSudoUser();
    assetId = await sudo.registerL1Asset(null).then(async (events) => {
      return Assets.getAssetId(events);
    });
    tokenAddress = (await Assets.getL1Token(assetId)).ethereum;
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testUser1),
      Assets.mintToken(assetId, testUser1),
    );
  });
  beforeEach(async () => {});
  it("Timed L2Batches: Batches are triggered each - n blocks", async () => {
    const tx = await Rolldown.withdraw(
      chain,
      testUser1.keyRingPair.address,
      tokenAddress,
      new BN(1234),
    );
    let requestId: BN = BN_ZERO;
    const pWaiter = Rolldown.waitForNextBatchCreated(chain);
    await signTx(getApi(), tx, testUser1.keyRingPair).then(async (events) => {
      expectExtrinsicSucceed(events);
      requestId = Rolldown.getUpdateIdFromEvents(events);
    });
    const { batchId, range } = await pWaiter;
    expect(batchId).not.toBeNull();
    expect(range).not.toBeNull();
    expect(range.from.toNumber()).toBeGreaterThanOrEqual(requestId.toNumber());
    expect(range.to.toNumber()).toBeLessThanOrEqual(requestId.toNumber());

    //TODO: validate withdrawal from : rolldown.l2Requests: L2 batchId

    //TODO: Validate that the batch is created and the range is correct from :  rolldown.l2RequestsBatch: Ethereum, batchId

    //TODO: Validate hasing from RPC is available.

    //TODO validate mTree from rpcs: https://github.com/mangata-finance/eigen-layer-monorepo/blob/main/rollup-updater/src/util/utils.ts#L90
    //build mtre and validate the root hash!
  });
});
