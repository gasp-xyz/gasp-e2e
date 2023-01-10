/* eslint-disable prettier/prettier */
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getApi, initApi } from "../utils/api";
import { MGA_ASSET_ID } from "../utils/Constants";
import { User } from "../utils/User";
import {
  getEnvironmentRequiredVars,
} from "../utils/utils";
import {
    getCurrentNonce,
  getNextAssetId,
  getUserAssets,
  sellAsset,
} from "../utils/tx";
import { setupApi, setupUsers } from "../utils/setup";
import { Assets } from "../utils/Assets";
import { Sudo } from "../utils/sudo";
import { Xyk } from "../utils/xyk";
import { testLog } from "../utils/Logger";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

describe("staking - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  test("Create pool and mint tokens to users", async () => {
    await setupApi();
    await setupUsers();
    const keyring = new Keyring({ type: "sr25519" });
    const charlie = new User(keyring, "//Charlie");
    const eve = new User(keyring, "//Eve");
    const ferdie = new User(keyring, "//Ferdie");
    const tokenId = await getNextAssetId();
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(charlie),
      Assets.mintNative(eve),
      Assets.mintNative(ferdie),
      Assets.issueToken(charlie),
      Assets.mintToken(tokenId, eve),
      Assets.mintToken(tokenId, ferdie),
      Sudo.sudoAs(
        charlie,
        Xyk.createPool(
          MGA_ASSET_ID,
          new BN("100000000000000000000"),
          tokenId,
          new BN("100000000000000000000")
        )
      )
    );
  });
  test("Do swap and print balances", async () => {
    await setupApi();
    await setupUsers();
    const keyring = new Keyring({ type: "sr25519" });
    const charlie = new User(keyring, "//Charlie");
    //    const eve = new User(keyring, "//Eve");
    //    const ferdie = new User(keyring, "//Ferdie");
    const tokenId = new BN(8);
    const tokensBefore = await getUserAssets(charlie.keyRingPair.address, [
      new BN(0),
      tokenId,
    ]);
    testLog.getLog().info(JSON.stringify(tokensBefore));
    const promises: any[] = [];
    const nonce = await getCurrentNonce(charlie.keyRingPair.address)
    promises.push(sellAsset(
      charlie.keyRingPair,
      new BN(0),
      tokenId,
      new BN(10000),
      new BN(1), {
        nonce: nonce
      }
    ));
    promises.push(sellAsset(
        charlie.keyRingPair,
        new BN(0),
        tokenId,
        new BN(10000),
        new BN(1), {
          nonce: nonce.addn(1)
        }
      ));
    await Promise.all(promises);

    const tokensAfter = await getUserAssets(charlie.keyRingPair.address, [
      new BN(0),
      tokenId,
    ]);
    testLog.getLog().info(JSON.stringify(tokensBefore));
    testLog.getLog().info(JSON.stringify(tokensAfter));
    testLog.getLog().info("MGA::::  Free:    " + tokensAfter[0].free.sub(tokensBefore[0].free).toNumber() );
    testLog.getLog().info("MGA::::  Reserved:" + tokensAfter[0].reserved.sub(tokensBefore[0].reserved).toNumber() );
    testLog.getLog().info("MGA::::  Frozen:  " + tokensAfter[0].frozen.sub(tokensBefore[0].frozen).toNumber() );

    testLog.getLog().info("Token::::  Free:  " + tokensAfter[1].free.sub(tokensBefore[1].free).toNumber() );
    testLog.getLog().info("Token::  Reserved:" + tokensAfter[1].reserved.sub(tokensBefore[1].reserved).toNumber() );
    testLog.getLog().info("token:::  Frozen: " + tokensAfter[1].frozen.sub(tokensBefore[1].frozen).toNumber() );
  });
});
