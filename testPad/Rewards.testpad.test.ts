/* eslint-disable no-console */
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { api, getApi, initApi } from "../utils/api";
import { MAX_BALANCE, GASP_ASSET_ID } from "../utils/Constants";
import { User, AssetWallet } from "../utils/User";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../utils/utils";
import { BN_ZERO, MangataGenericEvent, signTx } from "gasp-sdk";
import {
  getLiquidityAssetId,
  getNextAssetId,
  mintLiquidity,
} from "../utils/tx";
import { ApiPromise } from "@polkadot/api";
import { WsProvider } from "@polkadot/rpc-provider/ws";
import { options } from "@mangata-finance/types";
import { testLog } from "../utils/Logger";
import { Sudo } from "../utils/sudo";
import { setupApi, setupUsers } from "../utils/setup";

import "dotenv/config";

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { sudo: sudoUserName, chainUri } = getEnvironmentRequiredVars();

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let sudo, keyring;

//*******HOW TO USE******** */
//install JEST run it extension for vs code.
//export env. variables.
//run xyk-pallet: Create new users with bonded amounts.
// this ^^ will create json files with User_address as name.
// You can import those files into polkadotJS.
// If you want to use any action, write in the const address the user address to trigger the action.
// this will load the .json and perform the extrinsic action.
// have fun!
//*******END:HOW TO USE******** */

const amount = new BN("100000000000000000000000000000");

