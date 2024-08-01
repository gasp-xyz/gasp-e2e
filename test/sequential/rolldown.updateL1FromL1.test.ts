/*
 *
 * @group counters
 */

import { EthUser } from "../../utils/EthUser";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { BN_MILLION, BN_THOUSAND, BN_ZERO, signTx } from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { setupUsers } from "../../utils/setup";
import {
  expectExtrinsicFail,
  expectExtrinsicSucceed,
  stringToBN,
  waitForNBlocks,
} from "../../utils/utils";
import { Keyring } from "@polkadot/api";
import { testLog } from "../../utils/Logger";

describe("updateL1FromL1", () => {
  let sequencer: EthUser;
  beforeEach(async () => {
    await initApi();
    setupUsers();
    sequencer = await SequencerStaking.getSequencerUser();
    await Rolldown.waitForReadRights(sequencer.ethAddress);
  });
  it("Updates are accepted", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
    const user = new EthUser(new Keyring({ type: "ethereum" }));
    const userAddr = user.keyRingPair.address;
    const api = getApi();
    const update = new L2Update(api)
      .withWithdraw(txIndex + 1, txIndexForL2Request, false, Date.now())
      .withDeposit(txIndex, userAddr, userAddr, BN_MILLION)
      .withUpdatesToRemove(txIndex + 2, [0, 1], Date.now())
      .withCancelResolution(txIndex + 3, txIndexForL2Request, false, Date.now())
      .build();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicSucceed(res);
    await Rolldown.untilL2Processed(res);
    expect((await user.getBalanceForEthToken(userAddr)).free).bnEqual(
      BN_MILLION,
    );
  });
  it("Future +1 updates are  not accepted", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
    const user = new EthUser(new Keyring({ type: "ethereum" }));
    const userAddr = user.keyRingPair.address;
    const api = getApi();
    const update = new L2Update(api)
      .withWithdraw(txIndex + 4, txIndexForL2Request, false, Date.now())
      .withDeposit(txIndex + 1, userAddr, userAddr, BN_MILLION)
      .withUpdatesToRemove(txIndex + 2, [0, 1], Date.now())
      .withCancelResolution(txIndex + 3, txIndexForL2Request, false, Date.now())
      .build();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expect(expectExtrinsicFail(res).data).toEqual("WrongRequestId");
  });
  it("Future -1,0,+2,+3 updates are  not accepted", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
    const user = new EthUser(new Keyring({ type: "ethereum" }));
    const userAddr = user.keyRingPair.address;
    const api = getApi();
    const update = new L2Update(api)
      .withWithdraw(txIndex - 1, txIndexForL2Request, false, Date.now())
      .withDeposit(txIndex, userAddr, userAddr, BN_MILLION)
      .withUpdatesToRemove(txIndex + 2, [0, 1], Date.now())
      .withCancelResolution(txIndex + 3, txIndexForL2Request, false, Date.now())
      .build();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expect(expectExtrinsicFail(res).data).toEqual("InvalidUpdate");
  });
  it("Add twice the same deposit with requestId", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
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
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
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
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
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
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
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
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
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
  it("An update with no new updates will not fail but wont run", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withWithdraw(txIndex - 1, txIndexForL2Request, false, Date.now())
      .withDeposit(
        txIndex - 2,
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
    ).toBe(false);
  });
  it("An update with a gap will fail", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withWithdraw(txIndex - 3, txIndexForL2Request, false, Date.now())
      .withDeposit(
        txIndex - 1,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_MILLION,
      )
      .withDeposit(
        txIndex,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_MILLION,
      )
      .build();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicFail(res);
  });
  it("An update that is not ordered will fail", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withWithdraw(txIndex - 2, txIndexForL2Request, false, Date.now())
      .withDeposit(
        txIndex,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_MILLION,
      )
      .withDeposit(
        txIndex - 1,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_MILLION,
      )
      .build();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expect(expectExtrinsicFail(res).data).toEqual("InvalidUpdate");
  });
  it("An update with two identical deposits must be executed correctly", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withWithdraw(txIndex - 1, txIndexForL2Request, false, Date.now())
      .withDeposit(
        txIndex,
        otherUser.keyRingPair.address,
        otherUser.keyRingPair.address,
        BN_MILLION,
      )
      .withDeposit(
        txIndex + 1,
        otherUser.keyRingPair.address,
        otherUser.keyRingPair.address,
        BN_MILLION,
      )
      .build();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicSucceed(res);
    await Rolldown.untilL2Processed(res);
    await waitForNBlocks(1);
    const balance = await otherUser.getBalanceForEthToken(
      otherUser.keyRingPair.address,
    );
    expect(stringToBN(balance.free.toString())).bnEqual(BN_MILLION.muln(2));
  });
  it("Every update item is validated", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
    const user = new EthUser(new Keyring({ type: "ethereum" }));
    const userAddr = user.keyRingPair.address;
    const api = getApi();
    const update = new L2Update(api)
      .withWithdraw(txIndex - 2, txIndexForL2Request, false, Date.now())
      .withDeposit(txIndex - 1, userAddr, userAddr, BN_MILLION)
      .withUpdatesToRemove(txIndex - 3, [0, 1], Date.now())
      .withCancelResolution(txIndex - 4, txIndexForL2Request, false, Date.now())
      .build();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicSucceed(res);
    await Rolldown.untilL2Processed(res);
    await waitForNBlocks(1);
    expect((await user.getBalanceForEthToken(userAddr)).free).bnEqual(BN_ZERO);
  });
});
describe("updateL1FromL1 - errors", () => {
  let sequencer: EthUser;
  beforeEach(async () => {
    await initApi();
    setupUsers();
    sequencer = await SequencerStaking.getSequencerUser();
    await Rolldown.waitForReadRights(sequencer.ethAddress);
  });
  describe.each([true, false])(`Update with gap: %s`, (withGap) => {
    it.each([0, 1, 2, 3])(
      `An update including gap? : ${withGap} at positions %s`,
      async (gap) => {
        const txIndex = await Rolldown.lastProcessedRequestOnL2();
        const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
        const user = new EthUser(new Keyring({ type: "ethereum" }));
        const userAddr = user.keyRingPair.address;
        const api = getApi();

        const indexes = [txIndex, txIndex + 1, txIndex + 2, txIndex + 3].sort(
          () => Math.random() - 0.5,
        );
        if (withGap) {
          indexes[gap] = txIndex + 5;
        }

        testLog.getLog().info(`Indexes ${indexes}`);
        const update = new L2Update(api)
          .withWithdraw(indexes[0], txIndexForL2Request, false, Date.now())
          .withDeposit(indexes[1], userAddr, userAddr, BN_MILLION)
          .withUpdatesToRemove(indexes[2], [0, 1], Date.now())
          .withCancelResolution(
            indexes[3],
            txIndexForL2Request,
            false,
            Date.now(),
          )
          .build();
        const result = await signTx(api, update, sequencer.keyRingPair);
        if (withGap) {
          expectExtrinsicFail(result);
        } else {
          expectExtrinsicSucceed(result);
        }
      },
    );
  });
});
