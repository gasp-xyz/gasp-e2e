/*
 *
 * @group xyk
 * @group asset
 * @group parallel
 */
import { initApi } from "../../utils/api";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { BN } from "bn.js";
import { Assets } from "../../utils/Assets";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());

let sudo: User;
let testUser1: User;

beforeAll(async () => {
  await initApi();
});

beforeEach(async () => {
  const keyring = new Keyring({ type: "sr25519" });
  sudo = new User(keyring, sudoUserName);
  testUser1 = new User(keyring);
  keyring.addPair(testUser1.keyRingPair);
  await testUser1.addMGATokens(sudo);
});

test("register new asset from sudo user", async () => {
  const tokenId = (
    await Assets.setupUserWithCurrencies(sudo, [new BN(250000)], sudo, true)
  )[0];

  const userRegisterAsset = await sudo.registerAsset(tokenId);

  expect(getEventResultFromMangataTx(userRegisterAsset).state).toEqual(
    ExtrinsicResult.ExtrinsicSuccess
  );
});

test("try to register a new asset from non-sudo user, expect to fail", async () => {
  const tokenId = (
    await Assets.setupUserWithCurrencies(
      testUser1,
      [new BN(250000)],
      sudo,
      true
    )
  )[0];

  const userRegisterAsset = await testUser1.registerAsset(tokenId);

  expect(getEventResultFromMangataTx(userRegisterAsset).state).toEqual(
    ExtrinsicResult.ExtrinsicFailed
  );

  expect(getEventResultFromMangataTx(userRegisterAsset).data).toContain(
    "RequireSudo"
  );
});
