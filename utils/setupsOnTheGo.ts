/* eslint-disable no-console */
import Keyring from "@polkadot/keyring";
import BN from "bn.js";
import { Assets } from "./Assets";
import { KSM_ASSET_ID, MAX_BALANCE, GASP_ASSET_ID } from "./Constants";
import { waitForRewards } from "./eventListeners";
import { Extrinsic, setupApi, setupUsers, sudo } from "./setup";
import { Sudo } from "./sudo";
import { xxhashAsHex } from "@polkadot/util-crypto";
import { SudoDB } from "./SudoDB";

import {
  calculate_buy_price_id_rpc,
  getCurrentNonce,
  getLiquidityAssetId,
  getLiquidityPool,
  promotePool,
} from "./tx";
import { User } from "./User";
import {
  getBlockNumber,
  getEnvironmentRequiredVars,
  getMultiPurposeLiquidityReLockStatus,
  getMultiPurposeLiquidityStatus,
  getUserBalanceOfToken,
  stringToBN,
} from "./utils";
import { Xyk } from "./xyk";
import { api, getApi, getMangataInstance, initApi } from "./api";
import { BN_ZERO, signTx } from "gasp-sdk";
import { getBalanceOfPool } from "./txHandler";
import { Bytes, StorageKey } from "@polkadot/types";
import { Codec, ITuple } from "@polkadot/types/types";
import jsonpath from "jsonpath";
import { AggregatorOptions, Staking, tokenOriginEnum } from "./Staking";
import { hexToBn, nToBigInt } from "@polkadot/util";
import { Bootstrap } from "./Bootstrap";
import assert from "assert";
import { Council } from "./Council";
import { testLog } from "./Logger";
import {
  PalletMultipurposeLiquidityRelockStatusInfo,
  PalletMultipurposeLiquidityReserveStatusInfo,
} from "@polkadot/types/lookup";
import { ProofOfStake } from "./ProofOfStake";
import { signSendFinalized } from "./sign";
import { toNumber } from "lodash-es";
import { Vesting } from "./Vesting";
import { MPL } from "./MPL";
import {
  getLastProcessedRequestNumber,
  rolldownDeposit,
  Withdraw,
} from "./rolldown";
import { EthUser } from "./EthUser";
import { signTxMetamask } from "./metamask";
import {
  metadata,
  abi,
  convertEthAddressToDotAddress,
  getBalance,
  getL2UpdatesStorage,
  getPublicClient,
  getWalletClient,
  ROLL_DOWN_CONTRACT_ADDRESS,
} from "./rollup/ethUtils";
import Web3 from "web3";
import { L2Update, Rolldown } from "./rollDown/Rolldown";
import { ChainName, SequencerStaking } from "./rollDown/SequencerStaking";
import { decodeAbiParameters, PublicClient } from "viem";
import { getL1, L1Type } from "./rollup/l1s";
import { ApiPromise } from "@polkadot/api";
import { privateKeyToAccount } from "viem/accounts";
import { estimateMaxPriorityFeePerGas } from "viem/actions";
Assets.legacy = true;
const L1_CHAIN = "Ethereum";

export async function claimForAllAvlRewards() {
  await setupApi();
  setupUsers();
  await initApi();
  const api = await getApi();
  const txs = [];
  const allScheduleRewards =
    await api.query.proofOfStake.rewardsInfoForScheduleRewards.entries();
  const listOfUsersToClaim = allScheduleRewards.map((x) => [
    x[0]!.toHuman()! as any[0],
    x[0]!.toHuman()! as any[1],
  ]);
  for (let index = 0; index < listOfUsersToClaim.length; index++) {
    const user = listOfUsersToClaim[index];
    console.info(JSON.stringify(user) + "--" + user[1][1]);
    txs.push(
      Sudo.sudoAsWithAddressString(
        user[1][0],
        await ProofOfStake.claim3rdpartyRewards(user[1][1][0], user[1][1][1]),
      ),
    );
  }
  let promises = [];
  let nonce = await getCurrentNonce(sudo.keyRingPair.address);
  for (let index = 0; index < txs.length; index++) {
    const tx = txs[index];
    promises.push(signSendFinalized(tx, sudo, nonce));
    nonce = nonce.addn(1);
    if (index % 500 === 0) {
      await Promise.all(promises);
      promises = [];
    }
  }
  await Promise.all(promises);
}

const tokenOrigin = tokenOriginEnum.AvailableBalance;

export async function vetoMotion(motionId: number) {
  //const fundAcc = "5Gc1GyxLPr1A4jE1U7u9LFYuFftDjeSYZWQXHgejQhSdEN4s";
  const fundAcc = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
  await setupApi();
  await setupUsers();
  await initApi();
  const api = await getApi();
  const allProposals = await api.query.council.voting.entries();

  const proposal = allProposals.find(
    (x) =>
      JSON.parse(JSON.stringify(x[1].toHuman())).index === motionId.toString(),
  );
  console.info("proposal " + JSON.stringify(allProposals[0][0].toHuman()));
  const hash = proposal?.[0].toHuman()!.toString();
  console.info("hash " + hash);
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      fundAcc,
      api.tx.council.disapproveProposal(hash!),
    ),
  );
}
export async function getAllCollatorsInfoFromStash() {
  //const fundAcc = "5Gc1GyxLPr1A4jE1U7u9LFYuFftDjeSYZWQXHgejQhSdEN4s";
  await setupApi();
  await setupUsers();
  await initApi();
  const api = await getApi();
  const apiAt = await api.at(
    "0x8de8328944b57a0fae7b6780d98c8d98e31a8539a393b64e299a38db0f200edf",
  );
  // const collators = await apiAt.query.parachainStaking.candidateState.entries();
  // const collatorsInfo = collators.map((x) => [
  //   x[0].toHuman() as any,
  //   x[1].toHuman() as any,
  // ]);
  // const addresses = collatorsInfo.map((x) => x[0].toString());
  const addresses = await apiAt.query.parachainStaking.selectedCandidates();
  for (const address in addresses) {
    console.log("address " + addresses[address]);
    await fetch(
      `https://mangata-stash-dev-dot-direct-pixel-353917.oa.r.appspot.com/collator/${addresses[address]}/staking/apr`,
    ).then(async (response) => {
      const json = await response.text();
      // @ts-ignore
      console.info(`response ${JSON.stringify(json)}`);
    });
  }
  //console.info(JSON.stringify(collatorsInfo));
}
export async function vote(motionId: number) {
  await setupApi();
  await setupUsers();
  await initApi();
  const api = await getApi();
  const allProposals = await api.query.council.voting.entries();
  const allMembers = await api.query.council.members();

  const proposal = allProposals.find(
    (x) =>
      JSON.parse(JSON.stringify(x[1].toHuman())).index === motionId.toString(),
  );
  console.info("proposal " + JSON.stringify(allProposals[0][0].toHuman()));
  const hash = proposal?.[0].toHuman()!.toString();
  console.info("hash " + hash);
  const txs: Extrinsic[] = [];
  allMembers.forEach((x) => {
    txs.push(
      Sudo.sudoAsWithAddressString(
        x.toHuman()!.toString(),
        Council.vote(hash!, motionId, "aye"),
      ),
    );
  });

  await Sudo.batchAsSudoFinalized(...txs);
}
export async function close(motionId: number) {
  const fundAcc = "5Gc1GyxLPr1A4jE1U7u9LFYuFftDjeSYZWQXHgejQhSdEN4s";
  await setupApi();
  await setupUsers();
  await initApi();
  const api = await getApi();
  const allProposals = await api.query.council.voting.entries();

  const proposal = allProposals.find(
    (x) =>
      JSON.parse(JSON.stringify(x[1].toHuman())).index === motionId.toString(),
  );
  console.info("proposal " + JSON.stringify(allProposals[0][0].toHuman()));
  const hash = proposal?.[0].toHuman()!.toString();
  console.info("hash " + hash);
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      fundAcc,
      api.tx.council.close(
        hash!,
        motionId,
        {
          refTime: 97042819915,
          proofSize: 100000,
        },
        1000000,
      ),
    ),
  );
}

export async function setupACouncilWithDefaultUsers() {
  await setupApi();
  await setupUsers();
  await initApi();
  const api = await getApi();
  const amount = (await api?.consts.parachainStaking.minCandidateStk)?.muln(
    1000,
  )!;
  const keyring = new Keyring({ type: "ethereum" });
  const testUser1 = new User(keyring, "//Bob");
  const testUser2 = new User(keyring, "//Alice");
  const testUser3 = new User(keyring, "//Charlie");
  const testUser4 = new User(keyring, "//Eve");
  const testUser5 = new User(keyring, "//Ferdie");
  const testUser6 = new User(keyring, "//Dave");
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const token2 = await Assets.issueAssetToUser(sudo, amount, sudo, true);
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token2, testUser1, amount),
    Assets.mintToken(token2, testUser2, amount),
    Assets.mintToken(token2, testUser3, amount),
    Assets.mintToken(token2, testUser4, amount),
    Assets.mintToken(token2, testUser5, amount),
    Assets.mintToken(token2, testUser6, amount),
    Assets.mintNative(testUser1, amount),
    Assets.mintNative(testUser2, amount),
    Assets.mintNative(testUser3, amount),
    Assets.mintNative(testUser4, amount),
    Assets.mintNative(testUser5, amount),
    Assets.mintNative(testUser6, amount),
  );
  await Sudo.asSudoFinalized(
    Sudo.sudo(
      api.tx.council.setMembers(
        [
          testUser1.keyRingPair.address,
          testUser2.keyRingPair.address,
          testUser3.keyRingPair.address,
          testUser4.keyRingPair.address,
          testUser5.keyRingPair.address,
          testUser6.keyRingPair.address,
        ],
        testUser1.keyRingPair.address,
        0,
      ),
    ),
  );
}

