/*
 *
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import {
  ExtrinsicResult,
  expectMGAExtrinsicSuDidSuccess,
} from "../../utils/eventListeners";
import { signTx } from "@mangata-finance/sdk";
import { setupUsers, setupApi, getSudoUser } from "../../utils/setup";
import {
  AggregatorOptions,
  Staking,
  tokenOriginEnum,
} from "../../utils/Staking";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { testLog } from "../../utils/Logger";
import { BN } from "@polkadot/util";
import { findErrorMetadata, getUserBalanceOfToken } from "../../utils/utils";
import { hexToBn } from "@polkadot/util";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Xyk } from "../../utils/xyk";
import { getLiquidityAssetId } from "../../utils/tx";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let testUser3: User;
let testUser4: User;
let testUser5: User;
let minStk: BN;
let tokenId1: BN;
let tokenId2: BN;
beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  [testUser1, testUser2, testUser3, testUser4, testUser5] = setupUsers();
  await setupApi();
  minStk = new BN(
    (await getApi()).consts.parachainStaking.minCandidateStk.toString(),
  );
  const sudo = getSudoUser();
  const tokens = await Assets.setupUserWithCurrencies(
    testUser4,
    [minStk.muln(1000), minStk.muln(1000)],
    sudo,
  );
  tokenId1 = tokens[0];
  tokenId2 = tokens[1];
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1, minStk.muln(1000)),
    Assets.mintNative(testUser2, minStk.muln(1000)),
    Assets.mintNative(testUser3, minStk.muln(1000)),
    Assets.mintNative(testUser4, minStk.muln(1000)),
    Assets.mintNative(testUser5, minStk.muln(1000)),
    Assets.mintToken(tokenId2, testUser5, minStk.muln(1000)),
    Sudo.sudoAs(
      testUser4,
      Xyk.createPool(GASP_ASSET_ID, minStk.muln(3), tokenId1, minStk.muln(3)),
    ),
    Sudo.sudoAs(
      testUser5,
      Xyk.createPool(GASP_ASSET_ID, minStk.muln(3), tokenId2, minStk.muln(3)),
    ),
  );
});

describe("Test candidates actions", () => {
  beforeEach(async () => {});
  it("A user can become a candidate by joining as candidate", async () => {
    const extrinsic = await Staking.joinAsCandidate(
      minStk.muln(2),
      GASP_ASSET_ID,
      tokenOriginEnum.AvailableBalance,
    );
    const events = await Sudo.asSudoFinalized(
      Sudo.sudoAs(testUser1, extrinsic),
    );
    const event = expectMGAExtrinsicSuDidSuccess(events);
    testLog.getLog().info(event);
    const isUserInCandidateList = await Staking.isUserInCandidateList(
      testUser1.keyRingPair.address,
    );
    expect(isUserInCandidateList).toBeTruthy();

    const userBalance = await getUserBalanceOfToken(GASP_ASSET_ID, testUser1);
    const total = hexToBn(JSON.parse(userBalance.toString()).free).add(
      hexToBn(JSON.parse(userBalance.toString()).reserved),
    );
    expect(total).bnEqual(minStk.muln(1000));
    expect(userBalance.reserved).bnEqual(minStk.muln(2));
  });
  it("A user can only join as candidate with one staking token at the same time", async () => {
    const extrinsic = await Staking.joinAsCandidate(
      minStk.muln(2),
      GASP_ASSET_ID,
      tokenOriginEnum.AvailableBalance,
    );
    const liqToken = await getLiquidityAssetId(GASP_ASSET_ID, tokenId1);
    const extrinsicNewToken = await Staking.joinAsCandidate(
      minStk.muln(2),
      liqToken,
      tokenOriginEnum.AvailableBalance,
    );
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(testUser4, extrinsic),
      Sudo.sudo(Staking.addStakingLiquidityToken(liqToken)),
    ).then((events) => {
      expectMGAExtrinsicSuDidSuccess(events);
    });
    const result = await signTx(
      await getApi(),
      extrinsicNewToken,
      testUser4.keyRingPair,
    );
    const error = getEventResultFromMangataTx(result, [
      "system",
      "ExtrinsicFailed",
    ]);
    expect(error.data).toEqual("CandidateExists");
    expect(error.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  });
  it("A user can not join as candidate with a token that is not enabled ( or MGX )", async () => {
    const liqToken = await getLiquidityAssetId(GASP_ASSET_ID, tokenId2);
    const extrinsicNewToken = await Staking.joinAsCandidate(
      minStk.muln(2),
      liqToken,
      tokenOriginEnum.AvailableBalance,
    );
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(testUser5, extrinsicNewToken),
    ).then(async (events) => {
      const error = getEventResultFromMangataTx(events, ["sudo", "SudoAsDone"]);
      const err = await findErrorMetadata(
        JSON.parse(JSON.stringify(error.data)).sudoResult.Err.Module.error,
        JSON.parse(JSON.stringify(error.data)).sudoResult.Err.Module.index,
      );
      expect(err.name).toEqual("StakingLiquidityTokenNotListed");
    });
  });
  it("A candidate can select an aggregator by update_candidate_aggregator", async () => {
    const aggregator = testUser3;
    const extrinsic = await Staking.joinAsCandidate(
      minStk.muln(2),
      GASP_ASSET_ID,
      tokenOriginEnum.AvailableBalance,
    );
    const events = await Sudo.asSudoFinalized(
      Sudo.sudoAs(testUser2, extrinsic),
    );
    const event = expectMGAExtrinsicSuDidSuccess(events);
    testLog.getLog().info(event);
    //A user can not aggregate under a non-aggregator.
    await signTx(
      await getApi(),
      Staking.updateCandidateAggregator(aggregator),
      testUser2.keyRingPair,
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
        AggregatorOptions.ExtendApprovedCollators,
      ),
      aggregator.keyRingPair,
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
      testUser2.keyRingPair,
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
        AggregatorOptions.ExtendApprovedCollators,
      ),
      aggregator.keyRingPair,
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
      testUser2.keyRingPair,
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
      aggregator.keyRingPair.address,
    );
    const aggData = await Staking.aggregatorMetadata(
      aggregator.keyRingPair.address,
    );
    expect(aggData["tokenCollatorMap"][0]).toEqual(
      testUser2.keyRingPair.address,
    );
    expect(aggData["approvedCandidates"][0]).toEqual(
      testUser2.keyRingPair.address,
    );
  });
});
