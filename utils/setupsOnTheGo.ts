/* eslint-disable no-console */
import Keyring from "@polkadot/keyring";
import BN from "bn.js";
import { Assets } from "./Assets";
import { MGA_ASSET_ID, MAX_BALANCE } from "./Constants";
import { waitForRewards } from "./eventListeners";
import { Extrinsic, setupApi, setupUsers } from "./setup";
import { Sudo } from "./sudo";
import { xxhashAsHex } from "@polkadot/util-crypto";

import {
  getLiquidityAssetId,
  getLiquidityPool,
  calculate_buy_price_id_rpc,
} from "./tx";
import { User } from "./User";
import { getEnvironmentRequiredVars } from "./utils";
import { Xyk } from "./xyk";
import { getApi, api, initApi } from "./api";
import { signTx } from "@mangata-finance/sdk";
import { getBalanceOfPool } from "./txHandler";
import { StorageKey, Bytes } from "@polkadot/types";
import { ITuple, Codec } from "@polkadot/types/types";
import jsonpath from "jsonpath";

const tokenOrigin = "ActivatedUnstakedReserves"; // "AvailableBalance";
export async function setupPoolWithRewardsForDefaultUsers() {
  await setupApi();
  await setupUsers();
  const amount = (await api?.consts.parachainStaking.minCandidateStk)?.muln(
    1000
  )!;
  const keyring = new Keyring({ type: "sr25519" });
  const testUser1 = new User(keyring, "//Bob");
  const testUser2 = new User(keyring, "//Alice");
  const testUser3 = new User(keyring, "//Charlie");
  const testUser4 = new User(keyring, "//Eve");
  const users = [testUser1, testUser2, testUser3, testUser4];
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const token2 = await Assets.issueAssetToUser(sudo, amount, sudo, true);
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token2, testUser1, amount),
    Assets.mintToken(token2, testUser2, amount),
    Assets.mintToken(token2, testUser3, amount),
    Assets.mintToken(token2, testUser4, amount),
    Assets.mintNative(testUser1, amount),
    Assets.mintNative(testUser2, amount),
    Assets.mintNative(testUser3, amount),
    Assets.mintNative(testUser4, amount),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(MGA_ASSET_ID, amount.divn(10), token2, amount.divn(10))
    )
  );
  const liqId = await getLiquidityAssetId(MGA_ASSET_ID, token2);
  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(MGA_ASSET_ID, token2, amount.divn(10), amount)
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(MGA_ASSET_ID, token2, amount.divn(10), amount)
    ),
    Sudo.sudoAs(
      testUser3,
      Xyk.mintLiquidity(MGA_ASSET_ID, token2, amount.divn(10), amount)
    ),
    Sudo.sudoAs(
      testUser4,
      Xyk.mintLiquidity(MGA_ASSET_ID, token2, amount.divn(10), amount)
    )
  );
  await waitForRewards(testUser4, liqId);
  return { users, liqId, sudo, token2 };
}
export async function joinAsCandidate(userName = "//Charlie", liqId = 9) {
  await setupUsers();
  await setupApi();
  const api = await getApi();
  const keyring = new Keyring({ type: "sr25519" });
  const liq = new BN(liqId);
  const user = new User(keyring, userName);
  const liqAssets = await api?.query.parachainStaking.stakingLiquidityTokens();
  const liqAssetsCount = [...liqAssets!.keys()].length;
  const numCollators = (await api?.query.parachainStaking.candidatePool())!
    .length;
  //const amountToJoin = new BN("5000000000000000000000");
  const amountToJoin = new BN(
    await api!.consts.parachainStaking.minCandidateStk!.toString()
  ).addn(1234567);

  console.info("amount: " + amountToJoin.toString());
  const tokenInPool = await (
    await getLiquidityPool(liq)
  ).filter((x) => x.gt(MGA_ASSET_ID))[0];
  const tokensToMint = await calculate_buy_price_id_rpc(
    tokenInPool,
    MGA_ASSET_ID,
    amountToJoin
  );
  console.info("Token to  mint: " + tokensToMint.toString());
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(tokenInPool, user, amountToJoin.muln(100000)),
    Assets.mintNative(user, amountToJoin.muln(100000)),
    Sudo.sudoAs(
      user,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        tokenInPool,
        amountToJoin.muln(2),
        amountToJoin.muln(100000)
      )
    )
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
      new BN(liqAssetsCount)
    ),
    user.keyRingPair
  );
}
export async function joinAFewCandidates(numCandidates = 50, liqId = 9) {
  await setupUsers();
  await setupApi();
  const api = await getApi();
  const keyring = new Keyring({ type: "sr25519" });
  const liq = new BN(liqId);
  const amountToJoin = new BN(
    await api!.consts.parachainStaking.minCandidateStk!.toString()
  ).addn(1234);

  console.info("amount: " + amountToJoin.toString());
  const liqAssets = await api?.query.parachainStaking.stakingLiquidityTokens();
  const liqAssetsCount = [...liqAssets!.keys()].length;
  const numCollators = (await api?.query.parachainStaking.candidatePool())!
    .length;
  //const amountToJoin = new BN("5000000000000000000000");
  const tokenInPool = await (
    await getLiquidityPool(liq)
  ).filter((x) => x.gt(MGA_ASSET_ID))[0];
  const totalIssuance = new BN(await api.query.tokens.totalIssuance(liq));
  const mgx = await getBalanceOfPool(MGA_ASSET_ID, tokenInPool);
  const minLiqToJoin = amountToJoin.mul(totalIssuance).div(mgx[0][0]);
  console.info("amount " + amountToJoin.toString());
  console.info("issuance " + totalIssuance.toString());
  console.info("mgx in pool" + mgx[0][0]);

  console.info("users must set " + minLiqToJoin.toString());
  let tokensToMint = await calculate_buy_price_id_rpc(
    tokenInPool,
    MGA_ASSET_ID,
    amountToJoin
  );
  if (tokensToMint.eqn(0)) tokensToMint = amountToJoin.muln(10000);
  const txs = [];
  const users = [];
  for (let index = 0; index < numCandidates; index++) {
    const user = new User(keyring);
    users.push(user);
    txs.push(Assets.mintToken(tokenInPool, user, tokensToMint.muln(100)));
    txs.push(Assets.mintNative(user, amountToJoin.muln(100000)));
    txs.push(
      Sudo.sudoAs(
        user,
        Xyk.mintLiquidity(
          MGA_ASSET_ID,
          tokenInPool,
          amountToJoin.muln(2),
          MAX_BALANCE
        )
      )
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
          minLiqToJoin.addn(1000),
          liqId,
          tokenOrigin,
          // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
          new BN(numCollators).addn(index),
          // @ts-ignore
          new BN(liqAssetsCount)
        ),
        users[index].keyRingPair
      )
    );
  }
  await Promise.all(joins);
}
export async function giveTokensToUser(userName = "//Charlie", liqId = 9) {
  await setupUsers();
  await setupApi();
  const api = await getApi();
  const keyring = new Keyring({ type: "sr25519" });
  const liq = new BN(liqId);
  const user = new User(keyring, userName);
  const amountToJoin = new BN(
    api!.consts.parachainStaking.minCollatorStk!.toString()
  ).addn(1234);
  const tokenInPool = await (
    await getLiquidityPool(liq)
  ).filter((x) => x.gt(MGA_ASSET_ID))[0];
  const tokensToMint = await calculate_buy_price_id_rpc(
    tokenInPool,
    MGA_ASSET_ID,
    amountToJoin
  );
  console.info("Token to  mint: " + tokensToMint.toString());
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(tokenInPool, user, tokensToMint.muln(100)),
    Assets.mintNative(user, amountToJoin.muln(100000)),
    Sudo.sudoAs(
      user,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        tokenInPool,
        amountToJoin.muln(2),
        tokensToMint.muln(4)
      )
    )
  );
}
export async function fillWithDelegators(
  numDelegators: number,
  liqToken: number,
  targetAddress: string
) {
  await setupUsers();
  await setupApi();
  const api = await getApi();
  const keyring = new Keyring({ type: "sr25519" });
  const liq = new BN(liqToken);
  const amountToJoin = new BN(
    api!.consts.parachainStaking.minDelegation!.toString()
  ).addn(1234);
  //const liqAssets = await api?.query.parachainStaking.stakingLiquidityTokens();
  //const liqAssetsCount = [...liqAssets!.keys()].length;
  const candidateDelegationCount = JSON.parse(
    JSON.stringify(
      (await api?.query.parachainStaking.candidateState(targetAddress))!
    )
  ).delegators.length;
  const totalDelegators = JSON.parse(
    JSON.stringify(await api?.query.parachainStaking.delegatorState.entries())
  ).length;
  //const amountToJoin = new BN("5000000000000000000000");
  const tokenInPool = await (
    await getLiquidityPool(liq)
  ).filter((x) => x.gt(MGA_ASSET_ID))[0];
  const tokensToMint = await calculate_buy_price_id_rpc(
    tokenInPool,
    MGA_ASSET_ID,
    amountToJoin
  );
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
          MGA_ASSET_ID,
          tokenInPool,
          amountToJoin.muln(2),
          MAX_BALANCE
        )
      )
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
          new BN(totalDelegators).addn(index)
        ),
        users[index].keyRingPair
      )
    );
  }
  await Promise.all(joins);
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
        candidates[index]
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
    } did not win any point`
  );
  console.info(missingCandidates);
  console.info("*****************");
}

export async function createCustomPool(div = true, ratio = 1, user = "//Bob") {
  await setupApi();
  await setupUsers();
  const amount = (await api?.consts.parachainStaking.minCandidateStk)?.muln(
    1000
  )!;
  const keyring = new Keyring({ type: "sr25519" });
  const testUser1 = new User(keyring, user);
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const token2 = await Assets.issueAssetToUser(
    sudo,
    amount.muln(ratio),
    sudo,
    true
  );
  let tx;
  if (div) {
    tx = Sudo.sudoAs(
      testUser1,
      Xyk.createPool(MGA_ASSET_ID, amount, token2, amount.divn(ratio))
    );
  } else {
    tx = Sudo.sudoAs(
      testUser1,
      Xyk.createPool(MGA_ASSET_ID, amount, token2, amount.muln(ratio))
    );
  }
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token2, testUser1, amount),
    Assets.mintNative(testUser1, amount),
    tx
  );
}
export function getStorageKey(
  moduleName: string,
  storageItemName: string
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

export async function migrate() {
  await setupApi();
  await setupUsers();
  await initApi("wss://prod-kusama-collator-01.mangatafinance.cloud");
  const api = await getApi();
  const allPallets = await listStorages();
  const storageToMigrate = allPallets
    .filter(
      (x: any) =>
        x[0] === "Tokens" ||
        x[0] === "Xyk" ||
        x[0] === "Vesting" ||
        x[0] === "MultiPurposeLiquidity" ||
        x[0] === "AssetRegistry"
    )
    .flatMap((item: any) =>
      item[1].map((element: any) => {
        return [item[0], element];
      })
    );
  console.info(JSON.stringify(storageToMigrate));
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
      storageToMigrate[dataId][1]
    );
    let allKeys = [];
    let cont = true;
    let keys = await api.rpc.state.getKeysPaged(key, 100);
    let loop: number = 0;
    while (cont) {
      for (let index = 0; index < keys.length; index++) {
        const storage = await api.rpc.state.getStorage<Codec>(keys[index]);
        allKeys.push([keys[index], storage]);
      }
      const nextkeys = await api.rpc.state.getKeysPaged(key, 100, keys[99]);
      if (loop % 5 === 0) {
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
      if (nextkeys.includes(keys[99]) || nextkeys.length === 0) {
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
export async function listStorages() {
  await setupApi();
  await setupUsers();
  await initApi("wss://prod-kusama-collator-01.mangatafinance.cloud");
  const api = await getApi();
  const meta = await api.rpc.state.getMetadata();
  const metaJson = JSON.parse(JSON.stringify(meta));
  const res = jsonpath.query(metaJson, "$..pallets[*].name");
  const result: any = [];
  res.forEach((pallet) => {
    const storageItems = jsonpath.query(
      metaJson,
      `$..pallets[?(@.name =="${pallet}")].storage.items[*].name`
    );
    result.push([pallet, storageItems]);
  });
  console.info(result);
  return result;
}