export async function setupPoolWithRewardsForDefaultUsers() {
  await setupApi();
  await setupUsers();
  const amount = (await api?.consts.parachainStaking.minCandidateStk)?.muln(
    1000,
  )!;
  const keyring = new Keyring({ type: "ethereum" });
  const testUser1 = new User(keyring, "//Bob");
  const testUser2 = new User(keyring, "//Alice");
  const testUser3 = new User(keyring, "//Charlie");
  const testUser4 = new User(keyring, "//Eve");
  const testUser5 = new User(keyring, "//Dave");
  const testUser6 = new User(keyring, "//Ferdie");
  const users = [
    testUser1,
    testUser2,
    testUser3,
    testUser4,
    testUser5,
    testUser6,
  ];
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const token2 = await Assets.issueAssetToUser(sudo, amount, sudo, true);
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token2, testUser1, amount),
    Assets.mintToken(token2, testUser2, amount),
    Assets.mintToken(token2, testUser3, amount),
    Assets.mintToken(token2, testUser4, amount),
    Assets.mintToken(token2, testUser5, amount),
    Assets.mintToken(token2, testUser6, amount),
    Assets.mintNative(testUser1, amount),
    Assets.mintNative(testUser2, amount),
    Assets.mintNative(testUser3, amount),
    Assets.mintNative(testUser4, amount),
    Assets.mintNative(testUser5, amount),
    Assets.mintNative(testUser6, amount),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(GASP_ASSET_ID, amount.divn(10), token2, amount.divn(10)),
    ),
  );
  const liqId = await getLiquidityAssetId(GASP_ASSET_ID, token2);
  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(GASP_ASSET_ID, token2, amount.divn(10), amount),
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(GASP_ASSET_ID, token2, amount.divn(10), amount),
    ),
    Sudo.sudoAs(
      testUser3,
      Xyk.mintLiquidity(GASP_ASSET_ID, token2, amount.divn(10), amount),
    ),
    Sudo.sudoAs(
      testUser4,
      Xyk.mintLiquidity(GASP_ASSET_ID, token2, amount.divn(10), amount),
    ),
    Sudo.sudoAs(
      testUser5,
      Xyk.mintLiquidity(GASP_ASSET_ID, token2, amount.divn(10), amount),
    ),
    Sudo.sudoAs(
      testUser6,
      Xyk.mintLiquidity(GASP_ASSET_ID, token2, amount.divn(10), amount),
    ),
  );
  await waitForRewards(testUser4, liqId);
  return { users, liqId, sudo, token2 };
}
export async function joinAsCandidateByName(
  userName: string,
  liqId = 9,
  tokenOrigin = tokenOriginEnum.AvailableBalance,
) {
  await setupUsers();
  await setupApi();
  const user = new User(new Keyring({ type: "ethereum" }), userName);
  await Staking.joinAsCandidateWithUser(user, new BN(liqId), tokenOrigin);
}
export async function setupTokenWithRewardsForDefaultUsers() {
  await setupApi();
  await setupUsers();
  const amount = (await api?.consts.parachainStaking.minCandidateStk)?.muln(
    1000,
  )!;
  const keyring = new Keyring({ type: "ethereum" });
  const testUser1 = new User(keyring, "//Bob");
  const testUser2 = new User(keyring, "//Alice");
  const testUser3 = new User(keyring, "//Charlie");
  const testUser4 = new User(keyring, "//Eve");
  const testUser5 = new User(keyring, "//Dave");
  const testUser6 = new User(keyring, "//Ferdie");
  const users = [
    testUser1,
    testUser2,
    testUser3,
    testUser4,
    testUser5,
    testUser6,
  ];
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const token2 = await Assets.issueAssetToUser(sudo, amount, sudo, true);
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token2, testUser1, amount),
    Assets.mintToken(token2, testUser2, amount),
    Assets.mintToken(token2, testUser3, amount),
    Assets.mintToken(token2, testUser4, amount),
    Assets.mintToken(token2, testUser5, amount),
    Assets.mintToken(token2, testUser6, amount),
    Assets.mintNative(testUser1, amount),
    Assets.mintNative(testUser2, amount),
    Assets.mintNative(testUser3, amount),
    Assets.mintNative(testUser4, amount),
    Assets.mintNative(testUser5, amount),
    Assets.mintNative(testUser6, amount),
  );
  const liqId = token2;
  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Sudo.sudoAs(
      testUser1,
      ProofOfStake.activateLiquidity(token2, amount.divn(10)),
    ),
    Sudo.sudoAs(
      testUser2,
      ProofOfStake.activateLiquidity(token2, amount.divn(10)),
    ),
    Sudo.sudoAs(
      testUser3,
      ProofOfStake.activateLiquidity(token2, amount.divn(10)),
    ),
    Sudo.sudoAs(
      testUser4,
      ProofOfStake.activateLiquidity(token2, amount.divn(10)),
    ),
    Sudo.sudoAs(
      testUser5,
      ProofOfStake.activateLiquidity(token2, amount.divn(10)),
    ),
    Sudo.sudoAs(
      testUser6,
      ProofOfStake.activateLiquidity(token2, amount.divn(10)),
    ),
  );
  await waitForRewards(testUser4, liqId);
  return { users, liqId, sudo, token2 };
}

