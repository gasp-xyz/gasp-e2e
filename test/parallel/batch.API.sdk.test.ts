/*
 *
 * @group sdk
 * @group parallel
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import {
  findErrorMetadata,
  getEnvironmentRequiredVars,
} from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
const defaultCurrencyValue = new BN(250000);
const mangata = getMangataInstance();

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);

  [testUser] = setupUsers();

  await setupApi();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser)
  );
});

test("check that only sudo account can use batch calls", async () => {
  const extrinsic = await (
    await mangata
  ).batch({
    account: testUser.keyRingPair,
    calls: [Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT.divn(2))],
  });

  const interruption = getEventResultFromMangataTx(extrinsic, [
    "BatchInterrupted",
  ]);

  const err = await findErrorMetadata(
    JSON.parse(JSON.stringify(interruption.data)).error.Module.error,
    JSON.parse(JSON.stringify(interruption.data)).error.Module.index
  );
  expect(err.name).toEqual("RequireSudo");
});

test("Happy path - sudo account batch call", async () => {
  const extrinsic = await (
    await mangata
  ).batch({
    account: sudo.keyRingPair,
    calls: [Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT.divn(2))],
  });

  const eventResponse = getEventResultFromMangataTx(extrinsic, [
    "BatchCompleted",
  ]);

  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
});
