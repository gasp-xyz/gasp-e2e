/*
 *
 * @group rollupUpdate
 */

import { EthUser } from "../../utils/EthUser";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { Rolldown } from "../../utils/rollDown/Rolldown";
import { BN_THOUSAND } from "@mangata-finance/sdk";
import { initApi } from "../../utils/api";
import { setupUsers } from "../../utils/setup";
import { expectExtrinsicSucceed } from "../../utils/utils";

describe("updateL1FromL1", () => {
  let sequencer: EthUser;
  beforeEach(async () => {
    await initApi();
    setupUsers();
    sequencer = await SequencerStaking.getSequencerUser();
  });
  it("Add twice the same deposit with requestId", async () => {
    const txIndex = await Rolldown.l2OriginRequestId();
    const res = await Rolldown.deposit(
      sequencer,
      txIndex,
      sequencer.ethAddress,
      BN_THOUSAND,
    );
    expectExtrinsicSucceed(res);
    const events = await Rolldown.untilL2Processed(res);
    expect(
      Rolldown.isDepositSucceed(events, sequencer.ethAddress, BN_THOUSAND),
    ).toBe(true);
    const res2 = await Rolldown.deposit(
      sequencer,
      txIndex,
      sequencer.ethAddress,
      BN_THOUSAND,
    );
    expectExtrinsicSucceed(res2);
    const events2 = await Rolldown.untilL2Processed(res2);
    expect(
      Rolldown.isDepositSucceed(events2, sequencer.ethAddress, BN_THOUSAND),
    ).toBe(false);
    expect(events.length).toBeGreaterThan(2);
    expect(events2.length).toBe(2);
  });
});
