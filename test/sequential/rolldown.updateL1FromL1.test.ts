/*
 *
 * @group counters
 */

import { EthUser } from "../../utils/EthUser";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import {
  BN_HUNDRED,
  BN_MILLION,
  BN_TEN_THOUSAND,
  BN_THOUSAND,
  BN_ZERO,
  signTx,
} from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import {
  expectExtrinsicFail,
  expectExtrinsicSucceed,
  stringToBN,
  waitForNBlocks,
} from "../../utils/utils";
import { ApiPromise, Keyring } from "@polkadot/api";
import { testLog } from "../../utils/Logger";
import { Sudo } from "../../utils/sudo";
import { FoundationMembers } from "../../utils/FoundationMembers";
import { Maintenance } from "../../utils/Maintenance";
import {
  expectMGAExtrinsicSuDidSuccess,
  waitForEvents,
  waitNewBlock,
} from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { AssetWallet, User } from "../../utils/User";
import { getAssetIdFromErc20 } from "../../utils/rollup/ethUtils";
import { GASP_ASSET_ID, MAX_BALANCE } from "../../utils/Constants";

async function checkAndSwitchMmOff() {
  let maintenanceStatus: any;
  const api = getApi();
  maintenanceStatus = await api.query.maintenance.maintenanceStatus();
  if (maintenanceStatus.isMaintenance.toString() === "true") {
    const foundationMembers = await FoundationMembers.getFoundationMembers();
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationMembers[0],
        Maintenance.switchMaintenanceModeOff(),
      ),
    );
  }
  maintenanceStatus = await api.query.maintenance.maintenanceStatus();
  expect(maintenanceStatus.isMaintenance.toString()).toEqual("false");
}

async function getEventError(events: any) {
  const stringifyEvent = JSON.parse(JSON.stringify(events));
  const eventWithError = (stringifyEvent as any[]).filter(
    (x) => x.event.data && x.event.data[2] && x.event.data[2].err !== undefined,
  );
  if (eventWithError.length > 1) {
    testLog.getLog().warn("More than one events with error!!");
    testLog.getLog().warn(JSON.stringify(eventWithError));
  }
  //returning first item :shrug:
  if (eventWithError.length < 1) {
    testLog.getLog().warn("No events with error!!");
    testLog.getLog().warn(JSON.stringify(stringifyEvent));
    return undefined;
  }
  return eventWithError[0].event.data[2].err;
}