export async function printAllTxsDoneByUser(userAddress: string) {
  await setupUsers();
  await setupApi();
  const api = await getApi();
  let currBlock = await getBlockNumber();
  while (currBlock > 0) {
    const blockHash = await api.rpc.chain.getBlockHash(currBlock);
    const block = await api.rpc.chain.getBlock(blockHash);

    const txs = block.block.extrinsics.filter(
      (x: any) =>
        x.signer.toString() === userAddress ||
        JSON.stringify(x).includes(userAddress),
    ) as any;
    const readabaleTxs = txs.map((x: any) => x.toHuman());
    // testLog.getLog().info("Block " + currBlock);
    if (txs.length > 0) {
      testLog.getLog().info("Block " + currBlock);
      testLog.getLog().info(JSON.stringify(readabaleTxs));
      testLog.getLog().info(JSON.stringify(txs));
    }
    currBlock--;
  }
}
export async function printUserInfo(userAddress: string) {
  setupUsers();
  await setupApi();
  const api = await getApi();
  const accountInfo = (await api.query.tokens.accounts.entries()).filter(
    (x: any) => x[0].toHuman()[0] === userAddress,
  );
  for (const id in accountInfo) {
    const tokenId = JSON.parse(JSON.stringify(accountInfo[id][0].toHuman()))[1];
    const tokenIdBn = stringToBN(tokenId.toString());
    console.info("            ");
    console.info("For token Id  [ " + tokenId + " ]");
    const tokenStatus = JSON.parse(
      JSON.stringify(accountInfo[id][1].toHuman()),
    );
    const frozen = stringToBN(tokenStatus.frozen);
    const reserved = stringToBN(tokenStatus.reserved);

    console.info("---------------: ");
    console.info("Free: " + tokenStatus.free);
    console.info("Frozen: " + tokenStatus.frozen);
    if (frozen.gt(new BN(0))) {
      const vesting = await api.query.vesting.vesting(userAddress, tokenIdBn);
      console.info("  Vesting: " + JSON.stringify(vesting.toHuman()));
    }
    console.info("Reserved: " + tokenStatus.reserved);
    if (reserved.gt(new BN(0))) {
      const liqRewards = await api.query.proofOfStake.rewardsInfo(
        userAddress,
        tokenIdBn,
      );
      const stakingInfoCandidate =
        await api.query.parachainStaking.candidateState(userAddress);
      const stakingInfoDelegator =
        await api.query.parachainStaking.delegatorState(userAddress);

      const mpl = (await getMultiPurposeLiquidityStatus(
        userAddress,
        tokenIdBn,
      )) as PalletMultipurposeLiquidityReserveStatusInfo;
      console.info("  liq Rewards :: ");
      console.info("    totalRewards " + JSON.stringify(liqRewards.toHuman()));

      console.info("  MPL status :: ");
      console.info(
        "    stakedUnactivatedReserves " + mpl.stakedUnactivatedReserves,
      );
      console.info(
        "    activatedUnstakedReserves " + mpl.activatedUnstakedReserves,
      );
      console.info(
        "   stakedAndActivatedReserves " + mpl.stakedAndActivatedReserves,
      );
      console.info("    unspentReserves " + mpl.unspentReserves);
      console.info("    relockAmount " + mpl.relockAmount);

      if (
        mpl.activatedUnstakedReserves.gt(new BN(0)) ||
        mpl.stakedAndActivatedReserves.gt(new BN(0))
      ) {
        console.info("  User has activated reserves");
      }
      if (
        (stakingInfoCandidate.value.bond !== undefined &&
          stakingInfoCandidate.value.bond.gt(new BN(0))) ||
        (stakingInfoDelegator.value.delegations !== undefined &&
          stakingInfoDelegator.value.delegations.length > 0)
      ) {
        console.info("  User has some staking business");
        console.info("    Staking info :: ");
        console.info(
          "     Candidate :: " +
            JSON.stringify(stakingInfoCandidate.value.toHuman()),
        );
        console.info(
          "     Delegator :: " +
            JSON.stringify(stakingInfoDelegator.value.toHuman()),
        );
      }

      if (mpl.unspentReserves.gt(new BN(0))) {
        console.info("  User has unspent reserves");
      }
      if (mpl.relockAmount.gt(new BN(0))) {
        console.info("  User has relock amount");
        const schedule = (await getMultiPurposeLiquidityReLockStatus(
          userAddress,
          tokenIdBn,
        )) as PalletMultipurposeLiquidityRelockStatusInfo[];
        console.info("    schedule : " + JSON.stringify(schedule));
      }
      console.info("---------------: ");
    }
  }
}
export async function burnAllTokensFromPool(liqToken: BN) {
  await setupApi();
  await setupUsers();
  const keyring = new Keyring({ type: "ethereum" });
  const testUser1 = new User(keyring, "//Bob");
  const testUser2 = new User(keyring, "//Alice");
  const testUser3 = new User(keyring, "//Charlie");
  const testUser4 = new User(keyring, "//Eve");
  const testUser5 = new User(keyring, "//Dave");
  const testUser6 = new User(keyring, "//Ferdie");
  const users = [
    testUser1,
    testUser2,
    testUser3,
    testUser4,
    testUser5,
    testUser6,
  ];
  const txs = [];
  for (let index = 0; index < users.length; index++) {
    const user = users[index];
    const amounts = await getUserBalanceOfToken(liqToken, user);
    const pool = await getLiquidityPool(liqToken);
    const burnTx = Xyk.burnLiquidity(
      pool[0],
      pool[1],
      amounts.free.add(amounts.reserved),
    );
    txs.push(Sudo.sudoAs(user, burnTx));
  }
  await Sudo.batchAsSudoFinalized(...txs);
}
export async function joinAsCandidate(
  userName = "//Charlie",
  liqId = 9,
  amount = new BN(0),
) {
  await setupUsers();
  await setupApi();
  const api = await getApi();
  const keyring = new Keyring({ type: "ethereum" });
  const liq = new BN(liqId);
  const user = new User(keyring, userName);
  const liqAssets = await api?.query.parachainStaking.stakingLiquidityTokens();
  const liqAssetsCount = [...liqAssets!.keys()].length;
  const numCollators = (await api?.query.parachainStaking.candidatePool())!
    .length;
  //const amountToJoin = new BN("5000000000000000000000");
  let amountToJoin = new BN(
    await api!.consts.parachainStaking.minCandidateStk!.toString(),
  ).addn(1234567);
  if (amount.gt(BN_ZERO)) {
    amountToJoin = amount;
  }
  console.info("amount: " + amountToJoin.toString());
  let orig = tokenOrigin;
  if (liq.gt(BN_ZERO)) {
    const tokenInPool = await (
      await getLiquidityPool(liq)
    ).filter((x) => x.gt(GASP_ASSET_ID))[0];
    const tokensToMint = await calculate_buy_price_id_rpc(
      tokenInPool,
      GASP_ASSET_ID,
      amountToJoin,
    );
    console.info("Token to  mint: " + tokensToMint.toString());
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(tokenInPool, user, amountToJoin.muln(100000)),
      Assets.mintNative(user, amountToJoin.muln(100000)),
      Sudo.sudoAs(
        user,
        Xyk.mintLiquidity(
          GASP_ASSET_ID,
          tokenInPool,
          amountToJoin.muln(2),
          amountToJoin.muln(100000),
        ),
      ),
    );
  } else {
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(BN_ZERO, user, amountToJoin.muln(100000)),
    );
    amountToJoin = amountToJoin.muln(2);
    orig = tokenOriginEnum.AvailableBalance;
  }
  await signTx(
    api,
    // @ts-ignore
    api?.tx.parachainStaking.joinCandidates(
      amountToJoin,
      liqId,
      orig,
      // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
      new BN(numCollators),
      // @ts-ignore
      new BN(liqAssetsCount),
    ),
    user.keyRingPair,
  );
}
export async function joinAFewCandidates(numCandidates = 50, liqId = 9) {
  await setupUsers();
  await setupApi();
  const api = await getApi();
  const keyring = new Keyring({ type: "ethereum" });
  const liq = new BN(liqId);
  const amountToJoin = new BN(
    await api!.consts.parachainStaking.minCandidateStk!.toString(),
  ).addn(1234);

  console.info("amount: " + amountToJoin.toString());
  const liqAssets = await api?.query.parachainStaking.stakingLiquidityTokens();
  const liqAssetsCount = [...liqAssets!.keys()].length;
  const numCollators = (await api?.query.parachainStaking.candidatePool())!
    .length;
  //const amountToJoin = new BN("5000000000000000000000");
  const tokenInPool = await (
    await getLiquidityPool(liq)
  ).filter((x) => x.gt(GASP_ASSET_ID))[0];
  const totalIssuance = new BN(await api.query.tokens.totalIssuance(liq));
  const mgx = await getBalanceOfPool(GASP_ASSET_ID, tokenInPool);
  const minLiqToJoin = amountToJoin.mul(totalIssuance).div(mgx[0][0]);
  console.info("amount " + amountToJoin.toString());
  console.info("issuance " + totalIssuance.toString());
  console.info("mgx in pool" + mgx[0][0]);

  console.info("users must set " + minLiqToJoin.toString());
  let tokensToMint = await calculate_buy_price_id_rpc(
    tokenInPool,
    GASP_ASSET_ID,
    amountToJoin,
  );
  if (tokensToMint.eqn(0)) {
    tokensToMint = amountToJoin.muln(10000);
  }
  const txs = [];
  const users = [];
  for (let index = 0; index < numCandidates; index++) {
    const user = new User(keyring);
    users.push(user);
    txs.push(Assets.mintToken(tokenInPool, user, tokensToMint.muln(500)));
    txs.push(Assets.mintNative(user, amountToJoin.muln(500)));
    txs.push(
      Sudo.sudoAs(
        user,
        Xyk.mintLiquidity(
          GASP_ASSET_ID,
          tokenInPool,
          amountToJoin.muln(10),
          MAX_BALANCE,
        ),
      ),
    );
  }
  await Sudo.batchAsSudoFinalized(...txs);
  const joins = [];
  for (let index = 0; index < numCandidates; index++) {
    joins.push(
      signTx(
        api,
        // @ts-ignore
        api?.tx.parachainStaking.joinCandidates(
          minLiqToJoin.addn(10000).addn(index * 2000),
          liqId,
          tokenOrigin,
          // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
          new BN(numCollators).addn(index),
          // @ts-ignore
          new BN(liqAssetsCount),
        ),
        users[index].keyRingPair,
      ),
    );
  }
  await Promise.all(joins);
}
export async function giveTokensToUser(userName = "//Charlie", liqId = 9) {
  await setupUsers();
  await setupApi();
  const api = await getApi();
  const keyring = new Keyring({ type: "ethereum" });
  const liq = new BN(liqId);
  const user = new User(keyring, userName);
  const amountToJoin = new BN(
    api!.consts.parachainStaking.minCollatorStk!.toString(),
  ).addn(1234);
  const pool = await getLiquidityPool(liq);
  if (pool.length > 0) {
    const tokenInPool = await (
      await getLiquidityPool(liq)
    ).filter((x) => x.gt(GASP_ASSET_ID))[0];
    const tokensToMint = await calculate_buy_price_id_rpc(
      tokenInPool,
      GASP_ASSET_ID,
      amountToJoin,
    );
    console.info("Token to  mint: " + tokensToMint.toString());
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(tokenInPool, user, tokensToMint.muln(100)),
      Assets.mintNative(user, amountToJoin.muln(100000)),
      Sudo.sudoAs(
        user,
        Xyk.mintLiquidity(
          GASP_ASSET_ID,
          tokenInPool,
          amountToJoin.muln(2),
          tokensToMint.muln(4),
        ),
      ),
    );
  } else {
    await Sudo.batchAsSudoFinalized(Assets.mintToken(liq, user));
  }
}
export async function fillWithDelegators(
  numDelegators: number,
  liqToken: number,
  targetAddress: string,
) {
  await setupUsers();
  await setupApi();
  const api = await getApi();
  const keyring = new Keyring({ type: "ethereum" });
  const liq = new BN(liqToken);
  const amountToJoin = new BN(
    api!.consts.parachainStaking.minDelegation!.toString(),
  ).addn(1234);
  //const liqAssets = await api?.query.parachainStaking.stakingLiquidityTokens();
  //const liqAssetsCount = [...liqAssets!.keys()].length;
  const candidateDelegationCount = JSON.parse(
    JSON.stringify(
      (await api?.query.parachainStaking.candidateState(targetAddress))!,
    ),
  ).delegators.length;
  const totalDelegators = JSON.parse(
    JSON.stringify(await api?.query.parachainStaking.delegatorState.entries()),
  ).length;
  //const amountToJoin = new BN("5000000000000000000000");
  const tokenInPool = await (
    await getLiquidityPool(liq)
  ).filter((x) => x.gt(GASP_ASSET_ID))[0];
  if (!liq.eqn(0)) {
    let tokensToMint = await calculate_buy_price_id_rpc(
      tokenInPool,
      GASP_ASSET_ID,
      amountToJoin,
    );
    if (tokensToMint.eqn(0)) {
      tokensToMint = amountToJoin.muln(10000);
    }
    const txs = [];
    const users = [];
    for (let index = 0; index < numDelegators; index++) {
      const user = new User(keyring);
      users.push(user);
      txs.push(Assets.mintToken(tokenInPool, user, tokensToMint.muln(100)));
      txs.push(Assets.mintNative(user, amountToJoin.muln(100000)));
      txs.push(
        Sudo.sudoAs(
          user,
          Xyk.mintLiquidity(
            GASP_ASSET_ID,
            tokenInPool,
            amountToJoin.muln(2),
            MAX_BALANCE,
          ),
        ),
      );
    }
    await Sudo.batchAsSudoFinalized(...txs);
    const joins = [];
    for (let index = 0; index < numDelegators; index++) {
      joins.push(
        signTx(
          api,
          // @ts-ignore
          api?.tx.parachainStaking.delegate(
            targetAddress,
            amountToJoin.subn(10),
            tokenOrigin,
            // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
            new BN(candidateDelegationCount).addn(index),
            // @ts-ignore
            new BN(totalDelegators).addn(index),
          ),
          users[index].keyRingPair,
        ),
      );
    }
    await Promise.all(joins);
  } else {
    const tokensToMint = amountToJoin.muln(10000);
    const txs = [];
    const users = [];
    for (let index = 0; index < numDelegators; index++) {
      const user = new User(keyring);
      users.push(user);
      txs.push(Assets.mintNative(user, tokensToMint));
    }
    await Sudo.batchAsSudoFinalized(...txs);
    const joins = [];
    for (let index = 0; index < numDelegators; index++) {
      joins.push(
        signTx(
          api,
          // @ts-ignore
          api?.tx.parachainStaking.delegate(
            targetAddress,
            amountToJoin.muln(3),
            "AvailableBalance",
            // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
            new BN(candidateDelegationCount).addn(index),
            // @ts-ignore
            new BN(totalDelegators).addn(index),
          ),
          users[index].keyRingPair,
        ),
      );
    }
    await Promise.all(joins);
  }
}

