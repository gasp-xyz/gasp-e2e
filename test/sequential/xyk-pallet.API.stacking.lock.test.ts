/*
 *
 * @group xyk
 * @group api
 * @group sequential
 */
import { api, getApi, initApi } from "../../utils/api";
import { getTokensAccountInfo } from "../../utils/tx";
import { hexToBn } from "@polkadot/util";

import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { MGA_ASSET_ID, MGA_DEFAULT_LIQ_TOKEN } from "../../utils/Constants";
import { signSendAndWaitToFinishTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

const ASSET_ID_MGA_ETH = MGA_DEFAULT_LIQ_TOKEN;
const ASSET_ID_MGA = MGA_ASSET_ID;

describe("xyk-pallet - Sell Asset: validate Errors:", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);
    sudo = new User(keyring, sudoUserName);
    keyring.addFromUri(sudoUserName);

    await sudo.mint(
      ASSET_ID_MGA,
      testUser1,
      new BN(10000).add(new BN(Math.pow(10, 18).toString()))
    );
    await sudo.mint(
      ASSET_ID_MGA_ETH,
      testUser1,
      new BN("20000000000000000000")
    );
    await testUser1.addMGATokens(sudo);
  });

  test("joinCandidates operation reserves some tokens", async () => {
    const candidates = JSON.parse(
      JSON.stringify(await api?.query.parachainStaking.candidatePool())
    );
    await signSendAndWaitToFinishTx(
      api?.tx.parachainStaking.joinCandidates(
        new BN("10000000000000000000"),
        new BN(3),
        // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
        new BN(candidates.length)
      ),
      testUser1.keyRingPair
    );
    const tokenStatuses = await getTokensAccountInfo(
      testUser1.keyRingPair.address,
      new BN(3)
    );
    expect(hexToBn(tokenStatuses.free.toString())).bnEqual(
      new BN("10000000000000000000")
    );
    expect(hexToBn(tokenStatuses.reserved.toString())).bnEqual(
      new BN("10000000000000000000")
    );
    expect(tokenStatuses.frozen.toString()).toEqual("0");
  });
});
