/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group bootstrap
 * @group sequential
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { getLiquidityAssetId, createPool } from "../../utils/tx";
import { EventResult, ExtrinsicResult } from "../../utils/eventListeners";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  getUserBalanceOfToken,
} from "../../utils/utils";
import {
  getEventResultFromMangataTx,
  getBalanceOfPool,
} from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import {
  checkLastBootstrapFinalized,
  createNewBootstrapCurrency,
  setupBootstrapTokensBalance,
  scheduleBootstrap,
  provisionBootstrap,
  claimAndActivateBootstrap,
  waitForBootstrapStatus,
} from "../../utils/Bootstrap";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let keyring: Keyring;
let bootstrapCurrency: any;
let bootstrapPool: any;
let eventResponse: EventResult;
let bootstrapExpectedUserLiquidity: BN;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod = 6;
const bootstrapPeriod = 20;
const whitelistPeriod = 5;
const bootstrapAmount = new BN(10000000000);

async function checkPossibilityCreatingPool(tokenA: any, tokenB: any) {
  const creatingPool = await createPool(
    testUser1.keyRingPair,
    tokenA,
    bootstrapAmount,
    tokenB,
    bootstrapAmount,
  );
  eventResponse = getEventResultFromMangataTx(creatingPool);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toContain("DisallowedPool");
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);
  testUser1 = new User(keyring);

  [testUser1] = setupUsers();

  bootstrapCurrency = await createNewBootstrapCurrency(sudo);
});

test("bootstrap - Check that we can not create a pool for the bootstrap token after bootstrap was declared", async () => {
  await setupApi();

  await checkLastBootstrapFinalized(sudo);
  await setupBootstrapTokensBalance(bootstrapCurrency, sudo, [testUser1]);

  const sudoBootstrap = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod,
    whitelistPeriod,
  );
  eventResponse = getEventResultFromMangataTx(sudoBootstrap);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await checkPossibilityCreatingPool(MGA_ASSET_ID, bootstrapCurrency);

  await waitForBootstrapStatus("Whitelist", waitingPeriod);

  await checkPossibilityCreatingPool(MGA_ASSET_ID, bootstrapCurrency);

  await waitForBootstrapStatus("Public", waitingPeriod);

  await checkPossibilityCreatingPool(MGA_ASSET_ID, bootstrapCurrency);

  // new token must participate in provision as first
  const provisionPublicBootstrapCurrency = await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    bootstrapAmount,
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicBootstrapCurrency);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // we need to add MGA token in the provision for creating a pool
  const provisionPublicMGA = await provisionBootstrap(
    testUser1,
    MGA_ASSET_ID,
    bootstrapAmount,
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicMGA);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForBootstrapStatus("Finished", bootstrapPeriod);

  await checkPossibilityCreatingPool(MGA_ASSET_ID, bootstrapCurrency);

  // Check existing pool
  bootstrapPool = await getBalanceOfPool(MGA_ASSET_ID, bootstrapCurrency);
  const bootstrapPoolBalance = bootstrapPool[0];
  expect(bootstrapPoolBalance[0]).bnEqual(bootstrapAmount);
  expect(bootstrapPoolBalance[1]).bnEqual(bootstrapAmount);
  bootstrapExpectedUserLiquidity = new BN(
    bootstrapPoolBalance[0].add(bootstrapPoolBalance[1]) / 2,
  );
});

afterEach(async () => {
  // need claim liquidity token before finalizing
  const claimAndActivate = await claimAndActivateBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimAndActivate);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const liquidityID = await getLiquidityAssetId(
    MGA_ASSET_ID,
    bootstrapCurrency,
  );

  const bootstrapUserLiquidity = await getUserBalanceOfToken(
    liquidityID,
    testUser1,
  );
  // check that the user's balance of liquidity token is equal the pool's balance
  expect(bootstrapUserLiquidity.free).bnEqual(bootstrapExpectedUserLiquidity);

  // finalize bootstrap
  await checkLastBootstrapFinalized(sudo);
});
