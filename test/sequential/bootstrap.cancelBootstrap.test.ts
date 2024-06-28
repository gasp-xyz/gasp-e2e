/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group bootstrap
 * @group sequential
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import {
  checkLastBootstrapFinalized,
  createNewBootstrapCurrency,
  setupBootstrapTokensBalance,
  scheduleBootstrap,
  cancelRunningBootstrap,
  waitForBootstrapStatus,
} from "../../utils/Bootstrap";
import {
  waitSudoOperationSuccess,
  waitSudoOperationFail,
} from "../../utils/eventListeners";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { MangataGenericEvent } from "gasp-sdk";
import { getSudoUser, setupUsers } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let bootstrapCurrency: any;
let cancelBootstrapEvent: MangataGenericEvent[];

//constant for bootstrap include a planning period
const waitingPeriodWithPlan = 400;
//constant for bootstrap less a planning period
const waitingPeriodLessPlan = 8;
const bootstrapPeriod = 6;
const whitelistPeriod = 3;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  sudo = getSudoUser();
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  await checkLastBootstrapFinalized(sudo);
  bootstrapCurrency = await createNewBootstrapCurrency(sudo);

  await setupBootstrapTokensBalance(bootstrapCurrency, sudo, [testUser1]);
});

test("bootstrap - Check that we can cancel bootstrap before planned", async () => {
  const scheduleBootstrapEvent = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriodWithPlan,
    bootstrapPeriod,
    whitelistPeriod,
  );
  await waitSudoOperationSuccess(scheduleBootstrapEvent);

  cancelBootstrapEvent = await cancelRunningBootstrap(sudo);
  await waitSudoOperationSuccess(cancelBootstrapEvent);
});

test("bootstrap - Check that we can not cancel bootstrap when bootstrap event already planned or started", async () => {
  const scheduleBootstrapEvent = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriodLessPlan,
    bootstrapPeriod,
    whitelistPeriod,
  );
  await waitSudoOperationSuccess(scheduleBootstrapEvent);

  //check that bootstrap cannot be canceled less than 300 blocks before the start
  cancelBootstrapEvent = await cancelRunningBootstrap(sudo);
  await waitSudoOperationFail(cancelBootstrapEvent, [
    "TooLateToUpdateBootstrap",
  ]);

  await waitForBootstrapStatus("Whitelist", waitingPeriodLessPlan);

  //check that bootstrap cannot be canceled after the start
  cancelBootstrapEvent = await cancelRunningBootstrap(sudo);
  await waitSudoOperationFail(cancelBootstrapEvent, ["AlreadyStarted"]);

  await waitForBootstrapStatus("Public", waitingPeriodLessPlan);

  cancelBootstrapEvent = await cancelRunningBootstrap(sudo);
  await waitSudoOperationFail(cancelBootstrapEvent, ["AlreadyStarted"]);

  await waitForBootstrapStatus("Finished", bootstrapPeriod);

  cancelBootstrapEvent = await cancelRunningBootstrap(sudo);
  await waitSudoOperationFail(cancelBootstrapEvent, ["AlreadyStarted"]);

  // finalize bootstrap
  await checkLastBootstrapFinalized(sudo);
});
