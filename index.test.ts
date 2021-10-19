import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { api, getApi, initApi } from "./utils/api";
import { MGA_ASSET_ID } from "./utils/Constants";
import { waitNewBlock } from "./utils/eventListeners";
import { testLog } from "./utils/Logger";
import { signAndWaitTx, signSendAndWaitToFinishTx } from "./utils/txHandler";
import { User, AssetWallet } from "./utils/User";
import { getEnvironmentRequiredVars } from "./utils/utils";
import fs from "fs";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let testUser1, sudo, keyring;

describe("staking - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });
  //  const address1 = "5FsTyqA9zbFMmKb4126VGdZ5wKN1UTbDPt7KmgDJMx4f2H2W"; //3k
  //  const address2 = "5H9cTQvigmvocz8QjMXbptecrbYpazCwZaFvMfSG5XUMYTUL"; // <--3k
  //  const address3 = "5HNVF1davERpkXFLdyXNgn4j3B5mZPdGAYgrFVvv4hDrnaHq"; // <--4k

  test.only("xyk-pallet: Create new validator", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    testUser1 = new User(keyring);
    await fs.writeFileSync(
      testUser1.keyRingPair.address + ".json",
      JSON.stringify(testUser1.keyRingPair.toJson("mangata123"))
    );
    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    const { nonce } = await api.query.system.account(sudo.keyRingPair.address);
    await signAndWaitTx(
      api.tx.sudo.sudo(
        api.tx.tokens.mint(
          MGA_ASSET_ID,
          testUser1.keyRingPair.address,
          new BN("1000000000000")
        )
      ),
      sudo.keyRingPair,
      nonce.toNumber()
    );
    const nonce2 = await (
      await api.query.system.account(sudo.keyRingPair.address)
    ).nonce;
    await signAndWaitTx(
      api.tx.sudo.sudo(
        api.tx.tokens.mint(
          new BN(3),
          testUser1.keyRingPair.address,
          new BN(10000)
        )
      ),
      sudo.keyRingPair,
      nonce2.toNumber()
    );

    //    await sudo.mint(MGA_ASSET_ID, testUser1, new BN("1000000000000"));

    //  const [firstCurrency] = await Assets.setupUserWithCurrencies(
    //    testUser1,
    //    [new BN(11111)],
    //    sudo
    //  );
    //  await sudo.mint(new BN(3), testUser1, new BN(10000));
    await waitNewBlock();
    await signSendAndWaitToFinishTx(
      api?.tx.staking.bond(
        testUser1.keyRingPair.address,
        new BN(6000),
        "Staked",
        // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
        new BN(3)
      ),
      testUser1.keyRingPair
    );
    await waitNewBlock();
    await signSendAndWaitToFinishTx(
      api?.tx.staking.nominate([
        testUser1.keyRingPair.address,
        "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      ]),
      testUser1.keyRingPair
    ).then();
    await waitNewBlock();

    await signSendAndWaitToFinishTx(
      api?.tx.staking.validate({ commission: "0" }),
      testUser1.keyRingPair
    ).then();
    testLog.getLog().warn("done" + testUser1.keyRingPair.address);
  });

  test.skip("xyk-pallet: Drop from validator", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });
    //    const json = fs.readFileSync(testUser1.keyRingPair.address + ".json", {
    //      encoding: "utf8",
    //      flag: "r",
    //    });
    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.chill(),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });
  test.skip("xyk-pallet: only validate", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });
    //    const json = fs.readFileSync(testUser1.keyRingPair.address + ".json", {
    //      encoding: "utf8",
    //      flag: "r",
    //    });
    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.validate({ commission: "0" }),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });
  test.skip("xyk-pallet: nominate myself and alice", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.staking.nominate([
        user.keyRingPair.address,
        "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      ]),
      user.keyRingPair
    ).then();
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
});
