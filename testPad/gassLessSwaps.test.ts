/* eslint-disable prettier/prettier */
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getApi, initApi } from "../utils/api";
import { MGA_ASSET_ID } from "../utils/Constants";
import { User } from "../utils/User";
import {
    getNextAssetId,
  getUserAssets,
} from "../utils/tx";
import { setupApi, setupUsers } from "../utils/setup";
import { Assets } from "../utils/Assets";
import { Sudo } from "../utils/sudo";
import { Xyk } from "../utils/xyk";
import { testLog } from "../utils/Logger";
import { buyAsset } from '../utils/tx';

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

  test("gassless Create pool and mint tokens to users", async () => {
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
  test("disable token", async () => {
    await setupApi();
    await setupUsers();
    await Sudo.asSudoFinalized( Assets.updateAsset(new BN(8), {
      metadata: { xcm: undefined, xyk: { operationsDisabled: false } },
    })
    )

  });
  test("Do swap and print balances", async () => {
    await setupApi();
    await setupUsers();
    const keyring = new Keyring({ type: "sr25519" });
    const charlie = new User(keyring, "//Ferdie");
    const tokenId = new BN(11);
    const tokenId2 = new BN(8);
    const tokensBefore = await getUserAssets(charlie.keyRingPair.address, [
      tokenId2,
      tokenId,
    ]);
    testLog.getLog().info(JSON.stringify(tokensBefore));
    const promises: any[] = [];
    //const nonce = await getCurrentNonce(charlie.keyRingPair.address)
    promises.push(buyAsset(
      charlie.keyRingPair,
      tokenId2,
      tokenId,
      new BN("1000"),
      new BN("100000")
    ));
    await Promise.all(promises);

    const tokensAfter = await getUserAssets(charlie.keyRingPair.address, [
      tokenId2,
      tokenId,
    ]);
    testLog.getLog().info(JSON.stringify(tokensBefore));
    testLog.getLog().info(JSON.stringify(tokensAfter));
    testLog.getLog().info("MGA::::  Free:    " + tokensAfter[0].free.sub(tokensBefore[0].free).toString() );
    testLog.getLog().info("MGA::::  Reserved:" + tokensAfter[0].reserved.sub(tokensBefore[0].reserved).toString() );
    testLog.getLog().info("MGA::::  Frozen:  " + tokensAfter[0].frozen.sub(tokensBefore[0].frozen).toString() );

    testLog.getLog().info("Token::::  Free:  " + tokensAfter[1].free.sub(tokensBefore[1].free).toString() );
    testLog.getLog().info("Token::  Reserved:" + tokensAfter[1].reserved.sub(tokensBefore[1].reserved).toString() );
    testLog.getLog().info("token:::  Frozen: " + tokensAfter[1].frozen.sub(tokensBefore[1].frozen).toString() );
  });
});