export async function printCandidatesNotProducing(): Promise<void> {
  await setupUsers();
  await setupApi();
  const api = await getApi();

  const session = await api.query.session.currentIndex();
  const candidates = await api.query.parachainStaking.selectedCandidates();
  const missingCandidates: string[] = [];
  for (let index = 0; index < candidates.length; index++) {
    const sessionBefore = Number(session.toString()) - 1;
    const awardedPointsPreviousSession =
      await api.query.parachainStaking.awardedPts(
        sessionBefore,
        candidates[index],
      );
    if (Number(awardedPointsPreviousSession) === 0) {
      missingCandidates.push(candidates[index].toString());
    }
  }
  console.info("*****************");
  console.info(`Found ${candidates.length}  candidates`);
  console.info(
    `On session  ${Number(session.toString()) - 1}, ${
      missingCandidates.length
    } did not win any point`,
  );
  console.info(missingCandidates);
  console.info("*****************");
}

export async function createCustomPool(div = true, ratio = 1, user = "//Bob") {
  await setupApi();
  await setupUsers();
  const amount = (await api?.consts.parachainStaking.minCandidateStk)?.muln(
    1000,
  )!;
  const keyring = new Keyring({ type: "ethereum" });
  const testUser1 = new User(keyring, user);
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const token2 = await Assets.issueAssetToUser(
    sudo,
    amount.muln(ratio),
    sudo,
    true,
  );
  let tx;
  if (div) {
    tx = Sudo.sudoAs(
      testUser1,
      Xyk.createPool(GASP_ASSET_ID, amount, token2, amount.divn(ratio)),
    );
  } else {
    tx = Sudo.sudoAs(
      testUser1,
      Xyk.createPool(GASP_ASSET_ID, amount, token2, amount.muln(ratio)),
    );
  }
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token2, testUser1, amount),
    Assets.mintNative(testUser1, amount),
    tx,
  );
}
export function getStorageKey(
  moduleName: string,
  storageItemName: string,
): string {
  return (
    xxhashAsHex(moduleName, 128) +
    stripHexPrefix(xxhashAsHex(storageItemName, 128))
  );
}
export function stripHexPrefix(str: string): string {
  return isHexPrefixed(str) ? str.slice(2) : str;
}
function isHexPrefixed(str: string): boolean {
  return str.slice(0, 2) === "0x";
}
export async function subscribeAndPrintTokenChanges(
  ws = "ws://127.0.0.1:9946",
  skipTokenId = 0,
) {
  await setupApi();
  await setupUsers();
  await initApi(ws);
  const api = await getApi();
  type Tokens = { free: BN; reserved: BN; frozen: BN };
  function getPrint(user: string, tokens: Tokens) {
    return `${user} -- free: ${tokens.free}, reserved: ${tokens.reserved}, frozen: ${tokens.frozen}`;
  }
  const currentState = new Map<string, Tokens>();
  await api!.rpc.chain.subscribeNewHeads(async (lastHeader) => {
    //console.log("#" + lastHeader.number);
    await api.query.tokens.accounts.entries(async (storageKey: any) => {
      storageKey.forEach((element: { toHuman: () => any }[]) => {
        const user = element[0].toHuman()[0] + "-" + element[0].toHuman()[1];
        if (Number(element[0].toHuman()[1]) !== skipTokenId) {
          const status = {
            free: hexToBn(JSON.parse(element[1].toString()).free),
            reserved: hexToBn(JSON.parse(element[1].toString()).reserved),
            frozen: hexToBn(JSON.parse(element[1].toString()).frozen),
          } as Tokens;
          if (currentState.get(user) === undefined) {
            console.log(lastHeader.number + "#" + getPrint(user, status));
            currentState.set(user, {
              free: status.free,
              reserved: status.reserved,
              frozen: status.frozen,
            } as Tokens);
          } else {
            if (
              !(
                status.free.eq(currentState.get(user)!.free) &&
                status.frozen.eq(currentState.get(user)!.frozen) &&
                status.reserved.eq(currentState.get(user)!.reserved)
              )
            ) {
              console.log(
                "Substrate-" +
                  lastHeader.number +
                  "#" +
                  " BEFORE:" +
                  getPrint(user, currentState.get(user)!),
              );
              const diffSentence = `Diff: free: ${new BN(status.free).sub(
                new BN(currentState.get(user)!.free),
              )} - , reserved: ${new BN(status.reserved).sub(
                new BN(currentState.get(user)!.reserved),
              )} - , frozen: ${new BN(status.frozen).sub(
                new BN(currentState.get(user)!.frozen),
              )} `;
              currentState.set(user, status);
              console.log(
                "Substrate-" +
                  lastHeader.number +
                  "#" +
                  "  AFTER:" +
                  getPrint(user, currentState.get(user)!),
              );
              console.log(lastHeader.number + "# " + diffSentence);
            }
          }
        }
      });
    });
  });
}

export async function findAllRewardsAndClaim() {
  await setupUsers();
  await setupApi();
  const keyring = new Keyring({ type: "ethereum" });
  let liqTokenId: BN;
  let rewardAmount: BN;

  type RewardsInfo = {
    tokenId: BN;
    activatedAmount: BN;
    lastCheckpoint: BN;
    missingAtLastCheckpoint: BN;
    poolRatioAtLastCheckpoint: BN;
    rewardsAlreadyClaimed: BN;
    rewardsNotYetClaimed: BN;
  };

  const usersInfo: any = [];
  const extrinsicCall = [];
  const { chainUri } = getEnvironmentRequiredVars();
  const mangata = await getMangataInstance(chainUri);

  const accountsResponse = await api!.query.proofOfStake.rewardsInfo.entries();

  await accountsResponse.forEach((element: { toHuman: () => any }[]) => {
    const user = element[0].toHuman()[0];
    const status = {
      tokenId: new BN(element[0].toHuman()[1]),
      activatedAmount: hexToBn(
        JSON.parse(element[1].toString()).activatedAmount,
      ),
      lastCheckpoint: hexToBn(JSON.parse(element[1].toString()).lastCheckpoint),
      missingAtLastCheckpoint: hexToBn(
        JSON.parse(element[1].toString()).missingAtLastCheckpoint,
      ),
      poolRatioAtLastCheckpoint: hexToBn(
        JSON.parse(element[1].toString()).poolRatioAtLastCheckpoint,
      ),
      rewardsAlreadyClaimed: hexToBn(
        JSON.parse(element[1].toString()).rewardsAlreadyClaimed,
      ),
      rewardsNotYetClaimed: hexToBn(
        JSON.parse(element[1].toString()).rewardsNotYetClaimed,
      ),
    } as RewardsInfo;
    usersInfo.push([user, status]);
  });
  const promotedPairNumber = usersInfo.length;
  const user = new User(keyring);
  for (let index = 0; index < promotedPairNumber; index++) {
    function getPrint(user: string, tokens: RewardsInfo) {
      return (
        user +
        "-- tokenID: " +
        tokens.tokenId.toString() +
        ", missingAtLastCheckpoint: " +
        tokens.missingAtLastCheckpoint.toString() +
        ", alreadyClaimed: " +
        tokens.rewardsAlreadyClaimed +
        ", notYetClaimed:" +
        tokens.rewardsNotYetClaimed
      );
    }
    user.addFromAddress(keyring, usersInfo[index][0]);
    liqTokenId = new BN(usersInfo[index][1].tokenId);
    rewardAmount = await mangata.rpc.calculateRewardsAmount({
      address: user.keyRingPair.address,
      liquidityTokenId: liqTokenId.toString(),
    });
    if (rewardAmount) {
      console.info(getPrint(usersInfo[index][0], usersInfo[index][1]));
      extrinsicCall.push(
        Sudo.sudoAs(user, ProofOfStake.claimRewardsAll(liqTokenId)),
      );
    }
  }
  let txs: Extrinsic[] = [];
  for (let index = 0; index < extrinsicCall.length; index++) {
    const tx = extrinsicCall[index];
    txs.push(tx);
    if (txs.length > 100) {
      const methodSudoAsDone = (await Sudo.batchAsSudoFinalized(...txs)).filter(
        (extrinsicResult) => extrinsicResult.method === "SudoAsDone",
      );
      txs = [];
      methodSudoAsDone.forEach((element: any) => {
        if (element.event.data[0].isErr !== false) {
          console.log("ERROR:" + JSON.stringify(element.event.data[0]));
        }
        assert(element.event.data[0].isErr === false);
      });
    }
  }
  const methodSudoAsDone = (await Sudo.batchAsSudoFinalized(...txs)).filter(
    (extrinsicResult) => extrinsicResult.method === "SudoAsDone",
  );
  methodSudoAsDone.forEach((element: any) => {
    if (element.event.data[0].isErr !== false) {
      console.log("ERROR:" + JSON.stringify(element.event.data[0]));
    }
    assert(element.event.data[0].isErr === false);
  });
}

