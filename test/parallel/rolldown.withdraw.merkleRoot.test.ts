/*
 *
 * @group rolldownWithdrawal
 */
import { getApi, initApi } from "../../utils/api";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Withdraw } from "../../utils/rolldown";
import { ETH_ASSET_ID, GASP_ASSET_ID } from "../../utils/Constants";
import { ApiPromise } from "@polkadot/api";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import {
  L2Update,
  Rolldown,
  createAnUpdateAndCancelIt,
} from "../../utils/rollDown/Rolldown";
import { BN_HUNDRED, BN_MILLION, BN_ZERO, signTx } from "gasp-sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult, filterEventData } from "../../utils/eventListeners";
import { waitForNBlocks } from "../../utils/utils";

let testUser: User;
let sudo: User;
let api: ApiPromise;
let gaspIdL1Asset: any;
let ethIdL1Asset: any;
let waitingBatchPeriod: number;
let batchSize: number;

describe("Withdraw & Batches tests -", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    api = getApi();
    sudo = getSudoUser();
    await setupUsers();
    gaspIdL1Asset = JSON.parse(
      JSON.stringify(await api.query.assetRegistry.idToL1Asset(GASP_ASSET_ID)),
    );
    ethIdL1Asset = JSON.parse(
      JSON.stringify(await api.query.assetRegistry.idToL1Asset(ETH_ASSET_ID)),
    );
    //we need tp add 3 blocks to batchPeriod due to the peculiarities of Polkadot's processing of subscribeFinalizedHeads
    waitingBatchPeriod = Rolldown.merkleRootBatchPeriod() + 3;
    batchSize = Rolldown.merkleRootBatchSize();
    await Sudo.batchAsSudoFinalized(Assets.mintNative(sudo));
  });

  beforeEach(async () => {
    [testUser] = setupUsers();
    await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
    testUser.addAsset(ETH_ASSET_ID);
  });
  test("Given a cancel WHEN block is processed THEN it will create an update that needs to be sent through a batch to L1 for justification", async () => {
    const chain = "Ethereum";
    await SequencerStaking.removeAddedSequencers();
    const [testUser2] = setupUsers();
    const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
    const stakeAndJoinExtrinsic =
      await SequencerStaking.provideSequencerStaking(
        minToBeSequencer.addn(1000),
        chain,
      );
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testUser),
      Assets.mintNative(testUser2),
      Sudo.sudoAs(testUser, stakeAndJoinExtrinsic),
      Sudo.sudoAs(testUser2, stakeAndJoinExtrinsic),
    );
    await createAnUpdateAndCancelIt(
      testUser,
      testUser2.keyRingPair.address,
      chain,
    );
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    expect(event.source).toEqual("PeriodReached");
    const l2Request = await Rolldown.getL2Request(
      event.range.to.toNumber(),
      chain,
    );
    expect(l2Request.cancel.requestId.id).toEqual(event.range.to.toNumber());
    expect(l2Request.cancel.updater).toEqual(testUser.keyRingPair.address);
    expect(l2Request.cancel.canceler).toEqual(testUser2.keyRingPair.address);
  });

  test("Given a withdraw extrinsic run WHEN token address does not exist THEN a withdraw fail and no l2update is stored", async () => {
    const events = await signTx(
      getApi(),
      await Withdraw(testUser, 10, ethIdL1Asset.ethereum, "Arbitrum"),
      testUser.keyRingPair,
    );
    const filteredEvent = filterEventData(events, "WithdrawalRequestCreated");
    expect(filteredEvent[0]).toBeUndefined();
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(res.data).toEqual("TokenDoesNotExist");
  });

  test("Given a withdraw extrinsic run WHEN token address exist but requester does not have funds THEN a withdraw fail and no l2update is stored", async () => {
    await signTx(
      getApi(),
      await Withdraw(testUser, 10, ethIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(res.data).toEqual("NotEnoughAssets");
    });
  });

  test("Given a succeed withdraw, when block is executed Then tokens are removed from user wallet", async () => {
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(ETH_ASSET_ID, testUser, BN_MILLION),
    );
    await testUser.refreshAmounts(AssetWallet.BEFORE);
    await signTx(
      getApi(),
      await Withdraw(testUser, BN_HUNDRED, ethIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await testUser.refreshAmounts(AssetWallet.AFTER);
    const withdrawalAmount = testUser
      .getAsset(ETH_ASSET_ID)!
      .amountBefore.free.sub(testUser.getAsset(ETH_ASSET_ID)!.amountAfter.free);
    expect(withdrawalAmount).bnEqual(BN_HUNDRED);
    await Rolldown.waitForNextBatchCreated("Ethereum", waitingBatchPeriod);
  });

  test("GIVEN <batchSize - 1> withdraws, AND manually generated batch and create another withdraw for some other network (arb) THEN the batch is not generated", async () => {
    //since there is no token in the Arbitrum chain by default, we create a new one
    const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
    const blocksForSequencerUpdate =
      await SequencerStaking.blocksForSequencerUpdate();
    await SequencerStaking.removeAddedSequencers();
    await signTx(
      await getApi(),
      await SequencerStaking.provideSequencerStaking(
        minToBeSequencer.addn(1234),
        "Arbitrum",
      ),
      testUser.keyRingPair,
    );
    await Rolldown.waitForReadRights(
      testUser.keyRingPair.address,
      50,
      "Arbitrum",
    );
    const txIndex = await Rolldown.lastProcessedRequestOnL2("Arbitrum");
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        testUser.keyRingPair.address,
        testUser.keyRingPair.address,
        BN_MILLION,
      )
      .on("Arbitrum")
      .buildUnsafe();
    await signTx(api, update, testUser.keyRingPair).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await waitForNBlocks(blocksForSequencerUpdate);

    //we need to run <batchSize> extrinsic to update the start of the automatic batching period
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize,
      )),
    );

    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize - 1,
      )),
    );

    await signTx(
      getApi(),
      await Withdraw(
        testUser,
        BN_HUNDRED,
        testUser.keyRingPair.address,
        "Arbitrum",
      ),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    let error: any;
    try {
      await Rolldown.waitForNextBatchCreated("Ethereum", 10);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(
      "method rolldown.TxBatchCreated not found within blocks limit",
    );
  });
});

