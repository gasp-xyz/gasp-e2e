import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { api, getApi, initApi } from "../utils/api";
import { MGA_ASSET_ID } from "../utils/Constants";
import { waitNewBlock } from "../utils/eventListeners";
import { testLog } from "../utils/Logger";
import { signAndWaitTx, signSendAndWaitToFinishTx } from "../utils/txHandler";
import { User, AssetWallet } from "../utils/User";
import { getEnvironmentRequiredVars } from "../utils/utils";
import fs from "fs";
import { Assets } from "../utils/Assets";
import { hexToBn } from "@polkadot/util";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let testUser1, sudo, keyring;

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
  //const address = "5Dy7VqFgArCo6PVFAVgSjEHace12vABr1doNM8uWbENDwUzC"; // <--candidate1
  //const address = "5CUuPs8noEQHo9rk7tbd4BxBYcUkJmNpQ8rDyV3c6uXYjrnK"; // <--candidate2
  //const address = "5GGbPY2kmf2CQCTVKL8FkGDst6JQWF7bfk8FCbQj2HkuHosK"; // <--vote to candidate1
  //const address = "5CPFKKg6cUH2XRzzg3Zb4UYVY1cTUzrxUFiqzbF94voStUZx"; // SUDO!
  const address = "5DLso4BvYrFx4vudEeq2YpWB4c6HuzxrSaUAg7HKdLpP1joi"; // validator!

  test.each(["6666", "6666", "6666", "6666"])(
    "xyk-pallet: Create new users with bonded amounts.",
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
      //      await signSendAndWaitToFinishTx(
      //        api?.tx.staking.nominate([
      //          testUser1.keyRingPair.address,
      //          "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      //        ]),
      //        testUser1.keyRingPair
      //      ).then();
      //      await waitNewBlock();

      //      await signSendAndWaitToFinishTx(
      //        api?.tx.staking.validate({ commission: "0" }),
      //        testUser1.keyRingPair
      //      ).then();
      //      testLog.getLog().warn("done" + testUser1.keyRingPair.address);
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
  test("xyk-pallet: only validate", async () => {
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
        "5CPFKKg6cUH2XRzzg3Zb4UYVY1cTUzrxUFiqzbF94voStUZx",
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
  test("xyk-pallet: bond", async () => {
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
      api?.tx.staking.bond(
        user.keyRingPair.address,
        new BN("1000"),
        "Staked",
        // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
        new BN(3)
      ),
      user.keyRingPair
    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: validate", async () => {
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
      api?.tx.staking.validate({ commission: "99" }),
      user.keyRingPair
    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: rebond", async () => {
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
      api?.tx.staking.rebond(new BN("80")),
      user.keyRingPair
    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("xyk-pallet: payoutStakers", async () => {
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
    for (let index = 30; index < 31; index++) {
      try {
        await signSendAndWaitToFinishTx(
          api?.tx.staking.payoutStakers(
            "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
            index
          ),
          user.keyRingPair
        ).then();
      } catch (error) {}
    }
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
      api?.tx.staking.unbond(new BN(1111)),
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
  test("create token", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    await Assets.setupUserWithCurrencies(user, [new BN("1000000000000")], sudo);
  });
  test("mint", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    //await user.addMGATokens(sudo);
    await sudo.mint(new BN(3), user, new BN("1000000"));
  });
  test("getTokens", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    //await user.addMGATokens(sudo);
    const response = await api.query.tokens.accounts.entries();
    const userAddress = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    const userEntries = response.filter((value) =>
      (value[0].toHuman() as string[]).includes(userAddress)
    );
    const tokenValues: Map<
      BN,
      { free: BN; reserved: BN; miscFrozen: BN; feeFrozen: BN }
    > = new Map();
    userEntries.forEach((value) =>
      tokenValues.set(new BN(value[0].toHuman()[1]), {
        free: hexToBn(JSON.parse(userEntries[0][1].toString()).free),
        reserved: hexToBn(JSON.parse(userEntries[0][1].toString()).reserved),
        feeFrozen: hexToBn(JSON.parse(userEntries[0][1].toString()).feeFrozen),
        miscFrozen: hexToBn(
          JSON.parse(userEntries[0][1].toString()).miscFrozen
        ),
      })
    );
  });
});
