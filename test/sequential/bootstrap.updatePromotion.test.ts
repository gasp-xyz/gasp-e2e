/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group rewards-bootstrap
 * @group sequential
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { getBalanceOfAsset, getLiquidityAssetId } from "../../utils/tx";
import {
  EventResult,
  ExtrinsicResult,
  expectMGAExtrinsicSuDidSuccess,
  waitSudoOperationFail,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { User } from "../../utils/User";
import {
  getBalanceOfPool,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import {
  checkLastBootstrapFinalized,
  claimRewardsBootstrap,
  createNewBootstrapCurrency,
  finalizeBootstrap,
  getPromotionBootstrapPoolState,
  provisionBootstrap,
  scheduleBootstrap,
  setupBootstrapTokensBalance,
  updatePromoteBootstrapPool,
  waitForBootstrapStatus,
} from "../../utils/Bootstrap";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { MangataGenericEvent } from "gasp-sdk";
import { getSudoUser, setupUsers } from "../../utils/setup";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let bootstrapCurrency: any;
let bootstrapPool: any;
let eventResponse: EventResult;

//constant for bootstrap include a planning period
const waitingPeriodWithPlan = 400;
//constant for bootstrap less a planning period
const waitingPeriodLessPlan = 8;
const bootstrapPeriod = 10;
const whitelistPeriod = 4;
const bootstrapAmount = new BN(10000000000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  sudo = getSudoUser();

  [testUser1] = setupUsers();

  await checkLastBootstrapFinalized(sudo);
  bootstrapCurrency = await createNewBootstrapCurrency(sudo);

  await setupBootstrapTokensBalance(bootstrapCurrency, sudo, [testUser1]);
});

test("bootstrap - Check possibility to change promoteBootstrapPool in each phase", async () => {
  let events: MangataGenericEvent[];

  const scheduleBootstrapBefPlan = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriodWithPlan,
    bootstrapPeriod,
    whitelistPeriod,
  );
  await waitSudoOperationSuccess(scheduleBootstrapBefPlan);

  const startingPromotionState = await getPromotionBootstrapPoolState();

  events = await updatePromoteBootstrapPool(sudo, !startingPromotionState);
  await waitSudoOperationSuccess(events);

  const scheduleBootstrapAftPlan = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriodLessPlan,
    bootstrapPeriod,
    whitelistPeriod,
  );
  await waitSudoOperationSuccess(scheduleBootstrapAftPlan);

  events = await updatePromoteBootstrapPool(sudo, !startingPromotionState);
  await waitSudoOperationSuccess(events);

  await waitForBootstrapStatus("Whitelist", waitingPeriodLessPlan);

  events = await updatePromoteBootstrapPool(sudo, startingPromotionState);
  await waitSudoOperationSuccess(events);

  await waitForBootstrapStatus("Public", waitingPeriodLessPlan);

  events = await updatePromoteBootstrapPool(sudo, !startingPromotionState);
  await waitSudoOperationSuccess(events);

  const provisionPublicBootstrapCurrency = await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    bootstrapAmount,
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicBootstrapCurrency);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const provisionPublicMGA = await provisionBootstrap(
    testUser1,
    MGA_ASSET_ID,
    bootstrapAmount,
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicMGA);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForBootstrapStatus("Finished", bootstrapPeriod);

  events = await updatePromoteBootstrapPool(sudo, startingPromotionState);
  await waitSudoOperationFail(events, ["BootstrapFinished"]);

  bootstrapPool = await getBalanceOfPool(MGA_ASSET_ID, bootstrapCurrency);
  const bootstrapPoolBalance = bootstrapPool[0];
  expect(bootstrapPoolBalance[0]).bnEqual(bootstrapAmount);
  expect(bootstrapPoolBalance[1]).bnEqual(bootstrapAmount);
  const bootstrapExpectedUserLiquidity = new BN(
    bootstrapPoolBalance[0].add(bootstrapPoolBalance[1]) / 2,
  );

  const claimRewards = await claimRewardsBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimRewards);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const liquidityID = await getLiquidityAssetId(
    MGA_ASSET_ID,
    bootstrapCurrency,
  );

  const userBalance = await getBalanceOfAsset(liquidityID, testUser1);

  expect(userBalance.free).bnEqual(bootstrapExpectedUserLiquidity);
  expect(userBalance.frozen).bnEqual(new BN(0));

  const bootstrapFinalize = await finalizeBootstrap(sudo);
  await expectMGAExtrinsicSuDidSuccess(bootstrapFinalize);
});
