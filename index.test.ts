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
  //const address = "5GQuHf4bhNftjAfRf6PyNQ7gEsMheDVu6EVKaZDwdWwfzKe2"; //2k
  //const address2 = "5EkarfGa1tr7weepVwYB3of8YJosQTH9yc49bnrhXrhpuq5W"; // <--3k
  //const address = "5EkarfGa1tr7weepVwYB3of8YJosQTH9yc49bnrhXrhpuq5W"; // <--4k
  const address = "5ETtEUWEHFagRcmdTFDcogZMHjPDx41eo6tp1y1kepHtyoRY";
  test.each(["2000", "3000", "4000", "5000"])(
    "xyk-pallet: Create new validator",
    async (bondAmount) => {
      keyring = new Keyring({ type: "sr25519" });
      sudo = new User(keyring, sudoUserName);
      testUser1 = new User(keyring);
      await fs.writeFileSync(
        testUser1.keyRingPair.address + ".json",
        JSON.stringify(testUser1.keyRingPair.toJson("mangata123"))
      );
      await fs.writeFileSync(
        sudo.keyRingPair.address + ".json",
        JSON.stringify(sudo.keyRingPair.toJson("mangata123"))
      );
      // add users to pair.
      keyring.addPair(testUser1.keyRingPair);
      keyring.addPair(sudo.keyRingPair);
      await testUser1.refreshAmounts(AssetWallet.BEFORE);

      const { nonce } = await api.query.system.account(
        sudo.keyRingPair.address
      );
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
          new BN(bondAmount),
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
    }
  );

  test("xyk-pallet: Drop from validator", async () => {
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
  test("xyk-pallet: nominate", async () => {
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
        "5Ebqv1DfLBbf9brPHVinMtfxRfYzuoc22VZKHsVu6DomcCo3",
      ]),
      user.keyRingPair
    ).then();
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: bond_extra", async () => {
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
      api?.tx.staking.bondExtra(new BN(1000)),
      user.keyRingPair
    ).then();
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: unbond", async () => {
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
      api?.tx.staking.unbond(new BN(3000)),
      user.keyRingPair
    ).then();
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: withdraw", async () => {
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
      api?.tx.staking.withdrawUnbonded(new BN(3000)),
      user.keyRingPair
    ).then();
    await waitNewBlock();
    testLog.getLog().warn("done");
  });

  test("xyk-pallet: force new era always", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    const { nonce } = await api.query.system.account(sudo.keyRingPair.address);
    await signAndWaitTx(
      api.tx.sudo.sudo(api.tx.staking.forceNewEraAlways()),
      sudo.keyRingPair,
      nonce.toNumber()
    );
  });
});
