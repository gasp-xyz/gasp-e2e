import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { api, getApi, initApi } from "../utils/api";
import { MGA_ASSET_ID } from "../utils/Constants";
import { User, AssetWallet } from "../utils/User";
import { getEnvironmentRequiredVars } from "../utils/utils";
import fs from "fs";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { burnLiquidity, createPoolIfMissing, mintLiquidity } from "../utils/tx";
import { ApiPromise } from "@polkadot/api";
import { WsProvider } from "@polkadot/rpc-provider/ws";
import { options } from "@mangata-finance/types";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { sudo: sudoUserName, chainUri } = getEnvironmentRequiredVars();

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
  const address_2 =
    "/home/goncer/accounts/5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY";

  const address_1 =
    "/home/goncer/accounts/5FfBQ3kwXrbdyoqLPvcXRp7ikWydXawpNs2Ceu3WwFdhZ8W4";

  const address_3 =
    "/home/goncer/accounts/5FRL15Qj6DdoULKswCz7zevqe97bnHuEix794pTeGK7MhfDS";

  const address_4 =
    "/home/goncer/accounts/5H6YCgW24Z8xJDvxytQnKTwgiJGgye3uqvfQTprBEYqhNbBy";

  const users = [address_1, address_2, address_3, address_4]; //, address_3, address_4];
  const tokenId = new BN(12);
  const liqtokenId = new BN(13);
  let amount = new BN("100000000000000000000000000000");
  test("xyk-pallet: Finish tge and setup pool", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    await fs.writeFileSync(
      sudo.keyRingPair.address + ".json",
      JSON.stringify(sudo.keyRingPair.toJson("mangata123"))
    );
    keyring.addPair(sudo.keyRingPair);
    await signTx(
      api!,
      api!.tx.sudo.sudo(
        api!.tx.tokens.mint(
          MGA_ASSET_ID,
          sudo.keyRingPair.address,
          new BN("10000000000000000000")
        )
      ),
      sudo.keyRingPair
    );
    await signTx(
      api!,
      api!.tx.sudo.sudo(api!.tx.issuance.finalizeTge()),
      sudo.keyRingPair
    );
    await signTx(
      api!,
      api!.tx.sudo.sudo(api!.tx.issuance.initIssuanceConfig()),
      sudo.keyRingPair
    );
    await createPoolIfMissing(
      sudo,
      "10000000000000000000",
      MGA_ASSET_ID,
      tokenId
    );
  });
  test.each(users)(
    "xyk-pallet: Create new users with bonded amounts.",
    async (address) => {
      const file = await fs.readFileSync(address + ".json");
      keyring = new Keyring({ type: "sr25519" });
      sudo = new User(keyring, sudoUserName);
      testUser1 = new User(keyring, "asd", JSON.parse(file.toString()));
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
      keyring.pairs[0].decodePkcs8("mangata123");
      await testUser1.refreshAmounts(AssetWallet.BEFORE);

      await signTx(
        api!,
        api!.tx.sudo.sudo(
          api!.tx.tokens.mint(
            MGA_ASSET_ID,
            testUser1.keyRingPair.address,
            new BN(amount)
          )
        ),
        sudo.keyRingPair
      );
      await signTx(
        api!,
        api!.tx.sudo.sudo(
          api!.tx.tokens.mint(
            tokenId,
            testUser1.keyRingPair.address,
            new BN(amount)
          )
        ),
        sudo.keyRingPair
      );
      await createPoolIfMissing(
        sudo,
        "10000000000000000000",
        MGA_ASSET_ID,
        tokenId
      );
    }
  );
  test("xyk-pallet: promote pool", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    await fs.writeFileSync(
      sudo.keyRingPair.address + ".json",
      JSON.stringify(sudo.keyRingPair.toJson("mangata123"))
    );
    keyring.addPair(sudo.keyRingPair);
    await signTx(
      api!,
      api!.tx.sudo.sudo(api!.tx.xyk.promotePool(liqtokenId)),
      sudo.keyRingPair
    );
  });
  test("xyk-pallet: Mint / burn into rewardd pool", async () => {
    const burn = false;
    const mint = true;
    const activate = false;
    const deactivate = false;
    amount = new BN(1000000000);

    const promises: Promise<MangataGenericEvent[]>[] = [];
    for (let index = 0; index < users.length; index++) {
      const address = users[index];
      const file = await fs.readFileSync(address + ".json");
      keyring = new Keyring({ type: "sr25519" });
      sudo = new User(keyring, sudoUserName);
      testUser1 = new User(keyring, "asd", JSON.parse(file.toString()));
      // add users to pair.
      keyring.addPair(testUser1.keyRingPair);
      keyring.pairs[0].decodePkcs8("mangata123");
      await testUser1.refreshAmounts(AssetWallet.BEFORE);
      if (burn) {
        promises.push(
          burnLiquidity(
            testUser1.keyRingPair,
            new BN(0),
            tokenId,
            amount.divn(2)
          )
        );
      }
      if (mint) {
        promises.push(
          mintLiquidity(
            testUser1.keyRingPair,
            MGA_ASSET_ID,
            tokenId,
            amount.divn(2),
            amount.divn(2).addn(5)
          )
        );
      }
      if (activate) {
        promises.push(
          signTx(
            api!,
            api!.tx.xyk.activateLiquidity(liqtokenId, amount.divn(2)),
            testUser1.keyRingPair
          )
        );
      }
      if (deactivate) {
        promises.push(
          signTx(
            api!,
            api!.tx.xyk.deactivateLiquidity(liqtokenId, amount.divn(2)),
            testUser1.keyRingPair
          )
        );
      }
    }
    await Promise.all(promises);
  });
  test.skip("xyk-pallet: claim rewards", async () => {
    const addresses = users; //, address_1]; //, address_2, address_3, address_4];
    const promises: Promise<MangataGenericEvent[]>[] = [];
    for (let index = 0; index < addresses.length; index++) {
      const address = addresses[index];
      const file = await fs.readFileSync(address + ".json");
      keyring = new Keyring({ type: "sr25519" });
      sudo = new User(keyring, sudoUserName);
      testUser1 = new User(keyring, "asd", JSON.parse(file.toString()));
      // add users to pair.
      keyring.addPair(testUser1.keyRingPair);
      keyring.pairs[0].decodePkcs8("mangata123");
      await testUser1.refreshAmounts(AssetWallet.BEFORE);
      const provider = new WsProvider(chainUri);
      const api2 = await new ApiPromise(options({ provider })).isReady;
      const result = await (api2.rpc as any).xyk.calculate_rewards_amount(
        testUser1.keyRingPair.address,
        liqtokenId
      );
      promises.push(
        signTx(
          api!,
          api!.tx.xyk.claimRewards(
            liqtokenId,
            new BN(result.notYetClaimed.toString()).add(
              new BN(result.toBeClaimed.toString())
            )
          ),
          testUser1.keyRingPair
        )
      );
    }
    await Promise.all(promises);
  });
});
