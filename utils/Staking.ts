import { BN } from "@mangata-finance/sdk";
import { api, Extrinsic } from "./setup";
import { User } from "./User";
import { SudoDB } from "./SudoDB";
export enum tokenOriginEnum {
  AvailableBalance = "availablebalance",
  ActivatedUnstakedReserves = "activatedunstakedreserves",
  UnspentReserves = "unspentreserves",
}
export enum AggregatorOptions {
  ExtendApprovedCollators = "extendapprovedcollators",
  RemoveApprovedCollators = "removeapprovedcollators",
}
export class Staking {
  static async isUserElected(address: string) {
    const candidates = await api?.query.parachainStaking.selectedCandidates();
    return (JSON.parse(JSON.stringify(candidates)) as string[]).includes(
      address
    );
  }
  static async aggregatorMetadata(address: string) {
    const agg = await api?.query.parachainStaking.aggregatorMetadata(address);
    return JSON.parse(JSON.stringify(agg));
  }
  static async candidateAggregator() {
    const agg = await api?.query.parachainStaking.candidateAggregator();
    return JSON.parse(JSON.stringify(agg));
  }
  static async joinAsCandidate(
    amount: BN,
    tokenId: BN,
    tokenOrigin: tokenOriginEnum
  ) {
    const numCollators = await SudoDB.getInstance().getNextCandidateNum();
    const liqAssets =
      await api?.query.parachainStaking.stakingLiquidityTokens();
    const liqAssetsCount = [...liqAssets!.keys()].length + 10;
    return api?.tx.parachainStaking.joinCandidates(
      amount,
      tokenId,
      tokenOrigin,
      new BN(numCollators).addn(10),
      new BN(liqAssetsCount)
    );
  }
  static addStakingLiquidityToken(liqToken: BN): Extrinsic {
    return api.tx.parachainStaking.addStakingLiquidityToken(
      {
        Liquidity: liqToken,
      },
      liqToken
    );
  }
  static setTotalSelected(totalNo: BN): Extrinsic {
    return api.tx.parachainStaking.setTotalSelected(totalNo);
  }
  static setCollatorCommission(perBill: BN): Extrinsic {
    return api.tx.parachainStaking.setCollatorCommission(perBill);
  }
  static scheduleCandidateBondMore(
    more: BN,
    ExtendApprovedCollators = "AvailableBalance"
  ) {
    return api.tx.parachainStaking.scheduleCandidateBondMore(
      more,
      ExtendApprovedCollators
    );
  }
  static scheduleCandidateBondLess(less: BN) {
    return api.tx.parachainStaking.scheduleCandidateBondLess(less);
  }
  static scheduleDelegatorBondMore(
    candidate: User,
    more: BN,
    ExtendApprovedCollators = "AvailableBalance"
  ) {
    return api.tx.parachainStaking.scheduleDelegatorBondMore(
      candidate.keyRingPair.address,
      more,
      ExtendApprovedCollators
    );
  }
  static scheduleDelegatorBondLess(candidate: User, less: BN) {
    return api.tx.parachainStaking.scheduleDelegatorBondLess(
      candidate.keyRingPair.address,
      less
    );
  }
  static executeBondRequest(
    candidate: User,
    ExtendApprovedCollators = "AvailableBalance"
  ): Extrinsic {
    return api.tx.parachainStaking.executeCandidateBondRequest(
      candidate.keyRingPair.address,
      ExtendApprovedCollators
    );
  }
  static executeDelegationRequest(
    delegator: User,
    candidate: User,
    ExtendApprovedCollators = "AvailableBalance"
  ): Extrinsic {
    return api.tx.parachainStaking.executeDelegationRequest(
      delegator.keyRingPair.address,
      candidate.keyRingPair.address,
      ExtendApprovedCollators
    );
  }
  static removeStakingLiquidityToken(liqToken: BN): Extrinsic {
    return api.tx.parachainStaking.removeStakingLiquidityToken(
      {
        Liquidity: liqToken,
      },
      liqToken
    );
  }
  static updateCandidateAggregator(testUser: User): Extrinsic {
    return api.tx.parachainStaking.updateCandidateAggregator(
      testUser.keyRingPair.address
    );
  }
  static aggregatorUpdateMetadata(
    collators: User[],
    action: AggregatorOptions
  ): Extrinsic {
    return api.tx.parachainStaking.aggregatorUpdateMetadata(
      collators.flatMap((user) => user.keyRingPair.address),
      action
    );
  }

  static async isUserInCandidateList(address: string) {
    const candidates = JSON.parse(
      JSON.stringify(await api.query.parachainStaking.candidatePool())
    );
    const result = (candidates as unknown as any[]).find(
      (candidate) => candidate.owner === address
    );
    return result !== undefined;
  }
}