describe("Pre-operation withdrawal tests -", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    api = getApi();
    sudo = getSudoUser();
    await setupUsers();
    gaspIdL1Asset = JSON.parse(
      JSON.stringify(await api.query.assetRegistry.idToL1Asset(GASP_ASSET_ID)),
    );
    ethIdL1Asset = JSON.parse(
      JSON.stringify(await api.query.assetRegistry.idToL1Asset(ETH_ASSET_ID)),
    );
    //we need tp add 3 blocks to batchPeriod due to the peculiarities of Polkadot's processing of subscribeFinalizedHeads
    waitingBatchPeriod = Rolldown.merkleRootBatchPeriod() + 3;
    batchSize = Rolldown.merkleRootBatchSize();
    await Sudo.batchAsSudoFinalized(Assets.mintNative(sudo));
  });

  beforeEach(async () => {
    [testUser] = setupUsers();
    await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
    testUser.addAsset(ETH_ASSET_ID);
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize,
      )),
    );
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    expect(event.source).toEqual("AutomaticSizeReached");
  });

  test("Given <batchSize> withdrawals WHEN they run successfully THEN a batch is generated AUTOMATICALLY from that L1, from ranges of (n,n+<batchSize>-1)", async () => {
    await waitForNBlocks(3);
    const nextRequestId = JSON.parse(
      JSON.stringify(await api.query.rolldown.l2OriginRequestId()),
    );
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize,
      )),
    );
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const sequencersList = await SequencerStaking.activeSequencers();
    expect(sequencersList.toHuman().Ethereum).toContain(event.assignee);
    expect(event.source).toEqual("AutomaticSizeReached");
    expect(event.range.from.toNumber()).toEqual(nextRequestId.Ethereum);
    expect(event.range.to.toNumber()).toEqual(
      nextRequestId.Ethereum + (batchSize - 1),
    );
  });

  test("Given a withdraw extrinsic run WHEN tokens are available THEN a withdraw will happen and l2Requests will be stored waiting for batch", async () => {
    await signTx(
      getApi(),
      await Withdraw(testUser, 10, gaspIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const l2Request = await Rolldown.getL2Request(event.range.to.toNumber());
    expect(l2Request.withdrawal.tokenAddress).toEqual(gaspIdL1Asset.ethereum);
    expect(l2Request.withdrawal.withdrawalRecipient).toEqual(
      testUser.keyRingPair.address,
    );
  });

  test("Given a withdraw extrinsic run WHEN token is Eth and user has some tokens THEN a withdraw will happen and update will be stored on l2Requests and will be stored waiting for batch", async () => {
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(ETH_ASSET_ID, testUser, BN_MILLION),
    );
    await signTx(
      getApi(),
      await Withdraw(testUser, BN_HUNDRED, ethIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const l2Request = await Rolldown.getL2Request(event.range.to.toNumber());
    expect(l2Request.withdrawal.tokenAddress).toEqual(ethIdL1Asset.ethereum);
    expect(l2Request.withdrawal.withdrawalRecipient).toEqual(
      testUser.keyRingPair.address,
    );
  });

  test("Given a withdraw in a batch extrinsic, When one of the calls fail from the batch, then tokens are reverted ( transactional )", async () => {
    const requestIdBefore = JSON.parse(
      JSON.stringify(await api.query.rolldown.l2OriginRequestId()),
    );
    const events = await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        10,
      )),
      await Withdraw(testUser, 10, gaspIdL1Asset.ethereum, "Arbitrum"),
    );
    const error = events.filter(
      (x) => x.method === "ExtrinsicFailed" && x.section === "system",
    );
    expect(error.length).toBe(1);
    expect(error[0].error!.name).toBe("TokenDoesNotExist");
    const requestIdAfter = JSON.parse(
      JSON.stringify(await api.query.rolldown.l2OriginRequestId()),
    );
    await testUser.refreshAmounts(AssetWallet.AFTER);
    const withdrawalAmount = testUser
      .getAsset(ETH_ASSET_ID)!
      .amountBefore.free.sub(testUser.getAsset(ETH_ASSET_ID)!.amountAfter.free);
    expect(withdrawalAmount).bnEqual(BN_ZERO);
    expect(requestIdBefore).toEqual(requestIdAfter);
  });

  test("Given <3> withdrawals WHEN they run successfully and we wait <batchPeriod> blocks, a batch is created upon reaching the period", async () => {
    const nextRequestId = JSON.parse(
      JSON.stringify(await api.query.rolldown.l2OriginRequestId()),
    );
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        3,
      )),
    );
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const sequencersList = await SequencerStaking.activeSequencers();
    expect(sequencersList.toHuman().Ethereum).toContain(event.assignee);
    expect(event.source).toEqual("PeriodReached");
    expect(event.range.from.toNumber()).toEqual(nextRequestId.Ethereum);
    expect(event.range.to.toNumber()).toEqual(nextRequestId.Ethereum + 2);
  });

  test("Given <1> withdrawal WHEN we manually generate a batch for it THEN a batch is generated", async () => {
    await signTx(
      getApi(),
      await Withdraw(testUser, BN_HUNDRED, gaspIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await signTx(
      getApi(),
      await Rolldown.createManualBatch("EthAnvil"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const event = await Rolldown.waitForNextBatchCreated("Ethereum", 0);
    expect(event.assignee).toEqual(testUser.keyRingPair.address);
    expect(event.source).toEqual("Manual");
  });

  test("GIVEN <batchSize - 1> withdraws and create manualBatch And wait for a timed generation WHEN another withdrawal is submitted THEN a batch is generated", async () => {
    let event: any;
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize - 1,
      )),
    );
    await signTx(
      getApi(),
      await Rolldown.createManualBatch("EthAnvil"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    expect(event.assignee).toEqual(testUser.keyRingPair.address);
    expect(event.source).toEqual("Manual");
    await signTx(
      getApi(),
      await Withdraw(testUser, BN_HUNDRED, gaspIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const sequencersList = await SequencerStaking.activeSequencers();
    expect(sequencersList.toHuman().Ethereum).toContain(event.assignee);
    expect(event.source).toEqual("PeriodReached");
  });

  test("GIVEN <batchSize - 1> withdraws and create manualBatch And wait for a timed generation WHEN create batch with <batchSize - 1> withdrawal and add another one THEN a batch is generated automatically", async () => {
    let event: any;
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize - 1,
      )),
    );
    await signTx(
      getApi(),
      await Rolldown.createManualBatch("EthAnvil"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    expect(event.assignee).toEqual(testUser.keyRingPair.address);
    expect(event.source).toEqual("Manual");
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize - 1,
      )),
    );
    await signTx(
      getApi(),
      await Withdraw(testUser, BN_HUNDRED, gaspIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const sequencersList = await SequencerStaking.activeSequencers();
    expect(sequencersList.toHuman().Ethereum).toContain(event.assignee);
    expect(event.source).toEqual("AutomaticSizeReached");
  });
});
