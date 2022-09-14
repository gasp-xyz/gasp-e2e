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
  finalizeBootstrap,
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
import {
  getEventResultFromMangataTx,
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
});

test("bootstrap - Check that we can not create a pool for the bootstrap token after bootstrap was declared", async () => {
  const api = getApi();
  await setupApi();

  // check that system is ready to bootstrap
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Finished") {
    const bootstrapFinalize = await finalizeBootstrap(sudo);
    eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  }

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(bootstrapCurrency, testUser1), // transferAll test
    Assets.mintToken(bootstrapCurrency, sudo), // transferAll test
    Assets.mintNative(testUser1)
  );

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
  const bootstrapFinalize = await finalizeBootstrap(sudo);
  eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");
});
