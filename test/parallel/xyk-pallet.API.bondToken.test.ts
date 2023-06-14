/*
 *
 * @group xyk
 * @group accuracy
 * @group rewardsV2Parallel
 */
import { getApi, initApi } from "../../utils/api";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";
import { getLiquidityAssetId, joinCandidate } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Staking } from "../../utils/Staking";
import { Xyk } from "../../utils/xyk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;

let sudo: User;

let keyring: Keyring;
let tokenId: BN;
let liqToken: BN;
let minStk: BN;

//creating pool

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

beforeEach(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser1 = new User(keyring);
  sudo = new User(keyring, sudoUserName);

  minStk = new BN(
    (await getApi()).consts.parachainStaking.minCandidateStk.toString()
  );

  //add two currencies and balance to testUser:
  [tokenId] = await Assets.setupUserWithCurrencies(
    testUser1,
    [minStk.muln(1000), minStk.muln(1000)],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser1, minStk.muln(1000)),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(MGA_ASSET_ID, minStk.muln(3), tokenId, minStk.muln(3))
    )
  );
});

test("A User with free tokens can join as collator", async () => {
  liqToken = await getLiquidityAssetId(MGA_ASSET_ID, tokenId);

  await Sudo.asSudoFinalized(
    Sudo.sudo(Staking.addStakingLiquidityToken(liqToken))
  );

  const result = await joinCandidate(
    testUser1.keyRingPair,
    liqToken,
    minStk.muln(2)
  );
  expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const isUserInCandidate = await Staking.isUserInCandidateList(
    testUser1.keyRingPair.address
  );
  expect(isUserInCandidate).toBeTruthy();
});
