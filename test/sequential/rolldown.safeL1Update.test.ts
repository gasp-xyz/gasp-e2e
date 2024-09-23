/*
 *
 * @group L1RolldownUpdates
 */
import {
  ChainName,
  SequencerStaking,
} from "../../utils/rollDown/SequencerStaking";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { BN_MILLION, signTx } from "gasp-sdk";
import { api, setupApi, setupUsers } from "../../utils/setup";
import { expectExtrinsicFail, expectExtrinsicSucceed } from "../../utils/utils";
import { User } from "../../utils/User";
import { testLog } from "../../utils/Logger";
describe("updateL1FromL1", () => {
  let sequencer: User;
  let testUser: User;
  const chain: ChainName = "Ethereum";
  beforeEach(async () => {
    await setupApi();
    [sequencer, testUser] = setupUsers();
    await SequencerStaking.removeAllSequencers();
    await SequencerStaking.setupASequencer(sequencer, chain);
    await Rolldown.waitForReadRights(sequencer.keyRingPair.address);
  });
  it("Updates are accepted - safe", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        testUser.keyRingPair.address,
        testUser.keyRingPair.address,
        BN_MILLION,
      )
      .on(chain)
      .buildSafe();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicSucceed(res);
    await Rolldown.untilL2Processed(res);
    expect(
      (await testUser.getBalanceForEthToken(testUser.keyRingPair.address)).free,
    ).bnEqual(BN_MILLION);
  });
  it("Updates are not accepted if wrong hash - safe", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        testUser.keyRingPair.address,
        testUser.keyRingPair.address,
        BN_MILLION,
      )
      .on(chain);
    const tx = update.buildParams();
    const hash = Rolldown.hashL1Update(tx);
    const wrongHash =
      hash.substring(hash.length - 1) === "a"
        ? hash.slice(0, -1) + "b"
        : hash.slice(0, -1) + "a";

    testLog.getLog().info(`Hash: ${hash}`);
    testLog.getLog().info(`WrongHash: ${wrongHash}`);

    const res = await signTx(
      api,
      api.tx.rolldown.updateL2FromL1(tx, wrongHash),
      sequencer.keyRingPair,
    );
    const event = expectExtrinsicFail(res);
    expect(event.data).toEqual("UpdateHashMishmatch");
  });
});
