import { BN } from "@mangata-finance/sdk";
import { api, Extrinsic } from "./setup";
import { User } from "./User";
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
  static async joinAsCandidate(
    amount: BN,
    tokenId: BN,
    tokenOrigin: tokenOriginEnum
  ) {
    const numCollators = (await api?.query.parachainStaking.candidatePool())!
      .length;
    const liqAssets =
      await api?.query.parachainStaking.stakingLiquidityTokens();
    const liqAssetsCount = [...liqAssets!.keys()].length;
    return api?.tx.parachainStaking.joinCandidates(
      amount,
      tokenId,
      tokenOrigin,
      new BN(numCollators),
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
