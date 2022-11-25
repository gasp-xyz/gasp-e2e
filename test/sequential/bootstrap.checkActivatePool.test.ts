/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group bootstrap
 * @group sequential
 */
import { getApi, initApi, getMangataInstance } from "../../utils/api";
import {
  scheduleBootstrap,
  provisionBootstrap,
  getLiquidityAssetId,
  claimAndActivateBootstrap,
} from "../../utils/tx";
import { EventResult, ExtrinsicResult } from "../../utils/eventListeners";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  waitForBootstrapStatus,
} from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import {
  checkLastBootstrapFinalized,
  createNewBootstrapCurrency,
  setupBootstrapTokensBalance,
} from "../../utils/Bootstrap";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let keyring: Keyring;
let bootstrapCurrency: any;
let bootstrapPool: any;
let eventResponse: EventResult;
let bootstrapPoolBalance: BN;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod = 15;
const bootstrapPeriod = 30;
const whitelistPeriod = 10;
const bootstrapAmount = new BN(10000000000);

async function checkPossibilityCreatingPool(tokenA: any, tokenB: any) {
  const creatingPool = await (
    await getMangataInstance()
  ).createPool(
    testUser1.keyRingPair,
    tokenA.toString(),
    bootstrapAmount,
    tokenB.toString(),
    bootstrapAmount
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
  const api = getApi();
  await setupApi();

  await checkLastBootstrapFinalized(sudo);
  await setupBootstrapTokensBalance(bootstrapCurrency, sudo, [testUser1]);

  const sudoBootstrap = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod,
    whitelistPeriod
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

  await checkPossibilityCreatingPool(MGA_ASSET_ID, bootstrapCurrency);

  // Check existing pool
  bootstrapPool = await api.query.xyk.pools([MGA_ASSET_ID, bootstrapCurrency]);
  expect(bootstrapPool[0]).bnEqual(bootstrapAmount);
  expect(bootstrapPool[1]).bnEqual(bootstrapAmount);
  bootstrapPoolBalance = new BN(bootstrapPool[0].add(bootstrapPool[1]) / 2);
});

afterEach(async () => {
  const api = getApi();

  // need claim liquidity token before finalizing
  const claimAndActivate = await claimAndActivateBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimAndActivate);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const liquidityID = await getLiquidityAssetId(
    MGA_ASSET_ID,
    bootstrapCurrency
  );

  const bootstrapUserLiquidity = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    liquidityID
  );
  // check that the user's balance of liquidity token is equal the pool's balance
  expect(bootstrapUserLiquidity.free).bnEqual(bootstrapPoolBalance);

  // finalaze bootstrap
  await checkLastBootstrapFinalized(sudo);
});