export async function getTokensAccountDataStorage(ws = "ws://127.0.0.1:9946") {
  await setupApi();
  await setupUsers();
  await initApi(ws);
  const api = await getApi();
  const allPallets = await listStorages(ws);
  const storageToListen = allPallets
    .filter((x: any) => x[0] === "Tokens")
    .flatMap((item: any) =>
      item[1].map((element: any) => {
        return [item[0], element];
      }),
    );
  console.info(JSON.stringify(storageToListen));

  for (let dataId = 0; dataId < storageToListen.length; dataId++) {
    const key = getStorageKey(
      storageToListen[dataId][0],
      storageToListen[dataId][1],
    );
    const allKeys = [];
    let cont = true;
    let keys = await api.rpc.state.getKeysPaged(key, 100);
    while (cont) {
      for (let index = 0; index < keys.length; index++) {
        const storage = await api.rpc.state.getStorage<Codec>(keys[index]);
        allKeys.push([keys[index], storage]);
      }
      const nextkeys = await api.rpc.state.getKeysPaged(key, 100, keys[99]);
      if (nextkeys.includes(keys[99]) || nextkeys.length === 0) {
        cont = false;
      } else {
        keys = nextkeys;
      }
      keys.forEach(async (value) => {
        const storage = await api.rpc.state.getStorage<Codec>(value);
        allKeys.push([value, storage]);
        console.info(value.toString());
        console.info(storage.toString());
      });
    }
  }
}
export async function testTokensForUsers(userName = "//Eve") {
  await setupApi();
  await setupUsers();
  const api = await getApi();
  const keyring = new Keyring({ type: "ethereum" });
  const user = new User(keyring, userName);
  const availableAssetsInfo = await api.query.assetRegistry.metadata.entries();
  const tokens: any[] = [];
  availableAssetsInfo.forEach((tokenEntry) => {
    tokens.push([(tokenEntry[0].toHuman() as [1])[0], tokenEntry[1].toHuman()]);
  });
  const txs: Extrinsic[] = [];
  tokens.forEach((token: any) => {
    if (
      !(JSON.parse(JSON.stringify(token[1])).name as string).includes(
        "Liquidity",
      )
    ) {
      txs.push(Assets.mintToken(new BN(token[0]), user));
    }
  });
  await Sudo.batchAsSudoFinalized(...txs);
}
export async function createProposal() {
  await setupApi();
  await setupUsers();
  const dict = {
    "5G22cv9fT5RNVm2AV4MKgagmKH9aoZL4289UDcYrToP9K6hQ": 2000000000000,
    "5GbtrMJi2MV3oDMpXnkCjNHErDHfmwN6AS4E7JCtsqsABU86": 2000000000000,
    "5HKgtV7xNbKQyX4RZeTA5gtpZZZb67fay4kfjDhgjzdPe6ap": 100000000000,
    "5FZKwNzhMiKzqAmSepiTQSSxx8cfM5kJmnAJT4R5a99LZvRh": 600000000000,
    "5EAP8iPdRrPA6qjqcVZm7LobYd7Qy9r3JddaEs4uLKVChzC6": 2245583936554,
    "5HnHFaFWkVkHfxf4J6Pwh7xyjJFHTjm78kC29oALhG1WkRK5": 2264063755235,
    "5FTexk7oF68CohbR2DDyr2k6sBEyktNLFVZCCzGEfrcheCXM": 361400000000,
    "5E2KX6jQi2w63MS4srza3nCMRkVwLnWYT1yp9gB6rPY9JAFa": 235000000000,
    "5CZpuyTyEGBKFBRu7ebyTp9q97jxKuyejrAGXZJwUQ17PHAk": 20000000000,
    "5CzMGHQAz9LT2CmuNTRAmvbwsdeJzCAvQYDmj3K6h6pLcUXK": 9361013561421,
    "5H92NmUsAvVRpc6UC38SnU2RDX1fMyxAxzLL65uvqAFBynkH": 183051308897,
    "5GYknXBBRKfRXYYBc1f8xhm15UrR3kLV9kMayqYr86sKRfT5": 1242738580000,
  };
  const dict2 = {
    "5CZpuyTyEGBKFBRu7ebyTp9q97jxKuyejrAGXZJwUQ17PHAk": 1286000000000,
    "5G22cv9fT5RNVm2AV4MKgagmKH9aoZL4289UDcYrToP9K6hQ": 9000000000000,
    "5FZKwNzhMiKzqAmSepiTQSSxx8cfM5kJmnAJT4R5a99LZvRh": 53000000000000,
  };
  const txs: Extrinsic[] = [];
  Object.keys(dict).forEach((account) => {
    txs.push(
      Assets.mintTokenAddress(
        KSM_ASSET_ID,
        account,
        //@ts-ignore
        new BN(dict[account]!),
      ),
    );
  });
  Object.keys(dict2).forEach((account) => {
    txs.push(
      //@ts-ignore
      Assets.mintTokenAddress(KSM_ASSET_ID, account, new BN(dict2[account]!)),
    );
  });
  await Sudo.batch(...txs);
}
export async function migrate() {
  await setupApi();
  await setupUsers();
  await initApi("wss://kusama-archive.mangata.online");
  const api = await getApi();
  const allPallets = await listStorages();
  const storageToMigrate1 = allPallets
    .filter(
      (x: any) =>
        x[0] === "AssetRegistry" ||
        x[0] === "Tokens" ||
        x[0] === "Issuance" ||
        x[0] === "Xyk",
    )
    .flatMap((item: any) =>
      item[1].map((element: any) => {
        return [item[0], element];
      }),
    )
    .sort((a: any, b: any) => {
      if (a[0] === "AssetRegistry" && b[0] !== "AssetRegistry") {
        return -1;
      } else if (a[0] !== "AssetRegistry" && b[0] === "AssetRegistry") {
        return 1;
      } else {
        return 0;
      }
    });
  const storageToMigrate2 = allPallets
    .filter(
      (x: any) =>
        x[0] === "ProofOfStake" ||
        x[0] === "MultiPurposeLiquidity" ||
        x[0] === "RewardsInfo" ||
        x[0] === "Vesting" ||
        x[0] === "Bootstrap" ||
        x[0] === "OrmlXcm" ||
        x[0] === "Crowdloan",
      //  x[0] === "System",
    )
    .flatMap((item: any) =>
      item[1].map((element: any) => {
        return [item[0], element];
      }),
    )
    .sort((a: any, b: any) => {
      if (a[0] === "ProofOfStake" && b[0] !== "ProofOfStake") {
        return -1;
      } else if (a[0] !== "ProofOfStake" && b[0] === "ProofOfStake") {
        return 1;
      } else {
        return 0;
      }
    });
  const storageToMigrate = (storageToMigrate1 as []).concat(storageToMigrate2);
  console.info(JSON.stringify(storageToMigrate2));
  //  const data = [
  //    ["Xyk", "RewardsInfo"],
  //    ["Xyk", "LiquidityMiningUser"],
  //    ["Xyk", "LiquidityMiningPool"],
  //    ["Xyk", "LiquidityMiningUserToBeClaimed"],
  //    ["Xyk", "LiquidityMiningActiveUser"],
  //    ["Xyk", "LiquidityMiningActivePool"],
  //    ["Xyk", "LiquidityMiningUserClaimed"],
  //    ["Xyk", "LiquidityMiningActivePoolV2"],
  //  ];

  for (let dataId = 0; dataId < storageToMigrate.length; dataId++) {
    const key = getStorageKey(
      storageToMigrate[dataId][0],
      storageToMigrate[dataId][1],
    );
    console.warn(
      "::: starting with :::" + JSON.stringify(storageToMigrate[dataId]),
    );
    await initApi("wss://kusama-archive.mangata.online");
    let allKeys = [];
    let cont = true;
    let keys = await api.rpc.state.getKeysPaged(key, 100);
    let loop: number = 0;
    while (cont) {
      for (let index = 0; index < keys.length; index++) {
        const storage = await api.rpc.state.getStorage<Codec>(keys[index]);
        allKeys.push([keys[index], storage]);
      }
      console.info("Found:" + JSON.stringify(allKeys.length));
      const nextkeys = await api.rpc.state.getKeysPaged(
        key,
        100,
        keys[keys.length - 1],
      );
      if (loop % 8 === 0) {
        const txs: Extrinsic[] = [];
        allKeys.forEach((x) => {
          const storageKey = api.createType("StorageKey", x[0]);
          const storageData = api.createType("StorageData", x[1].toHex());
          const tx = api.tx.system.setStorage([
            [storageKey, storageData] as ITuple<[StorageKey, Bytes]>,
          ]);
          txs.push(Sudo.sudo(tx));
        });
        await Sudo.batchAsSudoFinalized(...txs);
        allKeys = [];
      }
      if (nextkeys.includes(keys[keys.length - 1]) || nextkeys.length === 0) {
        cont = false;
      } else {
        keys = nextkeys;
      }
      loop++;
    }
    const txs: Extrinsic[] = [];
    allKeys.forEach((x) => {
      const storageKey = api.createType("StorageKey", x[0]);
      const storageData = api.createType("StorageData", x[1].toHex());
      const tx = api.tx.system.setStorage([
        [storageKey, storageData] as ITuple<[StorageKey, Bytes]>,
      ]);
      txs.push(Sudo.sudo(tx));
    });

    await Sudo.batchAsSudoFinalized(...txs);
  }
}
export async function listStorages(ws = "wss://kusama-archive.mangata.online") {
  await setupApi();
  await setupUsers();
  await initApi(ws);
  const api = await getApi();
  const meta = await api.rpc.state.getMetadata();
  const metaJson = JSON.parse(JSON.stringify(meta));
  const res = jsonpath.query(metaJson, "$..pallets[*].name");
  const result: any = [];
  res.forEach((pallet) => {
    const storageItems = jsonpath.query(
      metaJson,
      `$..pallets[?(@.name =="${pallet}")].storage.items[*].name`,
    );
    result.push([pallet, storageItems]);
  });
  console.info(result);
  return result;
}
export async function provisionWith100Users() {
  const tokenId = new BN(4);
  const secToken = new BN(9);
  await setupUsers();
  await setupApi();
  for (let loop = 0; loop < 10; loop++) {
    const users = [];
    let txs = [];
    const keyring = new Keyring({ type: "ethereum" });
    for (let index = 0; index < 50; index++) {
      const user = new User(keyring);
      users.push(user);
      txs.push(Assets.mintToken(tokenId, user, Assets.MG_UNIT.muln(100)));
      txs.push(Assets.mintNative(user, Assets.MG_UNIT.muln(100000)));
      txs.push(
        Sudo.sudoAs(
          user,
          Bootstrap.provision(tokenId, Assets.MG_UNIT.muln(10)),
        ),
      );
    }
    await Sudo.batchAsSudoFinalized(...txs);
    txs = [];
    for (let index = 0; index < 50; index++) {
      const user = new User(keyring);
      users.push(user);
      txs.push(Assets.mintToken(secToken, user, Assets.MG_UNIT.muln(100)));
      txs.push(Assets.mintNative(user, Assets.MG_UNIT.muln(100000)));
      txs.push(
        Sudo.sudoAs(
          user,
          Bootstrap.provision(secToken, Assets.MG_UNIT.muln(10)),
        ),
      );
    }
    await Sudo.batchAsSudoFinalized(...txs);
  }
}
export async function userAggregatesOn(
  userAggregating: string,
  userWhoDelegates: string,
) {
  await setupApi();
  await setupUsers();
  const tx1 = Sudo.sudoAsWithAddressString(
    userAggregating,
    Staking.aggregatorUpdateMetadata(
      [userWhoDelegates],
      AggregatorOptions.ExtendApprovedCollators,
    ),
  );
  const tx2 = Sudo.sudoAsWithAddressString(
    userWhoDelegates,
    Staking.updateCandidateAggregator(userAggregating),
  );
  await Sudo.batchAsSudoFinalized(tx1, tx2);
}

