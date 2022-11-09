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
  updatePromoteBootstrapPool,
  provisionBootstrap,
  claimRewardsBootstrap,
  getLiquidityAssetId,
  getBalanceOfAsset,
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
  sudoIssueAsset,
} from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN, MangataGenericEvent, toBN } from "@mangata-finance/sdk";
import { hexToU8a } from "@polkadot/util";
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
let bootstrapPool: any;
let eventResponse: EventResult;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod1 = 400;
const waitingPeriod2 = 10;
const bootstrapPeriod = 20;
const whitelistPeriod = 10;
const bootstrapAmount = new BN(10000000000);

async function changePromoteBootstrapPool(userName: User) {
  const api = getApi();
  let result: MangataGenericEvent[];

  const currentPromotingState =
    await api.query.bootstrap.promoteBootstrapPool();

  if (currentPromotingState) {
    result = await updatePromoteBootstrapPool(userName, false);
  } else {
    result = await updatePromoteBootstrapPool(userName, true);
  }

  return result;
}

async function checkBootstrapEvent(checkingEvent: MangataGenericEvent[]) {
  const filterBootstrapEvent = checkingEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid"
  );

  const userAssetCall = filterBootstrapEvent[0].event.data[0].toString();

  expect(userAssetCall).toContain("Ok");
}

async function checkBootstrapError(
  checkingEvent: MangataGenericEvent[],
  expectedError: string
) {
  const api = getApi();

  const filterBootstrapEvent = checkingEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid"
  );

  const userBootstrapErr = hexToU8a(
    //@ts-ignore
    filterBootstrapEvent[0].event.data[0].asErr.value.error.toString()
  );

  const userBootstrapIndex =
    //@ts-ignore
    filterBootstrapEvent[0].event.data[0].asErr.value.index.toString();

  const userAssetMetaError = api?.registry.findMetaError({
    error: userBootstrapErr,
    index: new BN(userBootstrapIndex),
  });

  expect(userAssetMetaError.method).toContain(expectedError);
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
    Assets.mintToken(bootstrapCurrency, testUser1),
    Assets.mintToken(bootstrapCurrency, sudo),
    Assets.mintNative(testUser1)
  );
});

test("bootstrap - Check that we can change promotion bootstrap on each stage before finish", async () => {
  let checkingUpdatingPool: MangataGenericEvent[];

  const api = getApi();

  const scheduleBootstrapBefPlan = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod1,
    bootstrapPeriod,
    whitelistPeriod
  );
  await checkBootstrapEvent(scheduleBootstrapBefPlan);

  checkingUpdatingPool = await changePromoteBootstrapPool(sudo);
  await checkBootstrapEvent(checkingUpdatingPool);

  const scheduleBootstrapAftPlan = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod2,
    bootstrapPeriod,
    whitelistPeriod
  );
  await checkBootstrapEvent(scheduleBootstrapAftPlan);

  checkingUpdatingPool = await changePromoteBootstrapPool(sudo);
  await checkBootstrapEvent(checkingUpdatingPool);

  await waitForBootstrapStatus("Whitelist", waitingPeriod2);

  checkingUpdatingPool = await changePromoteBootstrapPool(sudo);
  await checkBootstrapEvent(checkingUpdatingPool);

  await waitForBootstrapStatus("Public", waitingPeriod2);

  checkingUpdatingPool = await changePromoteBootstrapPool(sudo);
  await checkBootstrapEvent(checkingUpdatingPool);

  const provisionPublicBootstrapCurrency = await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicBootstrapCurrency);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const provisionPublicMGA = await provisionBootstrap(
    testUser1,
    MGA_ASSET_ID,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicMGA);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForBootstrapStatus("Finished", bootstrapPeriod);

  checkingUpdatingPool = await changePromoteBootstrapPool(sudo);
  await checkBootstrapError(checkingUpdatingPool, "BootstrapFinished");

  bootstrapPool = await api.query.xyk.pools([MGA_ASSET_ID, bootstrapCurrency]);
  expect(bootstrapPool[0]).bnEqual(bootstrapAmount);
  expect(bootstrapPool[1]).bnEqual(bootstrapAmount);
  const bootstrapExpectedUserLiquidity = new BN(
    bootstrapPool[0].add(bootstrapPool[1]) / 2
  );

  const claimRewards = await claimRewardsBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimRewards);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const liquidityID = await getLiquidityAssetId(
    MGA_ASSET_ID,
    bootstrapCurrency
  );

  const userBalance = await getBalanceOfAsset(
    liquidityID,
    testUser1.keyRingPair.address.toString()
  );

  const currentPromotingState =
    await api.query.bootstrap.promoteBootstrapPool();

  if (currentPromotingState) {
    expect(userBalance.free).bnEqual(bootstrapExpectedUserLiquidity);
    expect(userBalance.frozen).bnEqual(new BN(0));
  } else {
    expect(userBalance.free).bnEqual(new BN(0));
    expect(userBalance.frozen).bnEqual(bootstrapExpectedUserLiquidity);
  }

  const bootstrapFinalize = await finalizeBootstrap(sudo);
  await checkBootstrapEvent(bootstrapFinalize);
});

afterEach(async () => {
  const api = getApi();

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");
});
