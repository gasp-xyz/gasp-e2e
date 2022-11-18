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
  getEventErrorfromSudo,
} from "../../utils/txHandler";
import {
  createNewBootstrapCurrency,
  setupBootstrapTokensBalance,
} from "../../utils/Bootstrap";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN, MangataGenericEvent } from "@mangata-finance/sdk";
import { setupUsers } from "../../utils/setup";

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
//constant for bootstrap include a planning period
const waitingPeriodWithPlan = 400;
//constant for bootstrap less a planning period
const waitingPeriodLessPlan = 10;
const bootstrapPeriod = 20;
const whitelistPeriod = 10;
const bootstrapAmount = new BN(10000000000);

async function changePromoteBootstrapPool(userName: User) {
  const api = getApi();

  const currentPromotingState =
    await api.query.bootstrap.promoteBootstrapPool();

  const result = await updatePromoteBootstrapPool(
    userName,
    !currentPromotingState
  );

  return result;
}

async function checkSudoOperataionSuccess(
  checkingEvent: MangataGenericEvent[]
) {
  const filterBootstrapEvent = checkingEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid"
  );

  const userBootstrapCall = filterBootstrapEvent[0].event.data[0].toString();

  expect(userBootstrapCall).toContain("Ok");
}

async function checkSudoOperataionFail(
  checkingEvent: MangataGenericEvent[],
  expectedError: string
) {
  const filterBootstrapEvent = checkingEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid"
  );

  const BootstrapError = await getEventErrorfromSudo(filterBootstrapEvent);

  expect(BootstrapError.method).toContain(expectedError);
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
  testUser1 = new User(keyring);

  [testUser1] = setupUsers();

  bootstrapCurrency = await createNewBootstrapCurrency(sudo);

  await setupBootstrapTokensBalance(bootstrapCurrency, sudo, testUser1);
});

test("bootstrap - Check that we can change promotion bootstrap on each stage before finish", async () => {
  let checkingUpdatingPool: MangataGenericEvent[];

  const api = getApi();

  const scheduleBootstrapBefPlan = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriodWithPlan,
    bootstrapPeriod,
    whitelistPeriod
  );
  await checkSudoOperataionSuccess(scheduleBootstrapBefPlan);

  checkingUpdatingPool = await changePromoteBootstrapPool(sudo);
  await checkSudoOperataionSuccess(checkingUpdatingPool);

  const scheduleBootstrapAftPlan = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriodLessPlan,
    bootstrapPeriod,
    whitelistPeriod
  );
  await checkSudoOperataionSuccess(scheduleBootstrapAftPlan);

  checkingUpdatingPool = await changePromoteBootstrapPool(sudo);
  await checkSudoOperataionSuccess(checkingUpdatingPool);

  await waitForBootstrapStatus("Whitelist", waitingPeriodLessPlan);

  checkingUpdatingPool = await changePromoteBootstrapPool(sudo);
  await checkSudoOperataionSuccess(checkingUpdatingPool);

  await waitForBootstrapStatus("Public", waitingPeriodLessPlan);

  checkingUpdatingPool = await changePromoteBootstrapPool(sudo);
  await checkSudoOperataionSuccess(checkingUpdatingPool);

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
  await checkSudoOperataionFail(checkingUpdatingPool, "BootstrapFinished");

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
  await checkSudoOperataionSuccess(bootstrapFinalize);
});

afterEach(async () => {
  const api = getApi();

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");
});
