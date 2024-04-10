/*
 *
 * @group rollupUpdate
 */

import { EthUser } from "../../utils/EthUser";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { BN_MILLION, BN_THOUSAND, signTx } from "@mangata-finance/sdk";
import { getApi, initApi } from "../../utils/api";
import { setupUsers } from "../../utils/setup";
import { expectExtrinsicSucceed } from "../../utils/utils";
import { Keyring } from "@polkadot/api";

describe("updateL1FromL1", () => {
  let sequencer: EthUser;
  beforeEach(async () => {
    await initApi();
    setupUsers();
    sequencer = await SequencerStaking.getSequencerUser();
    await Rolldown.waitForReadRights(sequencer.ethAddress);
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

  it("Add twice the same request id but different deposits", async () => {
    const txIndex = await Rolldown.l2OriginRequestId();
    const api = getApi();
    const res = await signTx(
      api,
      new L2Update(api)
        .withDeposit(
          txIndex,
          sequencer.ethAddress,
          sequencer.ethAddress,
          BN_THOUSAND,
        )
        .build(),
      sequencer.keyRingPair,
    );
    expectExtrinsicSucceed(res);
    const events = await Rolldown.untilL2Processed(res);
    expect(
      Rolldown.isDepositSucceed(events, sequencer.ethAddress, BN_THOUSAND),
    ).toBe(true);
    const res2 = await signTx(
      api,
      new L2Update(api)
        .withDeposit(
          txIndex,
          sequencer.ethAddress,
          sequencer.ethAddress,
          BN_THOUSAND.muln(2),
        )
        .build(),
      sequencer.keyRingPair,
    );

    expectExtrinsicSucceed(res2);
    const events2 = await Rolldown.untilL2Processed(res2);
    expect(
      Rolldown.isDepositSucceed(events2, sequencer.ethAddress, BN_THOUSAND),
    ).toBe(false);
    expect(events.length).toBeGreaterThan(2);
    expect(events2.length).toBe(2);
  });

  it("Add twice the same request groups", async () => {
    const txIndex = await Rolldown.l2OriginRequestId();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        sequencer.ethAddress,
        sequencer.ethAddress,
        BN_THOUSAND,
      )
      .withDeposit(
        txIndex + 1,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_THOUSAND,
      )
      .build();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicSucceed(res);
    const events = await Rolldown.untilL2Processed(res);
    expect(
      Rolldown.isDepositSucceed(events, sequencer.ethAddress, BN_THOUSAND),
    ).toBe(true);
    const res2 = await signTx(api, update, sequencer.keyRingPair);

    expectExtrinsicSucceed(res2);
    const events2 = await Rolldown.untilL2Processed(res2);
    expect(
      Rolldown.isDepositSucceed(events2, sequencer.ethAddress, BN_THOUSAND),
    ).toBe(false);
    expect(events.length).toBeGreaterThan(2);
    expect(events2.length).toBe(2);
  });

  it("Old Ids can be included but wont be considered", async () => {
    const txIndex = await Rolldown.l2OriginRequestId();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex - 1,
        sequencer.ethAddress,
        sequencer.ethAddress,
        BN_THOUSAND,
      )
      .withDeposit(
        txIndex,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_MILLION,
      )
      .build();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicSucceed(res);
    const events = await Rolldown.untilL2Processed(res);
    expect(
      Rolldown.isDepositSucceed(events, otherUser.ethAddress, BN_MILLION),
    ).toBe(true);

    expect(
      Rolldown.isDepositSucceed(events, sequencer.ethAddress, BN_THOUSAND),
    ).toBe(false);

    expect(events.length).toBeGreaterThan(2);
  });

  it("Old Ids can be included on some other update and wont be considered", async () => {
    const txIndex = await Rolldown.l2OriginRequestId();
    const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withWithdraw(txIndex - 1, txIndexForL2Request, false, Date.now())
      .withDeposit(
        txIndex,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_MILLION,
      )
      .build();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicSucceed(res);
    const events = await Rolldown.untilL2Processed(res);
    expect(
      Rolldown.isDepositSucceed(events, otherUser.ethAddress, BN_MILLION),
    ).toBe(true);

    expect(
      Rolldown.isDepositSucceed(events, sequencer.ethAddress, BN_THOUSAND),
    ).toBe(false);

    expect(events.length).toBeGreaterThan(2);
  });
});
