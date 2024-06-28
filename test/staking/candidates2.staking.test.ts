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
import { signTx } from "gasp-sdk";

import { setupUsers, setupApi, getSudoUser } from "../../utils/setup";
import {
  AggregatorOptions,
  Staking,
  tokenOriginEnum,
} from "../../utils/Staking";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Xyk } from "../../utils/xyk";
import { getLiquidityAssetId } from "../../utils/tx";
import "jest-extended";
import { BN } from "@polkadot/util";

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
    Assets.mintToken(tokenId1, testUser3, minStk.muln(1000)),
    Assets.mintToken(tokenId2, testUser4, minStk.muln(1000)),
    Sudo.sudoAs(
      testUser3,
      Xyk.createPool(MGA_ASSET_ID, minStk.muln(3), tokenId1, minStk.muln(3)),
    ),
    Sudo.sudoAs(
      testUser4,
      Xyk.createPool(MGA_ASSET_ID, minStk.muln(3), tokenId2, minStk.muln(3)),
    ),
  );
  const liqToken1 = await getLiquidityAssetId(MGA_ASSET_ID, tokenId1);
  await Sudo.asSudoFinalized(
    Sudo.sudo(Staking.addStakingLiquidityToken(liqToken1)),
  );
});

describe("Test candidates actions: Collision by liq token", () => {
  beforeEach(async () => {});
  it("A candidate can join to the aggregator list when no more candidate joined with the same staking token", async () => {
    const aggregator = testUser1;
    const liqToken1 = await getLiquidityAssetId(MGA_ASSET_ID, tokenId1);
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        testUser2,
        await Staking.joinAsCandidate(
          minStk.muln(2),
          MGA_ASSET_ID,
          tokenOriginEnum.AvailableBalance,
        ),
      ),
      Sudo.sudoAs(
        testUser4,
        await Staking.joinAsCandidate(
          minStk.muln(2),
          MGA_ASSET_ID,
          tokenOriginEnum.AvailableBalance,
        ),
      ),
      Sudo.sudoAs(
        testUser3,
        await Staking.joinAsCandidate(
          minStk.muln(2),
          liqToken1,
          tokenOriginEnum.AvailableBalance,
        ),
      ),
    ).then((value) => {
      expectMGAExtrinsicSuDidSuccess(value);
    });
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        aggregator,
        Staking.aggregatorUpdateMetadata(
          [testUser2, testUser3, testUser4],
          AggregatorOptions.ExtendApprovedCollators,
        ),
      ),
      Sudo.sudoAs(testUser2, Staking.updateCandidateAggregator(aggregator)),
      Sudo.sudoAs(testUser3, Staking.updateCandidateAggregator(aggregator)),
    ).then((value) => {
      expectMGAExtrinsicSuDidSuccess(value);
    });
    // At this point we have an aggregator with 2 candidates, with a liq token and mgx.
    await signTx(
      await getApi(),
      Staking.updateCandidateAggregator(aggregator),
      testUser4.keyRingPair,
    ).then((value) => {
      const event = getEventResultFromMangataTx(value, [
        "system",
        "ExtrinsicFailed",
      ]);
      expect(event.data).toEqual("AggregatorLiquidityTokenTaken");
      expect(event.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });
    const candidateAggData = await Staking.candidateAggregator();
    expect(candidateAggData[testUser2.keyRingPair.address]).toEqual(
      aggregator.keyRingPair.address,
    );
    expect(candidateAggData[testUser3.keyRingPair.address]).toEqual(
      aggregator.keyRingPair.address,
    );
    expect(candidateAggData[testUser4.keyRingPair.address]).toBeUndefined();

    const aggData = await Staking.aggregatorMetadata(
      aggregator.keyRingPair.address,
    );
    expect(
      Object.values(aggData["tokenCollatorMap"]).includes(
        testUser2.keyRingPair.address,
      ),
    ).toBeTruthy();
    expect(
      Object.values(aggData["tokenCollatorMap"]).includes(
        testUser3.keyRingPair.address,
      ),
    ).toBeTruthy();
    expect(Object.keys(aggData["tokenCollatorMap"])).toHaveLength(2);

    expect(Object.values(aggData["approvedCandidates"])).toIncludeSameMembers([
      testUser3.keyRingPair.address,
      testUser2.keyRingPair.address,
      testUser4.keyRingPair.address,
    ]);
  });
});
