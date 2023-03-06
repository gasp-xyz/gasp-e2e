/* eslint-disable no-console */
import Keyring from "@polkadot/keyring";
import BN from "bn.js";
import { Assets } from "./Assets";
import { MGA_ASSET_ID } from "./Constants";
import { waitForRewards } from "./eventListeners";
import { setupApi, setupUsers } from "./setup";
import { Sudo } from "./sudo";
import {
  getLiquidityAssetId,
  getLiquidityPool,
  calculate_buy_price_id_rpc,
} from "./tx";
import { User } from "./User";
import { getEnvironmentRequiredVars } from "./utils";
import { Xyk } from "./xyk";
import { getApi } from "./api";
import { signTx } from "@mangata-finance/sdk";

export async function setupPoolWithRewardsForDefaultUsers() {
  await setupApi();
  await setupUsers();
  const keyring = new Keyring({ type: "sr25519" });
  const testUser1 = new User(keyring, "//Bob");
  const testUser2 = new User(keyring, "//Alice");
  const testUser3 = new User(keyring, "//Charlie");
  const testUser4 = new User(keyring, "//Eve");
  const users = [testUser1, testUser2, testUser3, testUser4];
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const token2 = await Assets.issueAssetToUser(
    sudo,
    Assets.DEFAULT_AMOUNT,
    sudo,
    true
  );
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser3, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser4, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );
  const liqId = await getLiquidityAssetId(MGA_ASSET_ID, token2);
  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(MGA_ASSET_ID, token2, new BN("1000000000000000"))
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(MGA_ASSET_ID, token2, new BN("1000000000000000"))
    ),
    Sudo.sudoAs(
      testUser3,
      Xyk.mintLiquidity(MGA_ASSET_ID, token2, new BN("1000000000000000"))
    ),
    Sudo.sudoAs(
      testUser4,
      Xyk.mintLiquidity(MGA_ASSET_ID, token2, new BN("1000000000000000"))
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
  await signTx(
    api,
    // @ts-ignore
    api?.tx.parachainStaking.joinCandidates(
      amountToJoin.subn(100),
      liqId,
      "AvailableBalance",
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
    api!.consts.parachainStaking.minCollatorStk!.toString()
  ).addn(1234);
  const liqAssets = await api?.query.parachainStaking.stakingLiquidityTokens();
  const liqAssetsCount = [...liqAssets!.keys()].length;
  const numCollators = (await api?.query.parachainStaking.candidatePool())!
    .length;
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
          tokensToMint.muln(4)
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
          amountToJoin.subn(10),
          liqId,
          "AvailableBalance",
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
