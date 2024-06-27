/* eslint-disable no-console */
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { api, getApi, initApi } from "../utils/api";
import { MAX_BALANCE, GASP_ASSET_ID } from "../utils/Constants";
import { User } from "../utils/User";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../utils/utils";
import { MangataGenericEvent } from "@mangata-finance/sdk";
import { burnLiquidity, getNextAssetId, mintLiquidity } from "../utils/tx";
import { testLog } from "../utils/Logger";

import "dotenv/config";

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.setTimeout(5000000);
process.env.NODE_ENV = "test";
let testUser1, testUser2, testUser3, testUser4, sudo, keyring;

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

describe("staking - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  const amount = new BN("100000000000000000000000000000");
  //  const skipToBurn = false;
  const rewardsGenerationTime = 21;
  //const tokenId = new BN(7);
  test("xyk-pallet: Finish tge and setup pool", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    testUser1 = new User(keyring, "//Ferdie");
    testUser2 = new User(keyring, "//Eve");
    testUser3 = new User(keyring, "//Dave");
    testUser4 = new User(keyring, "//Charlie");
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
        api!.tx.xyk.createPool(
          GASP_ASSET_ID,
          amount.divn(2),
          tokenId,
          amount.divn(2),
        ),
        api!.tx.sudo.sudo(api!.tx.xyk.promotePool(tokenId.addn(1))),
      ])
      .signAndSend(sudo.keyRingPair);
    await waitForNBlocks(3);
    for (let index = 0; index < users.length; index++) {
      const user = users[index];
      const tokenstoMint = new BN(1000000);
      testLog
        .getLog()
        .info(" User: " + user.keyring.address + "Minting tokens to pool");
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
    for (let index = 0; index < users.length - 2; index++) {
      const user = users[index];
      const tokenstoMint = new BN(1000000000);
      testLog
        .getLog()
        .info(
          " User: " +
            user.keyRingPair.address +
            "Minting tokens to pool -2 users",
        );
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
    testLog
      .getLog()
      .info(" Waiting some blocks:  " + rewardsGenerationTime.toString());
    await waitForNBlocks(rewardsGenerationTime);
    for (let index = 0; index < users.length - 2; index++) {
      const user = users[index];
      const tokenstoMint = new BN(1000000000);
      testLog
        .getLog()
        .info(
          " User: " +
            user.keyRingPair.address +
            "Minting tokens to pool -2 users",
        );
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
    testLog
      .getLog()
      .info(" Waiting some blocks:  " + rewardsGenerationTime.toString());
    await waitForNBlocks(rewardsGenerationTime);
    //    }

    for (let index = 0; index < users.length - 2; index++) {
      const user = users[index];
      const tokenstoMint = new BN(1000000000);
      testLog
        .getLog()
        .info(" User: " + user.keyRingPair.address + "burning tokens to pool");
      promises.push(
        burnLiquidity(user.keyRingPair, GASP_ASSET_ID, tokenId, tokenstoMint),
      );
    }
    await Promise.all(promises);
    for (let index = 0; index < users.length - 2; index++) {
      const user = users[index];
      const tokenstoMint = new BN(1000000000);
      testLog
        .getLog()
        .info(" User: " + user.keyRingPair.address + "burning tokens to pool");
      promises.push(
        burnLiquidity(user.keyRingPair, GASP_ASSET_ID, tokenId, tokenstoMint),
      );
    }
    await Promise.all(promises);
  });
});