describe("RewardsV2 - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  const rewardsGenerationTime = 5;

  test("Rewards: Setup a pool with rewards and 4 users", async () => {
    for (let index = 0; index < 2; index++) {
      await doSetup(rewardsGenerationTime);
    }
  });
  test("xyk-pallet: autocompound", async () => {
    const liqtokenId = new BN(11);
    keyring = new Keyring({ type: "sr25519" });
    const testUser1 = new User(keyring, "//Ferdie");
    const testUser2 = new User(keyring, "//Eve");
    const testUser3 = new User(keyring, "//Dave");
    const testUser4 = new User(keyring, "//Charlie");
    const users = [testUser1, testUser2, testUser3, testUser4];
    const promises: Promise<MangataGenericEvent[]>[] = [];
    const balancesBefore = [{}];
    for (let index = 0; index < 4; index++) {
      const testUser1 = users[index];
      keyring.addPair(testUser1.keyRingPair);
      await testUser1.addAsset(0);
      await testUser1.refreshAmounts(AssetWallet.BEFORE);
      promises.push(
        signTx(
          api!,
          api!.tx.xyk.compoundRewards(liqtokenId, 1000000),
          testUser1.keyRingPair,
        ),
      );
      balancesBefore.push(
        testUser1.keyRingPair.address,
        testUser1.getFreeAssetAmount(0).amountBefore.free,
      );
      testLog
        .getLog()
        .info(
          `User: ${testUser1.keyRingPair.address} has: ${
            testUser1.getFreeAssetAmount(0).amountBefore.free
          }`,
        );
    }
    await Promise.all(promises).catch();

    for (let index = 0; index < 4; index++) {
      const testUser1 = users[index];
      await testUser1.refreshAmounts(AssetWallet.AFTER);
      testLog
        .getLog()
        .info(
          `User: ${testUser1.keyRingPair.address}  NOW has: ${
            testUser1.getFreeAssetAmount(0).amountAfter.free
          }`,
        );
    }
    testLog.getLog().info(JSON.stringify(balancesBefore));
  });
  test("xyk-pallet: claim rewards_v2", async () => {
    const liqtokenId = new BN(12);
    keyring = new Keyring({ type: "sr25519" });
    const testUser1 = new User(keyring, "//Ferdie");
    const testUser2 = new User(keyring, "//Eve");
    const testUser3 = new User(keyring, "//Dave");
    const testUser4 = new User(keyring, "//Charlie");
    const testUser5 = new User(keyring, "//Alice");
    const users = [testUser1, testUser2, testUser3, testUser4, testUser5];
    const promises: Promise<MangataGenericEvent[]>[] = [];
    for (let index = 0; index < users.length; index++) {
      const testUser1 = users[index];
      sudo = new User(keyring, sudoUserName);
      // add users to pair.
      keyring.addPair(testUser1.keyRingPair);
      await testUser1.refreshAmounts(AssetWallet.BEFORE);
      const provider = new WsProvider(chainUri);
      const api2 = await new ApiPromise(options({ provider })).isReady;
      const result = await (api2.rpc as any).xyk.calculate_rewards_amount(
        testUser1.keyRingPair.address,
        liqtokenId,
      );
      promises.push(
        signTx(
          api!,
          api!.tx.xyk.claimRewardsV2(liqtokenId, new BN(result.toString())),
          testUser1.keyRingPair,
        ),
      );
      testLog.getLog().info(result.price.toString());
    }
    await Promise.all(promises);
  });
  test("xyk-pallet: disable token", async () => {
    const token = new BN(13);
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);

    const promises: Promise<MangataGenericEvent[]>[] = [];
    promises.push(
      signTx(
        api!,
        api!.tx.sudo.sudo(
          api!.tx.assetRegistry.updateAsset(
            token,
            "18",
            //@ts-ignore
            api!.createType("Vec<u8>", "TESTUPDT-" + token.toString()),
            api!.createType("Vec<u8>", "TSTUPD" + token.toString()),
            "0",
            null,
            {
              xyk: {
                operationsDisabled: true,
              },
            },
          ),
        ),
        sudo.keyRingPair,
      ),
    );
    await Promise.all(promises);
  });
  test("xyk-pallet: Burn_v2", async () => {
    const liqtokenId = new BN(15);
    keyring = new Keyring({ type: "sr25519" });
    const testUser1 = new User(keyring, "//Ferdie");
    const testUser2 = new User(keyring, "//Eve");
    const testUser3 = new User(keyring, "//Dave");
    const testUser4 = new User(keyring, "//Charlie");
    sudo = new User(keyring, sudoUserName);
    const users = [testUser1, testUser2, testUser3, testUser4];
    const promises: Promise<MangataGenericEvent[]>[] = [];
    const assetId = await getLiquidityAssetId(BN_ZERO, liqtokenId);
    promises.push(
      signTx(
        api!,
        api!.tx.market.burnLiquidity(assetId, amount.divn(2), 0, 0),
        sudo.keyRingPair,
      ),
    );
    for (let index = 0; index < 4; index++) {
      const testUser1 = users[index];
      sudo = new User(keyring, sudoUserName);
      // add users to pair.
      keyring.addPair(testUser1.keyRingPair);
      await testUser1.refreshAmounts(AssetWallet.BEFORE);
      const provider = new WsProvider(chainUri);
      const api2 = await new ApiPromise(options({ provider })).isReady;
      const result = await (api2.rpc as any).xyk.calculate_rewards_amount(
        testUser1.keyRingPair.address,
        liqtokenId.addn(1),
      );
      const assetId = await getLiquidityAssetId(BN_ZERO, liqtokenId);
      promises.push(
        signTx(
          api!,
          api!.tx.market.burnLiquidity(assetId, new BN(10000000000000), 0, 0),
          testUser1.keyRingPair,
        ),
      );
      testLog.getLog().info(result.toString());
    }
    await Promise.all(promises);
  });
  test("xyk-pallet: Mint_v2", async () => {
    const liqtokenId = new BN(7);
    keyring = new Keyring({ type: "sr25519" });
    const testUser1 = new User(keyring, "//Ferdie");
    const testUser2 = new User(keyring, "//Eve");
    const testUser3 = new User(keyring, "//Dave");
    const testUser4 = new User(keyring, "//Charlie");
    const users = [testUser1, testUser2, testUser3, testUser4];
    const promises: Promise<MangataGenericEvent[]>[] = [];
    for (let index = 0; index < 2; index++) {
      const testUser1 = users[index];
      sudo = new User(keyring, sudoUserName);
      // add users to pair.
      keyring.addPair(testUser1.keyRingPair);
      await testUser1.refreshAmounts(AssetWallet.BEFORE);
      const provider = new WsProvider(chainUri);
      const api2 = await new ApiPromise(options({ provider })).isReady;
      const result = await (api2.rpc as any).xyk.calculate_rewards_amount_v2(
        testUser1.keyRingPair.address,
        liqtokenId.addn(1),
      );
      const assetId = await getLiquidityAssetId(BN_ZERO, liqtokenId);
      promises.push(
        signTx(
          api!,
          api!.tx.market.mintLiquidity(
            assetId,
            BN_ZERO,
            new BN(100000),
            new BN(1998000),
          ),
          testUser1.keyRingPair,
        ),
      );
      testLog.getLog().info(result.toHuman().toString());
    }
    await Promise.all(promises);
  });
  test("xyk-pallet: Burn&mint batched", async () => {
    const tokenId = new BN(7);
    keyring = new Keyring({ type: "sr25519" });
    const testUser1 = new User(keyring, "//Ferdie");
    sudo = new User(keyring, sudoUserName);
    const assetId = await getLiquidityAssetId(BN_ZERO, tokenId);
    await api!.tx.utility
      .batch([
        api!.tx.market.burnLiquidity(assetId, new BN(1000), 0, 0),
        api!.tx.market.mintLiquidity(
          assetId,
          BN_ZERO,
          new BN(1000),
          new BN(2000),
        ),
      ])
      .signAndSend(testUser1.keyRingPair);
    await waitForNBlocks(3);
  });

  test("xyk-pallet: one guy mint other burn", async () => {
    const tokenId = new BN(7);
    keyring = new Keyring({ type: "sr25519" });
    const testUser1 = new User(keyring, "//Eve");
    const testUser2 = new User(keyring, "//Dave");
    sudo = new User(keyring, sudoUserName);
    const assetId = await getLiquidityAssetId(BN_ZERO, tokenId);
    await api!.tx.utility
      .batch([
        api!.tx.market.mintLiquidity(
          assetId,
          BN_ZERO,
          new BN(1000),
          new BN(2000),
        ),
      ])
      .signAndSend(testUser1.keyRingPair);

    await waitForNBlocks(1);
    await api!.tx.utility
      .batch([
        api!.tx.market.mintLiquidity(
          assetId,
          BN_ZERO,
          new BN(500),
          new BN(2000),
        ),
      ])
      .signAndSend(testUser2.keyRingPair);
    await waitForNBlocks(2);
    await api!.tx.utility
      .batch([
        api!.tx.market.mintLiquidity(
          assetId,
          BN_ZERO,
          new BN(500),
          new BN(2000),
        ),
      ])
      .signAndSend(testUser2.keyRingPair);

    await waitForNBlocks(2);
  });
  test("xyk-pallet: gassles swaps", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);

    const promises: Promise<MangataGenericEvent[]>[] = [];
    promises.push(
      signTx(
        api!,
        api!.tx.sudo.sudo(
          api!.tx.feeLock.updateFeeLockMetadata(10, 10, "100000000000", [
            [12, true],
            [14, true],
          ]),
        ),
        sudo.keyRingPair,
      ),
    );
    await Promise.all(promises);
  });
  test("xyk-pallet: create proxy", async () => {
    const api = await initApi();
    await setupApi();
    await setupUsers();
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    const testUser1 = new User(keyring, "//Ferdie");
    const bob = new User(keyring, "//Charlie");
    const proxyCall = [
      Sudo.sudoAs(
        testUser1,
        api!.tx.proxy.addProxy(bob.keyRingPair.address, "Autocompound", 0),
      ),
    ];
    await Sudo.batchAsSudoFinalized(...[proxyCall].flat());
  });
});
async function doSetup(rewardsGenerationTime: number) {
  keyring = new Keyring({ type: "sr25519" });
  sudo = new User(keyring, sudoUserName);
  const testUser1 = new User(keyring, "//Ferdie");
  const testUser2 = new User(keyring, "//Eve");
  const testUser3 = new User(keyring, "//Dave");
  const testUser4 = new User(keyring, "//Charlie");
  const users = [testUser1, testUser2, testUser3, testUser4];
  const promises: Promise<MangataGenericEvent[]>[] = [];
  //    if(!skipToBurn){
  keyring.addPair(sudo.keyRingPair);
  testLog.getLog().info("FinalizeTGE and create a test token");
  const tokenId = await getNextAssetId();
  await api!.tx.utility
    .batch([
      api!.tx.sudo.sudo(api!.tx.issuance.finalizeTge()),
      api!.tx.sudo.sudo(api!.tx.issuance.initIssuanceConfig()),
      api!.tx.sudo.sudo(
        api!.tx.tokens.mint(GASP_ASSET_ID, sudo.keyRingPair.address, amount),
      ),
      api!.tx.sudo.sudo(
        api!.tx.tokens.create(sudo.keyRingPair.address, amount),
      ),
      api!.tx.sudo.sudo(
        api!.tx.tokens.mint(
          GASP_ASSET_ID,
          testUser1.keyRingPair.address,
          new BN(amount),
        ),
      ),
      api!.tx.sudo.sudo(
        api!.tx.tokens.mint(
          tokenId,
          testUser1.keyRingPair.address,
          new BN(amount),
        ),
      ),
      api!.tx.sudo.sudo(
        api!.tx.tokens.mint(
          GASP_ASSET_ID,
          testUser2.keyRingPair.address,
          new BN(amount),
        ),
      ),
      api!.tx.sudo.sudo(
        api!.tx.tokens.mint(
          tokenId,
          testUser2.keyRingPair.address,
          new BN(amount),
        ),
      ),
      api!.tx.sudo.sudo(
        api!.tx.tokens.mint(
          GASP_ASSET_ID,
          testUser3.keyRingPair.address,
          new BN(amount),
        ),
      ),
      api!.tx.sudo.sudo(
        api!.tx.tokens.mint(
          tokenId,
          testUser3.keyRingPair.address,
          new BN(amount),
        ),
      ),
      api!.tx.sudo.sudo(
        api!.tx.tokens.mint(
          GASP_ASSET_ID,
          testUser4.keyRingPair.address,
          new BN(amount),
        ),
      ),
      api!.tx.sudo.sudo(
        api!.tx.tokens.mint(
          tokenId,
          testUser4.keyRingPair.address,
          new BN(amount),
        ),
      ),
    ])
    .signAndSend(sudo.keyRingPair);

  await waitForNBlocks(3);
  testLog.getLog().info("new tokenID = " + tokenId.toString());
  testLog
    .getLog()
    .info(
      "Creating pool + promote + giving tokens to users: \n pool: [ 0 ," +
        tokenId.toString() +
        "]",
    );

  await api!.tx.utility
    .batch([
      api!.tx.market.createPool(
        "Xyk",
        GASP_ASSET_ID,
        amount.divn(2),
        tokenId,
        amount.divn(2),
      ),
      api!.tx.sudo.sudo(api!.tx.xyk.updatePoolPromotion(tokenId.addn(1), 50)),
    ])
    .signAndSend(sudo.keyRingPair);
  await waitForNBlocks(3);
  for (let index = 0; index < users.length; index++) {
    const user = users[index];
    const tokenstoMint = new BN(1000000);
    testLog
      .getLog()
      .info(" User: " + user.keyRingPair.address + "Minting tokens to pool");
    promises.push(
      mintLiquidity(
        user.keyRingPair,
        GASP_ASSET_ID,
        tokenId,
        tokenstoMint,
        MAX_BALANCE,
      ),
    );
  }
  await Promise.all(promises);
  await waitForNBlocks(rewardsGenerationTime);
  for (let index = 0; index < 0; index++) {
    const user = users[0];
    const tokenstoMint = new BN(100);
    testLog
      .getLog()
      .info(
        " User: " +
          user.keyRingPair.address +
          "Minting tokens to pool -2 users",
      );
    await mintLiquidity(
      user.keyRingPair,
      GASP_ASSET_ID,
      tokenId,
      tokenstoMint,
      MAX_BALANCE,
    );
    await waitForNBlocks(5);
  }
}
