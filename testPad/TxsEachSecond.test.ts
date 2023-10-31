import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getApi, initApi } from "../utils/api";
import { waitNewBlock } from "../utils/eventListeners";
import { User, AssetWallet } from "../utils/User";
import { getEnvironmentRequiredVars, sleep } from "../utils/utils";
import fs from "fs";
import { Mangata } from "@mangata-finance/sdk";
import { testLog } from "../utils/Logger";
import { Assets } from "../utils/Assets";

import "dotenv/config";

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let testUser1: User, sudo, keyring;

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

  const user = "//Charlie";

  test.each([user])("SendTxEachSecond", async () => {
    let cont = 3000;
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    testUser1 = new User(keyring, user);
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
    const mangata = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
    const api = await mangata.api();
    const [firstCurrency, secondCurrency] =
      await Assets.setupUserWithCurrencies(
        testUser1,
        [new BN("100000000000000000"), new BN("100000000000000000")],
        sudo,
      );
    await testUser1.addMGATokens(sudo);
    await testUser1.createPoolToAsset(
      new BN("30000000000000000"),
      new BN("30000000000000000"),
      firstCurrency,
      secondCurrency,
    );

    const account = await (
      await api.query.system.account(testUser1.keyRingPair.address)
    ).toHuman();
    const nonce = JSON.parse(JSON.stringify(account)).nonce;
    let userNonce = parseInt(nonce);
    const p = [];
    do {
      cont--;
      testLog.getLog().info("sending TXs-" + userNonce);
      p.push(
        mangata.xyk.multiswapSellAsset({
          amount: new BN(10),
          account: testUser1.keyRingPair,
          tokenIds: [firstCurrency.toString(), secondCurrency.toString()],
          txOptions: { nonce: new BN(userNonce) },
          minAmountOut: new BN(0),
        }),
      );
      userNonce++;
      testLog.getLog().info("Sent -" + userNonce);
      await sleep(1000);
    } while (cont > 0);
    const results = await Promise.all(p);
    results.forEach((r) => testLog.getLog().info(JSON.stringify(r)));
    await waitNewBlock();
  });
});
