import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { api, getApi, initApi } from "../utils/api";
import { GASP_ASSET_ID } from "../utils/Constants";
import { waitNewBlock } from "../utils/eventListeners";
import { testLog } from "../utils/Logger";
import { signSendAndWaitToFinishTx } from "../utils/txHandler";
import { User, AssetWallet } from "../utils/User";
import {
  findBlockWithExtrinsicSigned,
  getEnvironmentRequiredVars,
  getTokensDiffForBlockAuthor,
} from "../utils/utils";
import fs from "fs";
import { Assets } from "../utils/Assets";
import { hexToBn } from "@polkadot/util";
import { Mangata, signTx } from "gasp-sdk";
import { FeeTxs } from "../utils/tx";

import "dotenv/config";

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
  //const address = "5H8QjhHEtbrttHDJL4ha5Kry2KBgLkerB6cbKFSfJqG44tcW"; // aura!
  //const address = "5HLsUSDLyQjDSNriuhzbzWBNEbfXjUjt5WmALLpQkLLCU2Ex"; // granpa

  //  const address = "5FRL15Qj6DdoULKswCz7zevqe97bnHuEix794pTeGK7MhfDS"; // pair1
  //const address = "5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY"; // michal

  const address =
    "/home/goncer/5FfBQ3kwXrbdyoqLPvcXRp7ikWydXawpNs2Ceu3WwFdhZ8W4";
  //    const address =
  //      "/home/goncer/5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY";

  test.each(["6666", "6666", "6666", "6666"])(
    "xyk-pallet: Create new users with bonded amounts.",
    async (bondAmount) => {
      keyring = new Keyring({ type: "sr25519" });
      sudo = new User(keyring, sudoUserName);
      testUser1 = new User(keyring);
      await fs.writeFileSync(
        testUser1.keyRingPair.address + ".json",
        JSON.stringify(testUser1.keyRingPair.toJson("mangata123")),
      );
      await fs.writeFileSync(
        sudo.keyRingPair.address + ".json",
        JSON.stringify(sudo.keyRingPair.toJson("mangata123")),
      );
      // add users to pair.
      keyring.addPair(testUser1.keyRingPair);
      keyring.addPair(sudo.keyRingPair);
      await testUser1.refreshAmounts(AssetWallet.BEFORE);

      const { nonce } = await api.query.system.account(
        sudo.keyRingPair.address,
      );
      await signTx(
        api,
        api.tx.sudo.sudo(
          api.tx.tokens.mint(
            GASP_ASSET_ID,
            testUser1.keyRingPair.address,
            new BN("1000000000000"),
          ),
        ),
        sudo.keyRingPair,
        { nonce: new BN(nonce) },
      );
      const nonce2 = await (
        await api.query.system.account(sudo.keyRingPair.address)
      ).nonce;
      await signTx(
        api,
        api.tx.sudo.sudo(
          api.tx.tokens.mint(
            new BN(3),
            testUser1.keyRingPair.address,
            new BN(10000),
          ),
        ),
        sudo.keyRingPair,
        { nonce: new BN(nonce2.toNumber()) },
      );

      //    await sudo.mint(GASP_ASSET_ID, testUser1, new BN("1000000000000"));

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
          new BN(3),
        ),
        testUser1.keyRingPair,
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
    },
  );

  test("V4 xyk-pallet: Bob offline", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.api();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Bob");
    keyring.addPair(user.keyRingPair);

    await signSendAndWaitToFinishTx(
      api?.tx.parachainStaking.goOffline(),
      user.keyRingPair,
    ).then();
    testLog.getLog().warn("done");
  });
  test("V4 xyk-pallet: Bob online", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.getApi();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Bob");
    keyring.addPair(user.keyRingPair);

    await signSendAndWaitToFinishTx(
      api?.tx.parachainStaking.goOnline(),
      user.keyRingPair,
    ).then();
    testLog.getLog().warn("done");
  });
  test("V4 xyk-pallet: BlocksPerRound", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.getApi();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Bob");
    keyring.addPair(user.keyRingPair);

    await signSendAndWaitToFinishTx(
      api?.tx.parachainStaking.setBlocksPerRound(1),
      user.keyRingPair,
    ).then();
    testLog.getLog().warn("done");
  });
  test("V4 xyk-pallet: remove staking liq token", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.getApi();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Bob");
    keyring.addPair(user.keyRingPair);
    const params = {
      paired_or_liquidity_token: { Liquidity: 3 },
      current_liquidity_tokens: 3,
    };
    await signSendAndWaitToFinishTx(
      api?.tx.parachainStaking.removeStakingLiquidityToken(
        params.paired_or_liquidity_token,
        3,
      ),
      user.keyRingPair,
    ).then();
    testLog.getLog().warn("done");
  });

  test("V4 xyk-pallet: scheduleCandidateBondLess", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.getApi();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Bob");
    keyring.addPair(user.keyRingPair);
    await signSendAndWaitToFinishTx(
      api?.tx.parachainStaking.scheduleCandidateBondLess(
        new BN("1999999999999999999999"),
      ),
      user.keyRingPair,
    ).then();
    testLog.getLog().warn("done");
  });
  test("V4 xyk-pallet: executeCandidateBond", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.getApi();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Bob");
    keyring.addPair(user.keyRingPair);
    await signSendAndWaitToFinishTx(
      api?.tx.parachainStaking.executeCandidateBondRequest(
        user.keyRingPair.address,
      ),
      user.keyRingPair,
    ).then();
    testLog.getLog().warn("done");
  });

  test.each(["6666"])(
    "V4 - xyk-pallet: Create new users with bonded amounts.",
    async () => {
      keyring = new Keyring({ type: "sr25519" });
      sudo = new User(keyring, sudoUserName);
      testUser1 = new User(keyring);
      await fs.writeFileSync(
        testUser1.keyRingPair.address + ".json",
        JSON.stringify(testUser1.keyRingPair.toJson("mangata123")),
      );
      await fs.writeFileSync(
        sudo.keyRingPair.address + ".json",
        JSON.stringify(sudo.keyRingPair.toJson("mangata123")),
      );
      // add users to pair.
      keyring.addPair(testUser1.keyRingPair);
      sudo = new User(keyring, sudoUserName);
      keyring.addPair(sudo.keyRingPair);
      await testUser1.refreshAmounts(AssetWallet.BEFORE);

      const { nonce } = await api.query.system.account(
        sudo.keyRingPair.address,
      );
      await signTx(
        api,
        api.tx.sudo.sudo(
          api.tx.tokens.mint(
            GASP_ASSET_ID,
            testUser1.keyRingPair.address,
            new BN("1000000000000"),
          ),
        ),
        sudo.keyRingPair,
        { nonce: new BN(nonce) },
      );
      const nonce2 = await (
        await api.query.system.account(sudo.keyRingPair.address)
      ).nonce;
      await signTx(
        api,
        api.tx.sudo.sudo(
          api.tx.tokens.mint(
            new BN(3),
            testUser1.keyRingPair.address,
            new BN("100000000000000000000"),
          ),
        ),
        sudo.keyRingPair,
        { nonce: new BN(nonce2.toNumber()) },
      );

      await waitNewBlock();
      await signSendAndWaitToFinishTx(
        api?.tx.parachainStaking.joinCandidates(
          new BN("100000000000000000000"),
          new BN(3),
          // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
          new BN(3),
        ),
        testUser1.keyRingPair,
      );
      await waitNewBlock();
    },
  );
  test("V4 xyk-pallet: bond", async () => {
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
      api?.tx.parachainStaking.joinCandidates(
        new BN("100000000000000000000"),
        new BN(3),
        // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
        new BN(3),
      ),
      user.keyRingPair,
    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("V4 xyk-pallet: joinCandidates", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    const json = fs.readFileSync(
      `/home/goncer/5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY.json`,
      {
        encoding: "utf8",
        flag: "r",
      },
    );
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.parachainStaking.joinCandidates(
        new BN("100000000000000000000"),
        new BN(3),
        new BN(3),
      ),
      user.keyRingPair,
    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });

  test("V4 xyk-pallet: full node setup.", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    const json = fs.readFileSync(
      `/home/goncer/5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY.json`,
      {
        encoding: "utf8",
        flag: "r",
      },
    );

    const testUser1 = new User(keyring, "aasd", JSON.parse(json));
    const user = testUser1;
    //    const pk = u8aToHex(user.keyRingPair.publicKey);
    //    const stringPk = pk.toString();
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    sudo = new User(keyring, sudoUserName);
    keyring.addPair(sudo.keyRingPair);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    const { nonce } = await api.query.system.account(sudo.keyRingPair.address);
    await signTx(
      api,
      api.tx.sudo.sudo(
        api.tx.tokens.mint(
          GASP_ASSET_ID,
          testUser1.keyRingPair.address,
          new BN(Math.pow(10, 20).toString()),
        ),
      ),
      sudo.keyRingPair,
      { nonce: new BN(nonce) },
    );
    const nonce2 = await (
      await api.query.system.account(sudo.keyRingPair.address)
    ).nonce;
    await signTx(
      api,
      api.tx.sudo.sudo(
        api.tx.tokens.mint(
          new BN(3),
          testUser1.keyRingPair.address,
          new BN("11000000000000000000000"),
        ),
      ),
      sudo.keyRingPair,
      { nonce: new BN(nonce2.toNumber()) },
    );

    await waitNewBlock();
    await signSendAndWaitToFinishTx(
      api?.tx.parachainStaking.joinCandidates(
        new BN("11000000000000000000000"),
        new BN(3),
        // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
        new BN(3),
      ),
      testUser1.keyRingPair,
    );
    await waitNewBlock();
    const rpcResult = await api?.rpc.author.rotateKeys();

    await signSendAndWaitToFinishTx(
      api?.tx.session.setKeys(rpcResult.toString(), "0x00"),
      user.keyRingPair,
    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });

  test("V4 xyk-pallet: setKeys", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    const json = fs.readFileSync(
      `/home/goncer/5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY.json`,
      {
        encoding: "utf8",
        flag: "r",
      },
    );
    const user = new User(keyring, "aasd", JSON.parse(json));
    //const pk = u8aToHex(user.keyRingPair.publicKey);

    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    //    const rpcResult = await api?.rpc.author.rotateKeys();
    const rpcResult =
      "0xa02218669065017eb04a952e24e9ec1724d639449b8871d410df44883fb22c6d";
    await signSendAndWaitToFinishTx(
      api?.tx.session.setKeys(rpcResult.toString(), "0x00"),
      user.keyRingPair,
    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("V4 xyk-pallet: bond more", async () => {
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
    const amount = "5000000000000000000000";
    //const pk = u8aToHex(user.keyRingPair.publicKey);
    sudo = new User(keyring, sudoUserName);
    keyring.addPair(sudo.keyRingPair);
    const { nonce } = await api.query.system.account(sudo.keyRingPair.address);
    await signTx(
      api,
      api.tx.sudo.sudo(
        api.tx.tokens.mint(
          new BN(3),
          testUser1.keyRingPair.address,
          new BN(amount),
        ),
      ),
      sudo.keyRingPair,
      { nonce: new BN(nonce.toNumber()) },
    );

    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.parachainStaking.scheduleCandidateBondMore(amount),
      user.keyRingPair,
    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("V4 xyk-pallet: set numberOfcollators", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    //const pk = u8aToHex(user.keyRingPair.publicKey);
    sudo = new User(keyring, sudoUserName);
    keyring.addPair(sudo.keyRingPair);
    const { nonce } = await api.query.system.account(sudo.keyRingPair.address);
    await signTx(
      api,
      api.tx.sudo.sudo(api.tx.parachainStaking.setTotalSelected(new BN(3))),
      sudo.keyRingPair,
      { nonce: new BN(nonce.toNumber()) },
    );

    await waitNewBlock();
    testLog.getLog().warn("done");
  });
  test("V4 xyk-pallet: Leave candidate", async () => {
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
    //const pk = u8aToHex(user.keyRingPair.publicKey);
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");

    await signSendAndWaitToFinishTx(
      api?.tx.parachainStaking.scheduleLeaveCandidates(3),
      user.keyRingPair,
    );
    //    await signSendAndWaitToFinishTx(
    //      api?.tx.parachainStaking.executeLeaveCandidates(user.keyRingPair.address),
    //      user.keyRingPair
    //    );
    await waitNewBlock();
    testLog.getLog().warn("done");
  });

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
      user.keyRingPair,
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
      user.keyRingPair,
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
      user.keyRingPair,
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
      user.keyRingPair,
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
        new BN(3),
      ),
      user.keyRingPair,
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
      user.keyRingPair,
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
      user.keyRingPair,
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
            index,
          ),
          user.keyRingPair,
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
      user.keyRingPair,
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
      user.keyRingPair,
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
    await signTx(
      api,
      api.tx.sudo.sudo(api.tx.staking.forceNewEraAlways()),
      sudo.keyRingPair,
      { nonce: nonce },
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
    const fileLocation = `/home/goncer/5EA2ReGG4XHeBi2VMVtBbSnsE7esMTEsy2FprYavCN6Sb6zv.json`;
    const json = fs.readFileSync(fileLocation, {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    //await user.addGASPTokens(sudo);
    //await sudo.mint(new BN(6), user, new BN("22000000000000000000000"));
    await sudo.mint(new BN(0), user, new BN("11000000000000000000000"));
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
    //await user.addGASPTokens(sudo);
    const response = await api.query.tokens.accounts.entries();
    const userAddress = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    const userEntries = response.filter((value) =>
      (value[0].toHuman() as string[]).includes(userAddress),
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
          JSON.parse(userEntries[0][1].toString()).miscFrozen,
        ),
      }),
    );
  });
  test("sellAsset", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    const json = fs.readFileSync(address + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    keyring.addPair(user.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    //await user.addGASPTokens(sudo);
    await new FeeTxs().sellAsset(
      user.keyRingPair,
      new BN(0),
      new BN(1),
      new BN(0),
      new BN(100),
    );
  });

  test("get term percentage status", async () => {
    while (true) {
      const metadata = await api.derive.elections.info();
      const bestNumber = await api.derive.chain.bestNumber();
      testLog.getLog().info(bestNumber.mod(metadata.termDuration));
      const perrcentage = bestNumber
        .mod(metadata.termDuration)
        .mul(new BN(100))
        .div(metadata.termDuration.toBn());
      testLog.getLog().info(perrcentage);
      await waitNewBlock();
    }
  });
  test("block author", async () => {
    const blockNumber = await findBlockWithExtrinsicSigned(
      [1403, 1406],
      "5D4rciiZg4Lk4478mMsaMsx8b5KEefk15Vmf1HkzKiBrw1cT",
    );
    const diff = await getTokensDiffForBlockAuthor(blockNumber);
    testLog.getLog().warn(diff.toString());
  });
});
