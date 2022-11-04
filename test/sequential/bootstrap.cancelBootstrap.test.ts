/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group bootstrap
 * @group sequential
 */
import { getApi, initApi } from "../../utils/api";
import {
  scheduleBootstrap,
  finalizeBootstrap,
  cancelRunningBootstrap,
} from "../../utils/tx";
import { EventResult, ExtrinsicResult } from "../../utils/eventListeners";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  waitForBootstrapStatus,
} from "../../utils/utils";
import {
  getEventResultFromMangataTx,
  getSudoEventResultFromMangataTx,
  sudoIssueAsset,
} from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN, toBN } from "@mangata-finance/sdk";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { setupApi, setupUsers } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let keyring: Keyring;
let bootstrapPhase: any;
let bootstrapCurrency: any;
let eventResponse: EventResult;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod1 = 400;
const waitingPeriod2 = 15;
const bootstrapPeriod = 30;
const whitelistPeriod = 10;

async function checkErrorCancellingBootstrap(sudoUser: User, error: string) {
  const checkingCancelling = await cancelRunningBootstrap(sudoUser);
  eventResponse = getSudoEventResultFromMangataTx(checkingCancelling);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  //@ts-ignore
  expect(eventResponse.data.sudoResult.Err.Module.error).toContain(error);
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  sudo = new User(keyring, sudoUserName);
});

beforeEach(async () => {
  const api = getApi();
  await setupApi();

  testUser1 = new User(keyring);

  [testUser1] = setupUsers();

  const bootstrapCurrencyIssue = await sudoIssueAsset(
    sudo.keyRingPair,
    toBN("1", 20),
    sudo.keyRingPair.address
  );
  const bootstrapEventResult = await getEventResultFromMangataTx(
    bootstrapCurrencyIssue,
    ["tokens", "Issued", sudo.keyRingPair.address]
  );
  const bootstrapAssetId = bootstrapEventResult.data[0].split(",").join("");
  bootstrapCurrency = new BN(bootstrapAssetId);

  // check that system is ready to bootstrap
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Finished") {
    const bootstrapFinalize = await finalizeBootstrap(sudo);
    eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  }

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(bootstrapCurrency, testUser1), // transferAll test
    Assets.mintToken(bootstrapCurrency, sudo), // transferAll test
    Assets.mintNative(testUser1)
  );
});

test("bootstrap - Check that we can cancel bootstrap before planned", async () => {
  const sudoBootstrap = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod1,
    bootstrapPeriod,
    whitelistPeriod
  );
  eventResponse = getSudoEventResultFromMangataTx(sudoBootstrap);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  //@ts-ignore
  expect(eventResponse.data.sudoResult).toContain("Ok");

  const checkingCancelling = await cancelRunningBootstrap(sudo);
  eventResponse = getSudoEventResultFromMangataTx(checkingCancelling);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  //@ts-ignore
  expect(eventResponse.data.sudoResult).toContain("Ok");
});

test("bootstrap - Check that we can not cancel bootstrap when bootstrap event already planned or started", async () => {
  const sudoBootstrap = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod2,
    bootstrapPeriod,
    whitelistPeriod
  );
  eventResponse = getSudoEventResultFromMangataTx(sudoBootstrap);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  //@ts-ignore
  expect(eventResponse.data.sudoResult).toContain("Ok");

  //check that bootstrap cannot be canceled less than 300 blocks before the start
  await checkErrorCancellingBootstrap(sudo, "0x14000000");

  await waitForBootstrapStatus("Whitelist", waitingPeriod2);

  //check that bootstrap cannot be canceled after the start
  await checkErrorCancellingBootstrap(sudo, "0x07000000");

  await waitForBootstrapStatus("Public", waitingPeriod2);

  await checkErrorCancellingBootstrap(sudo, "0x07000000");

  await waitForBootstrapStatus("Finished", bootstrapPeriod);

  await checkErrorCancellingBootstrap(sudo, "0x07000000");

  // finalaze bootstrap
  const bootstrapFinalize = await finalizeBootstrap(sudo);
  eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
});

afterEach(async () => {
  const api = getApi();

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");
});
