/*
 *
 * @group parallel
 */
import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import {
  ExtrinsicResult,
  expectMGAExtrinsicSuDidSuccess,
} from "../../utils/eventListeners";
import { BN, signTx } from "@mangata-finance/sdk";
import { setupUsers, setupApi } from "../../utils/setup";
import {
  AggregatorOptions,
  Staking,
  tokenOriginEnum,
} from "../../utils/Staking";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { testLog } from "../../utils/Logger";
import { getUserBalanceOfToken } from "../../utils/utils";
import { hexToBn } from "@polkadot/util";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let testUser3: User;
let minStk: BN;
beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  [testUser1, testUser2, testUser3] = setupUsers();
  await setupApi();
  minStk = new BN(
    (await getApi()).consts.parachainStaking.minCandidateStk.toString()
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1, minStk.muln(1000)),
    Assets.mintNative(testUser2, minStk.muln(1000)),
    Assets.mintNative(testUser3, minStk.muln(1000))
  );
});

describe("Test candidates actions", () => {
  beforeEach(async () => {});
  it("A user can become a candidate by joining As candidate with 2x MGX", async () => {
    const extrinsic = await Staking.joinAsCandidate(
      minStk.muln(2),
      MGA_ASSET_ID,
      tokenOriginEnum.AvailableBalance
    );
    const events = await Sudo.asSudoFinalized(
      Sudo.sudoAs(testUser1, extrinsic)
    );
    const event = expectMGAExtrinsicSuDidSuccess(events);
    testLog.getLog().info(event);
    const isUserInCandidateList = await Staking.isUserInCandidateList(
      testUser1.keyRingPair.address
    );
    expect(isUserInCandidateList).toBeTruthy();

    const userBalance = await getUserBalanceOfToken(MGA_ASSET_ID, testUser1);
    const total = hexToBn(JSON.parse(userBalance).free).add(
      hexToBn(JSON.parse(userBalance).reserved)
    );
    expect(total).bnEqual(minStk.muln(1000));
    expect(userBalance.reserved).bnEqual(minStk.muln(2));
  });
  it("A candidate can choose an aggregator only when the aggregator choose the candidate", async () => {
    const aggregator = testUser3;
    const extrinsic = await Staking.joinAsCandidate(
      minStk.muln(2),
      MGA_ASSET_ID,
      tokenOriginEnum.AvailableBalance
    );
    const events = await Sudo.asSudoFinalized(
      Sudo.sudoAs(testUser2, extrinsic)
    );
    const event = expectMGAExtrinsicSuDidSuccess(events);
    testLog.getLog().info(event);
    //A user can not aggregate under a non-aggregator.
    await signTx(
      await getApi(),
      Staking.updateCandidateAggregator(aggregator),
      testUser2.keyRingPair
    ).then((value) => {
      const error = getEventResultFromMangataTx(value, [
        "system",
        "ExtrinsicFailed",
      ]);
      expect(error.data).toEqual("AggregatorDNE");
      expect(error.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });
    //Now the aggregator is an aggregator with non-selected candidates.
    await signTx(
      await getApi(),
      Staking.aggregatorUpdateMetadata(
        [],
        AggregatorOptions.ExtendApprovedCollators
      ),
      aggregator.keyRingPair
    ).then((value) => {
      const error = getEventResultFromMangataTx(value, [
        "system",
        "ExtrinsicSuccess",
      ]);
      expect(error.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    //The candidate can not be set if the aggregator have not chosen him before.
    await signTx(
      await getApi(),
      Staking.updateCandidateAggregator(aggregator),
      testUser2.keyRingPair
    ).then((value) => {
      const error = getEventResultFromMangataTx(value, [
        "system",
        "ExtrinsicFailed",
      ]);
      expect(error.data).toEqual("AggregatorDNE");
      expect(error.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });

    await signTx(
      await getApi(),
      Staking.aggregatorUpdateMetadata(
        [testUser2],
        AggregatorOptions.ExtendApprovedCollators
      ),
      aggregator.keyRingPair
    ).then((value) => {
      const error = getEventResultFromMangataTx(value, [
        "system",
        "ExtrinsicSuccess",
      ]);
      expect(error.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    //Now candidate selection must work.
    await signTx(
      await getApi(),
      Staking.updateCandidateAggregator(aggregator),
      testUser2.keyRingPair
    ).then((value) => {
      const event = getEventResultFromMangataTx(value, [
        "parachainStaking",
        "CandidateAggregatorUpdated",
      ]);
      expect(event.data.includes(testUser2.keyRingPair.address)).toBeTruthy();
      expect(event.data.includes(aggregator.keyRingPair.address)).toBeTruthy();
      expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const candAggData = await Staking.candidateAggregator();
    expect(candAggData[testUser2.keyRingPair.address]).toEqual(
      aggregator.keyRingPair.address
    );
    const aggData = await Staking.aggregatorMetadata(
      aggregator.keyRingPair.address
    );
    expect(aggData["tokenCollatorMap"][0]).toEqual(
      testUser2.keyRingPair.address
    );
    expect(aggData["approvedCandidates"][0]).toEqual(
      testUser2.keyRingPair.address
    );
  });
});
