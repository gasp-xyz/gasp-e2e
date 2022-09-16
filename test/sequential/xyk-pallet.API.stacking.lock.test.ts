/*
 *
 * @group xyk
 * @group api
 * @group sequential
 */
import { getApi, initApi } from "../../utils/api";
import { getTokensAccountInfo, joinCandidate } from "../../utils/tx";
import { hexToBn } from "@polkadot/util";

import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { MGA_DEFAULT_LIQ_TOKEN } from "../../utils/Constants";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

const ASSET_ID_MGA_ETH = MGA_DEFAULT_LIQ_TOKEN;

describe("xyk-pallet - Sell Asset: validate Errors:", () => {
  let testUser1: User;

  let keyring: Keyring;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });

    // setup users
    await setupApi();
    [testUser1] = setupUsers();
    keyring.addFromUri(sudoUserName);
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(
        testUser1,
        new BN(10000)
          .add(new BN(Math.pow(10, 20).toString()))
          .add(new BN(Math.pow(10, 20).toString()))
      ),
      Assets.mintToken(
        ASSET_ID_MGA_ETH,
        testUser1,
        new BN("20000000000000000000")
      )
    );
  });

  test("joinCandidates operation reserves some tokens", async () => {
    await joinCandidate(
      testUser1.keyRingPair,
      new BN(3),
      new BN("10000000000000000000")
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