export interface RPCParam {
  paramType: string;
  paramValue: any;
}

export async function replaceByStateCall(
  method: string = "calculate_rewards_amount",
  params: RPCParam[] = [
    {
      paramType: "AccountId",
      paramValue: "5DLP5KLo3oPF8angc8VtxuMZ1CRt5ViM9AMiQokr5XPUXnJR",
    },
    { paramType: "TokenId", paramValue: "8" },
  ],
  module = "xyk",
  returnType = "XYKRpcResult",
) {
  await setupApi();
  await setupUsers();
  const api = await getApi();
  let encodedStr = "0x";
  params.forEach((item) => {
    encodedStr += api
      .createType(item.paramType, item.paramValue)
      .toHex(true)
      .replace("0x", "");
  });
  let res: any;
  if (module === "xyk") {
    console.log(method);
    console.log(encodedStr);
    res = await api.rpc.state.call(`XykApi_${method}`, encodedStr);
  }
  const parsed = api.createType(returnType, res);
  console.log(JSON.parse(JSON.stringify(parsed)));
}

export async function activateAndClaim3rdPartyRewardsForUser(
  userName = "//Charlie",
) {
  await setupApi();
  await setupUsers();
  const mangata = await getMangataInstance();
  const keyring = new Keyring({ type: "ethereum" });
  const testUser = new User(keyring, userName);
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const [newToken, newToken2] = await Assets.setupUserWithCurrencies(
    sudo,
    [Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT],
    sudo,
    true,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(newToken2, testUser, Assets.DEFAULT_AMOUNT.muln(40e6)),
    Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
    Assets.mintToken(newToken, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
    Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.muln(1e6),
        newToken,
        Assets.DEFAULT_AMOUNT.muln(1e6),
      ),
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT,
        newToken2,
        Assets.DEFAULT_AMOUNT,
      ),
    ),
  );
  const liqId = await getLiquidityAssetId(GASP_ASSET_ID, newToken2);
  await promotePool(sudo.keyRingPair, liqId, 20);
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      sudo,
      await ProofOfStake.rewardPool(
        newToken2,
        GASP_ASSET_ID,
        newToken,
        Assets.DEFAULT_AMOUNT.muln(1e6),
        2,
      ),
    ),
    Sudo.sudoAs(
      testUser,
      await ProofOfStake.activateLiquidityFor3rdpartyRewards(
        liqId,
        Assets.DEFAULT_AMOUNT.divn(2),
        newToken,
      ),
    ),
  );
  await waitForRewards(testUser, liqId, 30, newToken);
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser,
      await ProofOfStake.claim3rdpartyRewards(liqId, newToken),
    ),
  );
  const userRewardsTokenBalance = (
    await mangata.query.getTokenBalance(
      newToken.toString(),
      testUser.keyRingPair.address,
    )
  ).free;

  testLog
    .getLog()
    .info(
      "3rd party rewards were activated and claimed for user " +
        testUser.name.toString() +
        ", liquidity token's ID is " +
        liqId.toString() +
        ",  rewards token's ID is " +
        newToken.toString() +
        " and the amount of rewards is " +
        userRewardsTokenBalance.toString(),
    );
}

export async function addActivatedLiquidityFor3rdPartyRewards(
  liqId: BN,
  rewardToken: BN,
  tokenAmount: BN,
  userName = "//Alice",
) {
  await setupApi();
  await setupUsers();
  const keyring = new Keyring({ type: "ethereum" });
  const user = new User(keyring, userName);

  await Sudo.batchAsSudoFinalized(Assets.mintToken(liqId, user, tokenAmount));

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      user,
      await ProofOfStake.activateLiquidityFor3rdpartyRewards(
        liqId,
        tokenAmount,
        rewardToken,
      ),
    ),
  );

  console.log(
    "activated 3rd party rewards liquidity for user " +
      user.name.toString() +
      " was added, liquidity Id is " +
      liqId.toString() +
      ",  rewards token's ID is " +
      rewardToken.toString() +
      " and the amount of token is " +
      tokenAmount.toString(),
  );
}

export async function addActivatedLiquidityForNativeRewards(
  liqId: BN,
  tokenValue: BN,
  userName = "//Alice",
) {
  await setupApi();
  await setupUsers();
  const keyring = new Keyring({ type: "ethereum" });
  const user = new User(keyring, userName);

  await Sudo.batchAsSudoFinalized(Assets.mintToken(liqId, user, tokenValue));

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      user,
      await ProofOfStake.activateLiquidityForNativeRewards(liqId, tokenValue),
    ),
  );

  console.log(
    "activated Native rewards liquidity for user " +
      user.name.toString() +
      " was added, liquidity Id is " +
      liqId.toString() +
      " and the amount of token is " +
      tokenValue.toString(),
  );
}

