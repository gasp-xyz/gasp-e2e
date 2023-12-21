import { BN } from "@polkadot/util";
import { api, Extrinsic } from "./setup";
import { User } from "./User";
import { SudoDB } from "./SudoDB";
import { getApi } from "./api";
import { getLiquidityPool } from "./tx";
import { MGA_ASSET_ID } from "./Constants";
import { Sudo } from "./sudo";
import { Assets } from "./Assets";
import { Xyk } from "./xyk";
import { signTx } from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "./txHandler";
import { ExtrinsicResult } from "./eventListeners";

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
  static async delegate(
    collatorAddress: string,
    amount: BN,
    tokenOrigin: tokenOriginEnum,
  ) {
    const candState =
      await api?.query.parachainStaking.candidateState(collatorAddress);
    const delegatorsLen = (
      await api?.query.parachainStaking.delegatorState?.entries()
    ).length;
    //@ts-ignore
    return api?.tx.parachainStaking.delegate(
      collatorAddress,
      amount,
      tokenOrigin,
      candState.value.delegators.length + 5,
      //@ts-ignore
      delegatorsLen + 5,
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
  static async joinAsCandidateWithUser(
    user: User,
    liqId: BN,
    tokenOrigin: tokenOriginEnum = tokenOriginEnum.AvailableBalance,
  ) {
    const api = await getApi();
    if (await Staking.isUserInCandidateList(user.keyRingPair.address)) {
      return;
    }
    const liq = new BN(liqId);
    const liqAssets =
      await api?.query.parachainStaking.stakingLiquidityTokens();
    const liqAssetsCount = [...liqAssets!.keys()].length;
    const numCollators = (await api?.query.parachainStaking.candidatePool())!
      .length;
    //const amountToJoin = new BN("5000000000000000000000");
    const amountToJoin = new BN(
      await api!.consts.parachainStaking.minCandidateStk!.toString(),
    ).addn(1234567);

    const tokenInPool = (await getLiquidityPool(liq)).filter((x) =>
      x.gt(MGA_ASSET_ID),
    )[0];
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(tokenInPool, user, amountToJoin.muln(100000)),
      Assets.mintNative(user, amountToJoin.muln(100000)),
      Sudo.sudoAs(
        user,
        Xyk.mintLiquidity(
          MGA_ASSET_ID,
          tokenInPool,
          amountToJoin.muln(2),
          amountToJoin.muln(100000),
        ),
      ),
      Sudo.sudoAs(user, Xyk.deactivateLiquidity(liq, amountToJoin)),
    );
    await signTx(
      api,
      // @ts-ignore
      api?.tx.parachainStaking.joinCandidates(
        amountToJoin.subn(100),
        liqId,
        tokenOrigin,
        // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
        new BN(numCollators),
        // @ts-ignore
        new BN(liqAssetsCount),
      ),
      user.keyRingPair,
    );
  }
  static async delegateWithUser(
    collatorAddress: string = "",
    user: User,
    from: tokenOriginEnum.AvailableBalance,
  ) {
    const amountToDelegate = new BN(
      getApi()!.consts.parachainStaking.minDelegation,
    ).addn(1234567);
    await signTx(
      getApi(),
      await Staking.delegate(collatorAddress, amountToDelegate, from),
      user.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    return amountToDelegate;
  }
}
