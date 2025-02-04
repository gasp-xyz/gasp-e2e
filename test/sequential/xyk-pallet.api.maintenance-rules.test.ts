/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group maintenance
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  ExtrinsicResult,
  expectMGAExtrinsicSuDidSuccess,
} from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import {
  setupApi,
  setup5PoolsChained,
  Extrinsic,
  setupUsers,
} from "../../utils/setup";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { BN_MILLION } from "gasp-sdk";
import { BN_ONE, BN_HUNDRED, signTx } from "gasp-sdk";
import { Sudo } from "../../utils/sudo";
import { ApiPromise } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import {
  AggregatorOptions,
  Staking,
  tokenOriginEnum,
} from "../../utils/Staking";
import { Maintenance } from "../../utils/Maintenance";
import { getLiquidityAssetId } from "../../utils/tx";
import { ProofOfStake } from "../../utils/ProofOfStake";
import { User } from "../../utils/User";
import { getPoolIdsInfo, Market } from "../../utils/market";
import { FoundationMembers } from "../../utils/FoundationMembers";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

let users: User[] = [];
let tokenIds: BN[] = [];
let api: ApiPromise;
let swapOperations: { [K: string]: Extrinsic } = {};
let testUser1: User;
let testUser2: User;
let minStk: BN;
let foundationAccountAddress: string;
//TODO: Goncer Need to change getTokenIds function in setup5PoolsChained
describe("On Maintenance mode - multiSwaps / swaps / compound / prov liq are not allowed", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    ({ users, tokenIds } = await setup5PoolsChained(users));
    api = await getApi();

    const foundationMembers = await FoundationMembers.getFoundationMembers();
    foundationAccountAddress = foundationMembers[0];

    const liq = await getLiquidityAssetId(tokenIds.slice(-1)[0], GASP_ASSET_ID);
    const {
      swapPoolList: poolIds,
      firstToken,
      lastToken,
    } = await getPoolIdsInfo(tokenIds);
    swapOperations = {
      multiswapSellAsset: Market.multiswapAssetSell(
        poolIds,
        firstToken,
        BN_HUNDRED,
        lastToken,
        BN_ONE,
      ),
      multiswapBuyAsset: Market.multiswapAssetBuy(
        poolIds,
        firstToken,
        BN_HUNDRED,
        lastToken,
        BN_MILLION,
      ),
      sellAsset: Market.sellAsset(
        poolIds[0],
        tokenIds[0],
        tokenIds[1],
        BN_HUNDRED,
        BN_ONE,
      ),
      buyAsset: Market.buyAsset(
        poolIds[0],
        tokenIds[0],
        tokenIds[1],
        BN_HUNDRED,
        BN_MILLION,
      ),
      //provideLiquidity: Xyk.provideLiquidity(liq, GASP_ASSET_ID, BN_HUNDRED),
    };
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOff(),
      ),
    );
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOn(),
      ),
      ProofOfStake.updatePoolPromotion(liq, 20),
    ).then((value) => {
      expectMGAExtrinsicSuDidSuccess(value);
    });
  });
  let userIndex = 0;
  it.each(["multiswapSellAsset", "multiswapBuyAsset", "sellAsset", "buyAsset"])(
    "%s operation is not allowed in mm",
    async (operation) => {
      const extrinsic = swapOperations[operation];
      userIndex += 1;
      await signTx(api, extrinsic, users[userIndex % users.length].keyRingPair)
        .then((events) => {
          const event = getEventResultFromMangataTx(events, [
            "system",
            "ExtrinsicFailed",
          ]);
          expect(event.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
          expect(event.data).toContain("TradingBlockedByMaintenanceMode");
        })
        .catch((exc) => {
          expect(JSON.parse(JSON.stringify(exc)).data.toString()).toContain(
            "1010: Invalid Transaction: The swap prevalidation has failed",
          );
        });
    },
  );
  afterAll(async () => {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOff(),
      ),
    );
  });
});
describe("On Maintenance mode - aggregators and candidates are allowed", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    [testUser1, testUser2] = setupUsers();
    await setupApi();
    minStk = new BN(
      (await getApi()).consts.parachainStaking.minCandidateStk.toString(),
    );
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testUser1, minStk.muln(1000)),
      Assets.mintNative(testUser2, minStk.muln(1000)),
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOn(),
      ),
    );
  });
  it("Join as candidate , Aggregate metadata and update CandidateAgg runs on Mm", async () => {
    const aggregator = testUser1;
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        testUser2,
        await Staking.joinAsCandidate(
          minStk.muln(2),
          GASP_ASSET_ID,
          tokenOriginEnum.AvailableBalance,
        ),
      ),
      Sudo.sudoAs(
        aggregator,
        Staking.aggregatorUpdateMetadata(
          [testUser2],
          AggregatorOptions.ExtendApprovedCollators,
        ),
      ),
      Sudo.sudoAs(testUser2, Staking.updateCandidateAggregator(aggregator)),
    ).then((events) => {
      expectMGAExtrinsicSuDidSuccess(events);
    });
    const candidateAggData = await Staking.candidateAggregator();
    expect(
      candidateAggData[testUser2.keyRingPair.address.toLowerCase()],
    ).toEqual(aggregator.keyRingPair.address.toLowerCase());
  });

  afterAll(async () => {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOff(),
      ),
    );
  });
});
