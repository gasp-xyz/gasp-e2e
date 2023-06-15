/*
 *
 * @group rewards-bootstrap
 * @group sequential
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { getBalanceOfAsset, getLiquidityAssetId } from "../../utils/tx";
import { EventResult, ExtrinsicResult } from "../../utils/eventListeners";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import {
  getEventResultFromMangataTx,
  getBalanceOfPool,
} from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { toBN } from "@mangata-finance/sdk";
import {
  checkLastBootstrapFinalized,
  createNewBootstrapCurrency,
  setupBootstrapTokensBalance,
  scheduleBootstrap,
  provisionBootstrap,
  claimRewardsBootstrap,
  waitForBootstrapStatus,
} from "../../utils/Bootstrap";
import { setupUsers } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let keyring: Keyring;
let bootstrapCurrency: any;
let bootstrapPool: any;
let eventResponse: EventResult;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod = 10;
const bootstrapPeriod = 8;
const bootstrapAmount = toBN("1", 10);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  sudo = new User(keyring, sudoUserName);
  keyring.addPair(sudo.keyRingPair);

  await checkLastBootstrapFinalized(sudo);
  bootstrapCurrency = await createNewBootstrapCurrency(sudo);

  [testUser1] = setupUsers();

  await setupBootstrapTokensBalance(bootstrapCurrency, sudo, [testUser1]);
});

test("bootstrap - Check non-sudo user cannot start bootstrap", async () => {
  // check that non-sudo user can not start bootstrap
  await sudo.mint(bootstrapCurrency, testUser1, toBN("1", 20));
  const nonSudoBootstrap = await scheduleBootstrap(
    testUser1,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod
  );
  eventResponse = getEventResultFromMangataTx(nonSudoBootstrap);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toContain("RequireSudo");
});

test("bootstrap - Check happy path bootstrap with one user", async () => {
  // check that sudo user can start bootstrap
  await sudo.mint(bootstrapCurrency, testUser1, toBN("1", 20));
  const sudoBootstrap = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod
  );
  eventResponse = getEventResultFromMangataTx(sudoBootstrap);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // check that user can not make provision before bootstrap
  const provisionBeforeStart = await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionBeforeStart);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toContain("Unauthorized");

  await waitForBootstrapStatus("Public", waitingPeriod);

  // check that user can make provision while bootstrap running
  const provisionPublicBootstrapCurrency = await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicBootstrapCurrency);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // we need to add MGA token in the provision for creating a pool
  const provisionPublicMGA = await provisionBootstrap(
    testUser1,
    MGA_ASSET_ID,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicMGA);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForBootstrapStatus("Finished", bootstrapPeriod);

  // check that user can not make provision after bootstrap
  const provisionFinished = await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionFinished);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toContain("Unauthorized");

  // Check existing pool
  bootstrapPool = await getBalanceOfPool(MGA_ASSET_ID, bootstrapCurrency);
  const bootstrapPoolBalance = bootstrapPool[0];
  expect(bootstrapPoolBalance[0]).bnEqual(bootstrapAmount);
  expect(bootstrapPoolBalance[1]).bnEqual(bootstrapAmount);
  const bootstrapExpectedUserLiquidity =
    bootstrapPoolBalance[0].add(bootstrapPoolBalance[1]) / 2;

  // need claim liquidity token before finalizing
  const claimRewards = await claimRewardsBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimRewards);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const liquidityID = await getLiquidityAssetId(
    MGA_ASSET_ID,
    bootstrapCurrency
  );

  // check that the user's balance of liquidity token is equal the pool's balance
  const userBalance = await getBalanceOfAsset(liquidityID, testUser1);
  expect(userBalance.free.toNumber()).toEqual(bootstrapExpectedUserLiquidity);

  // finalize bootstrap
  await checkLastBootstrapFinalized(sudo);
});
