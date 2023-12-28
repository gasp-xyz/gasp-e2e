import { BN } from "@polkadot/util";
import { api, Extrinsic } from "./setup";
import { User } from "./User";
import { SudoDB } from "./SudoDB";

export enum tokenOriginEnum {
  AvailableBalance = "AvailableBalance",
  ActivatedUnstakedReserves = "ActivatedUnstakedReserves",
  UnspentReserves = "UnspentReserves",
}
export enum AggregatorOptions {
  ExtendApprovedCollators = "ExtendApprovedCollators",
  RemoveApprovedCollators = "RemoveApprovedCollators",
}
export class Staking {
  static async isUserElected(address: string) {
    const candidates = await api?.query.parachainStaking.selectedCandidates();
    return (JSON.parse(JSON.stringify(candidates)) as string[]).includes(
      address,
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
    tokenOrigin: tokenOriginEnum,
  ) {
    const numCollators = await SudoDB.getInstance().getNextCandidateNum();
    const liqAssets =
      await api?.query.parachainStaking.stakingLiquidityTokens();
    const liqAssetsCount = [...liqAssets!.keys()].length + 10;
    return api?.tx.parachainStaking.joinCandidates(
      amount,
      tokenId,
      tokenOrigin,
      (numCollators + 10).toString(),
      liqAssetsCount.toString(),
    );
  }
  static addStakingLiquidityToken(liqToken: BN): Extrinsic {
    return api.tx.parachainStaking.addStakingLiquidityToken(
      {
        Liquidity: liqToken,
      },
      liqToken,
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
    useBalanceFrom: any = "AvailableBalance",
  ) {
    return api.tx.parachainStaking.scheduleCandidateBondMore(
      more,
      useBalanceFrom,
    );
  }
  static scheduleCandidateBondLess(less: BN) {
    return api.tx.parachainStaking.scheduleCandidateBondLess(less);
  }
  static scheduleDelegatorBondMore(
    candidate: User,
    more: BN,
    useBalanceFrom: any = "AvailableBalance",
  ) {
    return api.tx.parachainStaking.scheduleDelegatorBondMore(
      candidate.keyRingPair.address,
      more,
      useBalanceFrom,
    );
  }
  static scheduleDelegatorBondLess(candidate: User, less: BN) {
    return api.tx.parachainStaking.scheduleDelegatorBondLess(
      candidate.keyRingPair.address,
      less,
    );
  }
  static executeBondRequest(
    candidate: User,
    useBalanceFrom: any = "AvailableBalance",
  ): Extrinsic {
    return api.tx.parachainStaking.executeCandidateBondRequest(
      candidate.keyRingPair.address,
      useBalanceFrom,
    );
  }
  static executeDelegationRequest(
    delegator: User,
    candidate: User,
    useBalanceFrom: any = "AvailableBalance",
  ): Extrinsic {
    return api.tx.parachainStaking.executeDelegationRequest(
      delegator.keyRingPair.address,
      candidate.keyRingPair.address,
      useBalanceFrom,
    );
  }
  static removeStakingLiquidityToken(liqToken: BN): Extrinsic {
    return api.tx.parachainStaking.removeStakingLiquidityToken(
      {
        Liquidity: liqToken,
      },
      liqToken,
    );
  }
  static updateCandidateAggregator(testUser: User | string): Extrinsic {
    return api.tx.parachainStaking.updateCandidateAggregator(
      testUser.toString(),
    );
  }
  static aggregatorUpdateMetadata(
    collators: User[] | string[],
    action: AggregatorOptions = AggregatorOptions.ExtendApprovedCollators,
  ): Extrinsic {
    return api.tx.parachainStaking.aggregatorUpdateMetadata(
      collators.flatMap((user) => user.toString()),
      action,
    );
  }

  static async isUserInCandidateList(address: string) {
    const candidates = JSON.parse(
      JSON.stringify(await api.query.parachainStaking.candidatePool()),
    );
    const result = (candidates as unknown as any[]).find(
      (candidate) => candidate.owner === address,
    );
    return result !== undefined;
  }
}
