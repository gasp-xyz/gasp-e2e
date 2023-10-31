import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getApi, initApi } from "../utils/api";
import { User } from "../utils/User";
import fs from "fs";
import { getNextAssetId, setAssetInfo } from "../utils/txHandler";
import { Assets } from "../utils/Assets";

import "dotenv/config";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let keyring;

describe("AssetInfo - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });
  const ksm = true;
  const dot = "4";
  const btc = "5";
  const usd = "6";
  //develop-v4
  const sudoAddress = "5CthcoS3CYHoVHDMUacydayRLMzMWedKryjsrvzrmv3VHCKP";

  test("Add Assets info", async () => {
    const pathToFiles = "/home/goncer/accounts/";
    keyring = new Keyring({ type: "sr25519" });
    const json = fs.readFileSync(pathToFiles + sudoAddress + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const sudo = new User(keyring, "sudo", JSON.parse(json));
    keyring.addPair(sudo.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    await sudo.addMGATokens(sudo);
    const nextAssetId = await getNextAssetId();
    const numberOfMissingTokens = 7 - nextAssetId.toNumber();

    if (numberOfMissingTokens > 0) {
      const tokens = Array.from(Array(7).keys())
        .reverse()
        .slice(0, numberOfMissingTokens);
      const assets = tokens.flatMap(() => new BN(Math.pow(10, 20).toString()));
      await Assets.setupUserWithCurrencies(sudo, assets, sudo).then(
        (values) => {
          return values.map((val) => val.toNumber());
        },
      );
    }
    if (ksm) {
      await setAssetInfo(
        sudo,
        new BN(dot),
        "mKSM",
        "mKSM",
        "Relay chain Kusama token",
        new BN(12),
      );
    } else {
      await setAssetInfo(
        sudo,
        new BN(dot),
        "mDOT",
        "mDOT",
        "Relay chain Polkadot token",
        new BN(10),
      );
    }

    await setAssetInfo(
      sudo,
      new BN(btc),
      "mBTC",
      "mBTC",
      "0xb171e7c2316ecd042d1ea148cdd930ea484c37ac",
      new BN(18),
    );
    await setAssetInfo(
      sudo,
      new BN(usd),
      "mUSD",
      "mUSD",
      "0xc6f4f60fa2d578b2b83cde49b8be624bd439eb98",
      new BN(18),
    );
  });

  test("Send tokens to Alice, the MGA provider in airdrop", async () => {
    const pathToFiles = "/home/goncer/accounts/";
    keyring = new Keyring({ type: "sr25519" });
    const json = fs.readFileSync(pathToFiles + sudoAddress + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const sudo = new User(keyring, "sudo", JSON.parse(json));
    keyring.addPair(sudo.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    const alice = new User(keyring, "//Alice");
    await alice.addMGATokens(sudo, new BN("10000000000000000000000000"));
  });

  test("Send tokens to Michal address", async () => {
    const pathToFiles = "/home/goncer/accounts/";
    keyring = new Keyring({ type: "sr25519" });
    const json = fs.readFileSync(pathToFiles + sudoAddress + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const sudo = new User(keyring, "sudo", JSON.parse(json));
    keyring.addPair(sudo.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    const target = new User(keyring);
    target.addFromAddress(
      keyring,
      "5CP5sgWw94GoQCGvm4qeNgKTw41Scnk2F41uPe4SSAPVPoCU",
    );
    await sudo.mint(new BN(4), target, new BN(Math.pow(10, 20).toString()));
    await sudo.mint(new BN(5), target, new BN(Math.pow(10, 20).toString()));
    await sudo.mint(new BN(6), target, new BN(Math.pow(10, 20).toString()));
    await target.addMGATokens(sudo);
  });

  test("Create big pools", async () => {
    const pathToFiles = "/home/goncer/accounts/";
    keyring = new Keyring({ type: "sr25519" });
    const json = fs.readFileSync(pathToFiles + sudoAddress + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const sudo = new User(keyring, "sudo", JSON.parse(json));
    keyring.addPair(sudo.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    await sudo.addMGATokens(sudo);
    const poolSizeAsset = new BN("100000000000000000000000000000000");
    const poolSizeMGA = new BN("100000000000000000000000000000000");
    await sudo.mint(new BN(0), sudo, poolSizeMGA.muln(3));
    await sudo.mint(new BN(4), sudo, poolSizeAsset);
    await sudo.mint(new BN(5), sudo, poolSizeAsset);
    await sudo.mint(new BN(6), sudo, poolSizeAsset);

    await sudo.createPoolToAsset(
      poolSizeMGA,
      poolSizeAsset,
      new BN(0),
      new BN(dot),
    );
    await sudo.createPoolToAsset(
      poolSizeMGA,
      poolSizeAsset,
      new BN(0),
      new BN(btc),
    );
    await sudo.createPoolToAsset(
      poolSizeMGA,
      poolSizeAsset,
      new BN(0),
      new BN(usd),
    );
  });
});
