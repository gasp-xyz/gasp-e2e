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
import { MGA_DEFAULT_LIQ_TOKEN } from "../../utils/Constants";
import { signSendAndWaitToFinishTx } from "../../utils/txHandler";
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
    testUser1 = new User(keyring);
    keyring.addFromUri(sudoUserName);

    await setupApi();
    await setupUsers();
    const minStake = api?.consts.parachainStaking.minCandidateStk.toString();
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(ASSET_ID_MGA_ETH, testUser1, new BN(minStake!).muln(2)),
      Assets.mintNative(
        testUser1,
        new BN(10000).add(new BN(Math.pow(10, 20).toString()))
      ),
      Assets.mintNative(testUser1)
    );
  });

  test("joinCandidates operation reserves some tokens", async () => {
    const candidates = JSON.parse(
      JSON.stringify(await api?.query.parachainStaking.candidatePool())
    );
    const liqAssets =
      await api?.query.parachainStaking.stakingLiquidityTokens();
    const liqAssetsCount = [...liqAssets!.keys()].length;
    const amountToJoin = new BN(
      api!.consts.parachainStaking.minCandidateStk!.toString()
    ).addn(1234);
    await signSendAndWaitToFinishTx(
      // @ts-ignore
      api?.tx.parachainStaking.joinCandidates(
        amountToJoin,
        new BN(3),
        "AvailableBalance",
        // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
        new BN(candidates.length),
        // @ts-ignore
        new BN(liqAssetsCount)
      ),
      testUser1.keyRingPair
    );
    const tokenStatuses = await getTokensAccountInfo(
      testUser1.keyRingPair.address,
      new BN(3)
    );
    const minStake = new BN(
      api!.consts.parachainStaking.minCandidateStk.toString()
    );
    expect(hexToBn(tokenStatuses.free.toString())).bnEqual(
      minStake.muln(2).sub(amountToJoin)
    );
    expect(hexToBn(tokenStatuses.reserved.toString())).bnEqual(amountToJoin);
    expect(tokenStatuses.frozen.toString()).toEqual("0");
  });
});