describe.skip("updateL1FromL1", () => {
  let sequencer: EthUser;
  beforeEach(async () => {
    await initApi();
    setupUsers();
    sequencer = await SequencerStaking.getSequencerUser();
    await Rolldown.waitForReadRights(sequencer.keyRingPair.address);
  });
  it("Updates are accepted", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
    const user = new EthUser(new Keyring({ type: "ethereum" }));
    const userAddr = user.keyRingPair.address;
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(txIndex, userAddr, userAddr, BN_MILLION)
      .withCancelResolution(txIndex + 1, txIndexForL2Request, false, Date.now())
      .buildUnsafe();
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
      .withDeposit(txIndex + 1, userAddr, userAddr, BN_MILLION)
      .withCancelResolution(txIndex + 2, txIndexForL2Request, false, Date.now())
      .buildUnsafe();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expect(expectExtrinsicFail(res).data).toEqual("WrongRequestId");
  });
  it("Future -1,0,1 updates are  not accepted", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const txIndexForL2Request = await Rolldown.lastProcessedRequestOnL2();
    const user = new EthUser(new Keyring({ type: "ethereum" }));
    const userAddr = user.keyRingPair.address;
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(txIndex + 1, userAddr, userAddr, BN_MILLION)
      .withDeposit(txIndex, userAddr, userAddr, BN_MILLION)
      .withCancelResolution(txIndex - 1, txIndexForL2Request, false, Date.now())
      .buildUnsafe();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expect(expectExtrinsicFail(res).data).toEqual("InvalidUpdate");
  });
  it("Add twice the same deposit with requestId", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const res = await Rolldown.deposit(
      sequencer,
      txIndex,
      sequencer.keyRingPair.address,
      BN_THOUSAND,
    );
    expectExtrinsicSucceed(res);
    const events = await Rolldown.untilL2Processed(res);
    expect(
      Rolldown.isDepositSucceed(
        events,
        sequencer.keyRingPair.address,
        BN_THOUSAND,
      ),
    ).toBe(true);
    const res2 = await Rolldown.deposit(
      sequencer,
      txIndex,
      sequencer.keyRingPair.address,
      BN_THOUSAND,
    );
    expectExtrinsicSucceed(res2);
    const events2 = await Rolldown.untilL2Processed(res2);
    expect(
      Rolldown.isDepositSucceed(
        events2,
        sequencer.keyRingPair.address,
        BN_THOUSAND,
      ),
    ).toBe(false);
    expect(
      events.some((x) => {
        return (
          x.event.section === "rolldown" &&
          x.event.method === "RequestProcessedOnL2"
        );
      }),
    ).toBeTrue();
    expect(
      events2.some((x) => {
        return (
          x.event.section === "rolldown" &&
          x.event.method === "RequestProcessedOnL2"
        );
      }),
    ).toBeFalse();
  });
  it("Add twice the same request id but different deposits", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const api = getApi();
    const res = await signTx(
      api,
      new L2Update(api)
        .withDeposit(
          txIndex,
          sequencer.keyRingPair.address,
          sequencer.keyRingPair.address,
          BN_THOUSAND,
        )
        .buildUnsafe(),
      sequencer.keyRingPair,
    );
    expectExtrinsicSucceed(res);
    const events = await Rolldown.untilL2Processed(res);
    expect(
      Rolldown.isDepositSucceed(
        events,
        sequencer.keyRingPair.address,
        BN_THOUSAND,
      ),
    ).toBe(true);
    const res2 = await signTx(
      api,
      new L2Update(api)
        .withDeposit(
          txIndex,
          sequencer.keyRingPair.address,
          sequencer.keyRingPair.address,
          BN_THOUSAND.muln(2),
        )
        .buildUnsafe(),
      sequencer.keyRingPair,
    );

    expectExtrinsicSucceed(res2);
    const events2 = await Rolldown.untilL2Processed(res2);
    expect(
      Rolldown.isDepositSucceed(
        events2,
        sequencer.keyRingPair.address,
        BN_THOUSAND,
      ),
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
        sequencer.keyRingPair.address,
        sequencer.keyRingPair.address,
        BN_THOUSAND,
      )
      .withDeposit(
        txIndex + 1,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_THOUSAND,
      )
      .buildUnsafe();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicSucceed(res);
    const events = await Rolldown.untilL2Processed(res);
    expect(
      Rolldown.isDepositSucceed(
        events,
        sequencer.keyRingPair.address,
        BN_THOUSAND,
      ),
    ).toBe(true);
    const res2 = await signTx(api, update, sequencer.keyRingPair);

    expectExtrinsicSucceed(res2);
    const events2 = await Rolldown.untilL2Processed(res2);
    expect(
      Rolldown.isDepositSucceed(
        events2,
        sequencer.keyRingPair.address,
        BN_THOUSAND,
      ),
    ).toBe(false);
  });
  it("Old Ids can be included but wont be considered", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex - 1,
        sequencer.keyRingPair.address,
        sequencer.keyRingPair.address,
        BN_THOUSAND,
      )
      .withDeposit(
        txIndex,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_MILLION,
      )
      .buildUnsafe();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicSucceed(res);
    const events = await Rolldown.untilL2Processed(res);
    expect(
      Rolldown.isDepositSucceed(events, otherUser.ethAddress, BN_MILLION),
    ).toBe(true);

    expect(
      Rolldown.isDepositSucceed(
        events,
        sequencer.keyRingPair.address,
        BN_THOUSAND,
      ),
    ).toBe(false);

    expect(events.length).toBeGreaterThan(2);
  });
  it("Old Ids can be included on some other update and wont be considered", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex - 1,
        otherUser.keyRingPair.address,
        otherUser.keyRingPair.address,
        BN_MILLION,
      )
      .withDeposit(
        txIndex,
        otherUser.keyRingPair.address,
        otherUser.keyRingPair.address,
        BN_MILLION,
      )
      .buildUnsafe();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicSucceed(res);
    const events = await Rolldown.untilL2Processed(res);
    expect(
      Rolldown.isDepositSucceed(events, otherUser.ethAddress, BN_MILLION),
    ).toBe(true);

    expect(
      Rolldown.isDepositSucceed(
        events,
        sequencer.keyRingPair.address,
        BN_THOUSAND,
      ),
    ).toBe(false);

    const userBalance = await otherUser.getBalanceForEthToken(
      otherUser.keyRingPair.address,
    );
    expect(stringToBN(userBalance.free.toString())).bnEqual(BN_MILLION);
    expect(events.length).toBeGreaterThan(2);
  });
  it("An update with no new updates will fail", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex - 3,
        otherUser.keyRingPair.address,
        otherUser.keyRingPair.address,
        BN_MILLION,
      )
      .withDeposit(
        txIndex - 2,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_MILLION,
      )
      .buildUnsafe();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicFail(res);
  });
  it("An update with a gap will fail", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex - 3,
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
      .withDeposit(
        txIndex,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_MILLION,
      )
      .buildUnsafe();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicFail(res);
  });
  it("An update that is not ordered will fail", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex - 2,
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
      .withDeposit(
        txIndex - 1,
        otherUser.ethAddress,
        otherUser.ethAddress,
        BN_MILLION,
      )
      .buildUnsafe();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expect(expectExtrinsicFail(res).data).toEqual("InvalidUpdate");
  });
  it("An update with two identical deposits must be executed correctly", async () => {
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const otherUser = new EthUser(new Keyring({ type: "ethereum" }));
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex - 1,
        otherUser.keyRingPair.address,
        otherUser.keyRingPair.address,
        BN_MILLION,
      )
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
      .buildUnsafe();
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
      .withCancelResolution(txIndex - 2, txIndexForL2Request, false, Date.now())
      .withDeposit(txIndex - 1, userAddr, userAddr, BN_MILLION)
      .withDeposit(txIndex - 3, userAddr, userAddr, BN_MILLION)
      .withCancelResolution(txIndex - 4, txIndexForL2Request, false, Date.now())
      .buildUnsafe();
    const res = await signTx(api, update, sequencer.keyRingPair);
    expectExtrinsicSucceed(res);
    await Rolldown.untilL2Processed(res);
    await waitForNBlocks(1);
    expect((await user.getBalanceForEthToken(userAddr)).free).bnEqual(BN_ZERO);
  });
});
describe.skip("updateL1FromL1 - errors", () => {
  let sequencer: EthUser;
  beforeEach(async () => {
    await initApi();
    setupUsers();
    sequencer = await SequencerStaking.getSequencerUser();
    await Rolldown.waitForReadRights(sequencer.keyRingPair.address);
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
          .withDeposit(indexes[0], userAddr, userAddr, BN_MILLION)
          .withDeposit(indexes[1], userAddr, userAddr, BN_MILLION)
          .withDeposit(indexes[2], userAddr, userAddr, BN_MILLION)
          .withCancelResolution(
            indexes[3],
            txIndexForL2Request,
            false,
            Date.now(),
          )
          .buildUnsafe();
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

describe("updateL2FromL1 - cancelResolution and deposit errors", () => {
  const chain = "Ethereum";
  let api: ApiPromise;
  let sequencer: User;
  let txIndex: number;
  let waitingPeriod: number;

  beforeAll(async () => {
    await initApi();
    setupUsers();
    await setupApi();
    api = getApi();
  });

  beforeEach(async () => {
    await SequencerStaking.removeAddedSequencers(10);

    [sequencer] = await setupUsers();
    await SequencerStaking.setupASequencer(sequencer, chain);
    txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    waitingPeriod = (await SequencerStaking.getBlocksNumberForSeqUpdate()) * 5;
    await checkAndSwitchMmOff();
  });

  it("When a cancel resolution fail, maintenance mode will be triggered automatically", async () => {
    await checkAndSwitchMmOff();
    await Rolldown.waitForReadRights(
      sequencer.keyRingPair.address,
      waitingPeriod,
      chain,
    );
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        sequencer.keyRingPair.address,
        new L2Update(api)
          .withCancelResolution(txIndex, 1, true)
          .on(chain)
          .buildUnsafe(),
      ),
    ).then(async (events) => {
      expectMGAExtrinsicSuDidSuccess(events);
    });
    const event = await waitForEvents(api, "rolldown.RequestProcessedOnL2", 40);
    const err = await getEventError(event);
    expect(err).toEqual("WrongCancelRequestId");
    await checkAndSwitchMmOff();
  });

  it("[BUG] When a cancel resolution fail, the whole update wont be stored", async () => {
    await Rolldown.waitForReadRights(
      sequencer.keyRingPair.address,
      waitingPeriod,
      chain,
    );
    const update = new L2Update(api)
      .withDeposit(
        txIndex + 1,
        sequencer.keyRingPair.address,
        sequencer.keyRingPair.address,
        BN_HUNDRED,
      )
      .withCancelResolution(txIndex, 1, true)
      .on(chain)
      .buildUnsafe();
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(sequencer.keyRingPair.address, update),
    ).then(async (events) => {
      expectMGAExtrinsicSuDidSuccess(events);
    });
    const event = await waitForEvents(api, "rolldown.RequestProcessedOnL2", 40);
    const error = await getEventError(event);
    expect(error).toEqual("WrongCancelRequestId");
    //lets wait a couple of blocks just in case the deposit happens a few blocks later
    await waitForNBlocks(2);
    const currencyId = await getAssetIdFromErc20(
      sequencer.keyRingPair.address,
      "EthAnvil",
    );
    sequencer.addAsset(currencyId);
    expect(currencyId).bnEqual(GASP_ASSET_ID);
    //if above is true => no token has been created => token is not avl to the user.
  });

  it("When we have a failed deposit and send it again, it will result in no-execution again", async () => {
    const update1 = new L2Update(api)
      .withDeposit(
        txIndex,
        sequencer.keyRingPair.address,
        sequencer.keyRingPair.address,
        BN_TEN_THOUSAND.pow(new BN(18)),
      )
      .on(chain)
      .buildUnsafe();
    await Rolldown.waitForReadRights(
      sequencer.keyRingPair.address,
      waitingPeriod,
      chain,
    );
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(sequencer.keyRingPair.address, update1),
    );
    const event1 = await waitForEvents(
      api,
      "rolldown.RequestProcessedOnL2",
      (await Rolldown.disputePeriodLength(chain)).toNumber() * 4,
    );
    const error1 = await getEventError(event1);
    expect(error1).toEqual("Overflow");
    const update2 = new L2Update(api)
      .withDeposit(
        txIndex,
        sequencer.keyRingPair.address,
        sequencer.keyRingPair.address,
        BN_TEN_THOUSAND.pow(new BN(18)),
      )
      .withDeposit(
        txIndex + 1,
        sequencer.keyRingPair.address,
        sequencer.keyRingPair.address,
        BN_MILLION,
      )
      .on(chain)
      .buildUnsafe();
    await waitNewBlock();
    await Rolldown.waitForReadRights(
      sequencer.keyRingPair.address,
      waitingPeriod,
      chain,
    );
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(sequencer.keyRingPair.address, update2),
    );
    const event2 = await waitForEvents(
      api,
      "rolldown.RequestProcessedOnL2",
      (await Rolldown.disputePeriodLength(chain)).toNumber() * 4,
    );
    const error = await getEventError(event2);
    expect(error).toEqual(undefined);
    const currencyId = await getAssetIdFromErc20(
      sequencer.keyRingPair.address,
      "EthAnvil",
    );
    sequencer.addAsset(currencyId);
    await sequencer.refreshAmounts(AssetWallet.AFTER);
    expect(sequencer.getAsset(currencyId)?.amountAfter.free!).bnEqual(
      BN_MILLION,
    );
  });

  it("GIVEN two deposit with u128max-1 amount THEN second deposit fails", async () => {
    const [testUser1, testUser2] = await setupUsers();
    await Rolldown.waitForReadRights(sequencer.keyRingPair.address, 50, chain);
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        testUser1.keyRingPair.address,
        sequencer.keyRingPair.address,
        MAX_BALANCE.subn(1),
      )
      .withDeposit(
        txIndex + 1,
        testUser2.keyRingPair.address,
        sequencer.keyRingPair.address,
        MAX_BALANCE.subn(1),
      )
      .on(chain)
      .buildUnsafe();
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(sequencer.keyRingPair.address, update),
    ).then(async (events) => {
      expectMGAExtrinsicSuDidSuccess(events);
    });
    const event = await waitForEvents(api, "rolldown.RequestProcessedOnL2", 40);
    const error = await getEventError(event);
    expect(error).toEqual("MintError");
    const currencyId = await getAssetIdFromErc20(
      sequencer.keyRingPair.address,
      "EthAnvil",
    );
    testUser1.addAsset(currencyId);
    testUser2.addAsset(currencyId);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await testUser2.refreshAmounts(AssetWallet.AFTER);
    expect(testUser1.getAsset(currencyId)?.amountAfter.free!).bnEqual(
      MAX_BALANCE.subn(1),
    );
    expect(testUser2.getAsset(currencyId)?.amountAfter.free!).bnEqual(BN_ZERO);
    const currencyTotalIssuance = new BN(
      await api.query.tokens.totalIssuance(currencyId),
    );
    expect(currencyTotalIssuance).bnEqual(MAX_BALANCE.subn(1));
  });
});