export async function addStakedUnactivatedReserves(
  userName = "//Alice",
  tokenId = 1,
) {
  await setupApi();
  await setupUsers();
  let liqToken: BN;
  const api = await getApi();
  const keyring = new Keyring({ type: "ethereum" });
  const tokenAmount = new BN(
    await api.consts.parachainStaking.minCandidateStk.toString(),
  ).muln(100);
  const user = new User(keyring, userName);
  const userCandidateStateBefore =
    await api?.query.parachainStaking.candidateState(user.keyRingPair.address);
  const userCandidateBond = new BN(userCandidateStateBefore.value.bond);
  if (userCandidateBond > BN_ZERO) {
    console.error("User is already a candidate");
    process.exit(1);
  }
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  if (tokenId === 1) {
    const [newToken] = await Assets.setupUserWithCurrencies(
      user,
      [tokenAmount],
      sudo,
    );
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user, tokenAmount.muln(2)),
      Assets.mintNative(sudo, tokenAmount.muln(2)),
      Sudo.sudoAs(
        user,
        Xyk.createPool(GASP_ASSET_ID, tokenAmount, newToken, tokenAmount),
      ),
    );
    liqToken = await getLiquidityAssetId(GASP_ASSET_ID, newToken);
  } else {
    liqToken = new BN(tokenId);
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user, tokenAmount.muln(2)),
      Assets.mintToken(liqToken, user, tokenAmount.muln(2)),
    );
  }
  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(Staking.addStakingLiquidityToken(liqToken)),
  );
  const liqTokensAmount = hexToBn(
    (await user.getUserTokensAccountInfo(liqToken)).free,
  );
  const liqTokenNumber = await toNumber(liqToken);
  const numCollators = await SudoDB.getInstance().getNextCandidateNum();
  const liqAssets = await api?.query.parachainStaking.stakingLiquidityTokens();
  const liqAssetsCount = [...liqAssets!.keys()].length + 10;
  await signTx(
    api,
    api?.tx.parachainStaking.joinCandidates(
      liqTokensAmount,
      liqTokenNumber,
      tokenOriginEnum.AvailableBalance,
      new BN(numCollators + 10),
      new BN(liqAssetsCount),
    ),
    user.keyRingPair,
  );
  const mplStatus = await getMultiPurposeLiquidityStatus(
    user.keyRingPair.address,
    liqToken,
  );
  console.log(
    "Amount of staked liqToken " +
      liqToken.toString() +
      " for user " +
      user.name.toString() +
      " is " +
      mplStatus.stakedUnactivatedReserves.toString(),
  );
}

export async function addUnspentReserves(userName = "//Alice", tokenId = 1) {
  await setupApi();
  await setupUsers();
  let liqToken: BN;
  let assetID: BN;
  const keyring = new Keyring({ type: "ethereum" });
  const user = new User(keyring, userName);
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  if (tokenId === 1) {
    [assetID] = await Assets.setupUserWithCurrencies(
      sudo,
      [Assets.DEFAULT_AMOUNT],
      sudo,
    );
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(assetID, user, Assets.DEFAULT_AMOUNT.muln(2)),
      Assets.mintNative(user, Assets.DEFAULT_AMOUNT.muln(2)),
      Sudo.sudoAs(
        user,
        Xyk.createPool(
          GASP_ASSET_ID,
          Assets.DEFAULT_AMOUNT,
          assetID,
          Assets.DEFAULT_AMOUNT,
        ),
      ),
    );
    liqToken = await getLiquidityAssetId(GASP_ASSET_ID, assetID);
  } else {
    assetID = new BN(tokenId);
    liqToken = await getLiquidityAssetId(GASP_ASSET_ID, assetID);
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user),
      Assets.mintToken(liqToken, user, Assets.DEFAULT_AMOUNT.muln(2)),
    );
  }
  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(Staking.addStakingLiquidityToken(liqToken)),
    Sudo.sudo(
      await Vesting.forceVested(
        sudo.keyRingPair.address,
        user,
        Assets.DEFAULT_AMOUNT.divn(2),
        GASP_ASSET_ID,
        100,
      ),
    ),
    Assets.promotePool(liqToken.toNumber(), 20),
    Sudo.sudoAs(
      user,
      Xyk.mintLiquidityUsingVested(
        assetID,
        Assets.DEFAULT_AMOUNT.divn(2),
        Assets.DEFAULT_AMOUNT,
      ),
    ),
    Sudo.sudoAs(
      user,
      MPL.reserveVestingLiquidityTokensByVestingIndex(liqToken),
    ),
  );
  const mplStatus = await getMultiPurposeLiquidityStatus(
    user.keyRingPair.address,
    liqToken,
  );
  console.log(
    "Amount of vesting tokens moved to MPL for liqId " +
      liqToken.toString() +
      " for user " +
      user.name.toString() +
      " is " +
      mplStatus.unspentReserves.toString(),
  );
}

export async function depositFromL1(ethAddress: string, amountValue: number) {
  const keyring = new Keyring({ type: "ethereum" });
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const mangata = await getMangataInstance();
  const sdkApi = await mangata.api();
  const requestNumber = (await getLastProcessedRequestNumber()) + 1;
  await signTx(
    sdkApi,
    await rolldownDeposit(requestNumber, ethAddress, amountValue),
    sudo.keyRingPair,
  );

  console.log(
    "Amount of tokens for the user " +
      ethAddress +
      " would be deposited in the amount of " +
      amountValue.toString(),
  );
}

export async function withdrawToL1(ethPrivateKey: string, amountValue: number) {
  const keyring = new Keyring({ type: "ethereum" });
  const testEthUser = new EthUser(keyring, ethPrivateKey);

  await signTxMetamask(
    await Withdraw(testEthUser, 100),
    testEthUser.ethAddress,
    testEthUser.privateKey,
  );

  console.log(
    "Amount of tokens of the user " +
      testEthUser.ethAddress +
      " would be withdrawn in the amount of " +
      amountValue.toString(),
  );
}

export async function signEthUserTxByMetamask(
  txHex: string,
  ethPrivateKey: string,
) {
  const api = getApi();
  const keyring = new Keyring({ type: "ethereum" });

  const testEthUser = new User(keyring, ethPrivateKey);

  const extrinsic = await api.createType("Extrinsic", txHex);
  await signTxMetamask(
    extrinsic,
    testEthUser.keyRingPair.address,
    ethPrivateKey,
  );

  console.log(
    "Extrinsic was signed by using Metamask for the user  " +
      testEthUser.ethAddress,
  );
}

export async function listenTransfers() {
  const web3 = new Web3("ws://localhost:8545");
  //@ts-ignore
  const options = {
    topics: [web3.utils.sha3("Transfer(address,address,uint256)")],
  };

  const subscription =
    // @ts-ignore
    web3.eth.subscribe("logs", options);

  (await subscription).on("data", (trxData: any) => {
    if (trxData.topics.length === 3) {
      function formatAddress(data: any) {
        const step1 = web3.utils.hexToBytes(data);
        const res = web3.utils.hexToBytes(data).reverse();
        for (let i = 0; i < step1.length; i++) {
          if (step1[i] !== 0) {
            //@ts-ignore
            return web3.utils.bytesToHex(step1.slice(i));
          }
        }
        return web3.utils.bytesToHex(res.reverse());
      }

      console.log("ETH- Register new transfer: " + trxData.transactionHash);
      console.log(
        "ETH- Contract " +
          trxData.address +
          " has transaction of " +
          web3.utils.hexToNumberString(trxData.data) +
          " from " +
          formatAddress(trxData.topics["1"]) +
          " to " +
          formatAddress(trxData.topics["2"]),
      );
      //console.log(trxData);

      web3.eth.getTransactionReceipt(
        trxData.transactionHash,
        // @ts-ignore
        function (error, reciept) {
          console.log(
            "ETH- Sent by " + reciept.from + " to contract " + reciept.to,
          );
        },
      );
    }
  });

  // @ts-ignore
  (await subscription).on("error", (err) => {
    throw err;
  });
  // @ts-ignore
  (await subscription).on("connected", (nr) =>
    console.log("ETH- Subscription on ERC-20 started with ID %s", nr),
  );
}
export async function monitorRollDown(type = "deposit") {
  const users: Map<
    string,
    Set<{
      DestAddress: string;
      token: string;
      amount: string;
      totalBalance: string;
      mgaBalance: string;
    }>
  > = new Map();

  if (type === "deposit") {
    //ts-ignore
    while (true) {
      const p0 = listenTransfers();
      const p1 = monitorEthDeposits();
      const p2 = monitorPolkBalances();
      const p3 = subscribeAndPrintTokenChanges();
      await Promise.all([p0, p1, p2, p3]);
    }
    async function printData() {
      // for (const entry of users.keys()) {
      // console.log("=====================================");
      // await printUserInfo(entry);
      // console.log(users.get(entry));
      // console.log("=====================================");
      // }
    }

    async function monitorPolkBalances() {}

    async function monitorEthDeposits() {
      return await new Promise(() => {
        getPublicClient("EthAnvil").watchContractEvent({
          abi: abi,
          address: ROLL_DOWN_CONTRACT_ADDRESS,
          eventName: "DepositAcceptedIntoQueue",
          onLogs: async (logs) => {
            for (const log of logs) {
              console.log(
                //@ts-ignore
                `ETH - DepositAcceptedIntoQueue event: ${JSON.stringify(
                  //@ts-ignore
                  log.args,
                )}`,
              );
              // @ts-ignore
              const { depositRecipient, tokenAddress, amount } = log.args;
              const totalBalance = await getBalance(
                tokenAddress,
                depositRecipient,
                "EthAnvil",
              );
              users.set(
                depositRecipient,
                new Set([
                  {
                    DestAddress: depositRecipient,
                    token: tokenAddress,
                    amount: amount,
                    totalBalance: (totalBalance as any).toString(),
                    mgaBalance: "0",
                  },
                ]),
              );
            }
            await printData();
          },
        });
      });
    }
  }
}
export async function readL2Updates() {
  const res = await getL2UpdatesStorage();
  console.log(JSON.stringify(res, null, 2));
}

export async function depositHell(num: number, txIndexer = 0) {
  await setupApi();
  const api = await getApi();
  let txIndex;
  if (txIndexer === 0) {
    txIndex = await Rolldown.lastProcessedRequestOnL2();
  } else {
    txIndex = txIndexer;
  }
  const sequencer = await SequencerStaking.getSequencerUser();
  await Rolldown.waitForReadRights(sequencer.ethAddress.toLowerCase());
  testLog.getLog().info("Depositing " + num + " transactions from " + txIndex);
  const depositBatch = new L2Update(api)
    .withDeposit(txIndex, sequencer.toString(), sequencer.toString(), 1001)
    .clone(txIndex, num)
    .buildUnsafe();
  await signTx(api, depositBatch, sequencer.keyRingPair);
  return txIndex + num;
}

export async function create10sequencers(nw = "Ethereum") {
  await setupApi();
  const txs = [];
  for (let i = 0; i < 10; i++) {
    const users = await setupUsers();
    txs.push(Assets.mintNativeAddress(users[0].keyRingPair.address));
    txs.push(
      Sudo.sudoAsWithAddressString(
        users[0].keyRingPair.address,
        await SequencerStaking.provideSequencerStaking(
          BN_ZERO,
          nw as ChainName,
        ),
      ),
    );
  }
  await Sudo.batchAsSudoFinalized(...txs);
}

export async function closeL1Item(
  itemId: bigint,
  closingItem = "close_withdrawal",
  chain = "Ethereum",
  closingAll = false,
) {
  await setupApi();
  const api = await getApi();
  const network = chain === "Ethereum" ? "EthAnvil" : "ArbAnvil";
  const viemClient = getWalletClient(network);
  const publicClient = getPublicClient(network);
  async function closeOnlyL1Item(item: bigint) {
    const range = await findMerkleRange(publicClient, item, network);
    const rangeStart = (range as any).start;
    const rangeEnd = (range as any).end;
    const chainPk = api.createType("Chain", chain);
    const encodedWithdrawal = await api.rpc.rolldown.get_abi_encoded_l2_request(
      chain,
      item,
    );
    console.log(
      `chain: ${chainPk} range: [${rangeStart}, ${rangeEnd}] withdrawalRequestId: ${item} `,
    );
    const root = await api.rpc.rolldown.get_merkle_root(chain, [
      rangeStart,
      rangeEnd,
    ]);
    const proof = await api.rpc.rolldown.get_merkle_proof(
      chain,
      [rangeStart, rangeEnd],
      item,
    );
    const res = await api.rpc.rolldown.verify_merkle_proof(
      chain,
      [rangeStart, rangeEnd],
      item,
      root,
      proof,
    );
    console.log(res.toHuman());
    const withdrawal = decodeAbiParameters(
      (metadata as any).output.abi.find((e: any) => e.name === closingItem)!
        .inputs[0].components,
      encodedWithdrawal.toHex(),
    );
    console.log(withdrawal);

    //@ts-ignore
    const { request } = await publicClient.simulateContract({
      address: getL1(network as L1Type)!.contracts.rollDown.address,
      chain: getL1(network as L1Type)!,
      abi: abi,
      functionName: closingItem,
      //@ts-ignore
      args: [withdrawal, root.toHuman(), proof.toHuman()],
    });
    return viemClient
      .writeContract(request)
      .then(async (txHash) => {
        const result = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });
        testLog
          .getLog()
          .info(
            `closing withdrawal ${itemId}: tx:${result.transactionHash} - ${result.status}`,
          );
        testLog.getLog().info("L1 item closed with tx", request);
      })
      .catch((err) => {
        if (err.toString().includes("Already processed")) {
          testLog.getLog().info("Aready processed", err);
        } else {
          throw err;
        }
      });
  }

  if (closingAll) {
    for (let i = itemId; i > 0; i++) {
      await closeOnlyL1Item(i);
    }
  } else {
    try {
      await closeOnlyL1Item(itemId);
    } catch (e: any) {
      if (e.toString().includes("Already processed")) {
        testLog.getLog().info("Aready processed", e);
      } else {
        throw e;
      }
    }
  }
}

export async function getPolkAddress(address: string) {
  return convertEthAddressToDotAddress(address);
}
// @ts-ignore
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};

async function findMerkleRange(
  publicClient: PublicClient,
  requestId: bigint,
  network: L1Type,
) {
  return await publicClient.readContract({
    address: getL1(network)!.contracts.rollDown.address,
    abi: abi,
    functionName: "find_l2_batch",
    args: [requestId],
  });
}

async function getLastBatchId(api: ApiPromise) {
  const apiAt = await api;
  const last_batch = await apiAt.query.rolldown.l2RequestsBatchLast();
  const specificL1LastBatch = last_batch.toHuman()[L1_CHAIN];
  if (specificL1LastBatch === undefined) {
    return null;
  } else {
    return (specificL1LastBatch as any)[1];
  }
}

async function findBatchWithNewUpdates(
  api: ApiPromise,
  publicClient: PublicClient,
) {
  let batchId = await getLastBatchId(api);
  if (batchId == null) {
    return null;
  }

  const lastSubmittedId = await getLatestRequestIdSubmittedToL1(publicClient);
  const nextRequestId = lastSubmittedId + nToBigInt(1);

  while (batchId > 0) {
    const batch = await api.query.rolldown.l2RequestsBatch([L1_CHAIN, batchId]);
    const rangeStart = BigInt((batch.toHuman() as any)[1][0]);
    const rangeStop = BigInt((batch.toHuman() as any)[1][1]);
    if (rangeStart <= nextRequestId && rangeStop >= nextRequestId) {
      return [rangeStart, rangeStop];
    }
    batchId -= 1;
  }

  console.log(`couldnt find any batch with requestId: ${nextRequestId}`);
  return null;
}

export async function sendUpdateToL1() {
  await setupApi();
  const api = await getApi();
  const publicClient = getPublicClient();
  const viemClient = getWalletClient();
  const ethAccount = privateKeyToAccount(
    `0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133`,
  );

  const requestsRange = await findBatchWithNewUpdates(api, publicClient);

  if (requestsRange == null) {
    return null;
  }
  const rangeStart = requestsRange[0];
  const rangeEnd = requestsRange[1];

  const root = await api.rpc.rolldown.get_merkle_root(L1_CHAIN, [
    rangeStart,
    rangeEnd,
  ]);
  if (
    root.toString() ===
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    return null;
  }

  const { maxFeeInWei, maxPriorityFeePerGasInWei } =
    await estimateGasInWei(publicClient);
  const { request } = await publicClient.simulateContract({
    account: ethAccount,
    chain: getL1("EthAnvil")!,
    abi: abi,
    address: ROLL_DOWN_CONTRACT_ADDRESS,
    functionName: "update_l1_from_l2",
    args: [root.toHex(), [rangeStart, rangeEnd]],
    maxFeePerGas: maxFeeInWei,
    maxPriorityFeePerGas: maxPriorityFeePerGasInWei,
  });
  const txHash = await viemClient.writeContract(request);
  const result = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(
    `#${result.blockNumber} ${result.transactionHash} : ${result.status}`,
  );
  return requestsRange;
}

export async function getLatestRequestIdSubmittedToL1(
  publicClient: PublicClient,
) {
  return (await publicClient.readContract({
    address: ROLL_DOWN_CONTRACT_ADDRESS as unknown as `0x${string}`,
    abi: abi,
    functionName: "lastProcessedUpdate_origin_l2",
    args: [],
  })) as bigint;
}
async function estimateGasInWei(publicClient: PublicClient) {
  // https://www.blocknative.com/blog/eip-1559-fees
  // We do not want VIEM estimate we would like to make our own estimate
  // based on this equation: Max Fee = (2 * Base Fee) + Max Priority Fee

  // Max Fee = maxFeePerGas (viem)
  // Max Priority Fee = maxPriorityFeePerGas (viem)

  const baseFeeInWei = await publicClient.getGasPrice();

  const maxPriorityFeePerGasInWei =
    await estimateMaxPriorityFeePerGas(publicClient);

  const maxFeeInWei =
    BigInt(2) * BigInt(baseFeeInWei) + BigInt(maxPriorityFeePerGasInWei);

  return { maxFeeInWei, maxPriorityFeePerGasInWei };
}
