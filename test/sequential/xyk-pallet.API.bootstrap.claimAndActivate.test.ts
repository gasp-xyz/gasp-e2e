/*
 *
 * @group bootstrap
 * @group sequential
 */
import { getApi, initApi } from "../../utils/api";
import {
  scheduleBootstrap,
  provisionBootstrap,
  provisionVestedBootstrap,
  finalizeBootstrap,
  getLiquidityAssetId,
  claimAndActivateBootstrap,
  promotePool,
  vestingTransfer,
} from "../../utils/tx";
import { EventResult, ExtrinsicResult } from "../../utils/eventListeners";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  waitForNBlocks,
  getBlockNumber,
} from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN, toBN } from "@mangata-finance/sdk";
import { Assets } from "../../utils/Assets";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let sudo: User;
let keyring: Keyring;
let bootstrapPhase: any;
let bootstrapCurrency: any;
let bootstrapPool: any;
let bootstrapUserLiquidity: any;
let eventResponse: EventResult;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod = 20;
const bootstrapPeriod = 40;
const bootstrapAmount = new BN(10000000000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  sudo = new User(keyring, sudoUserName);
  keyring.addPair(sudo.keyRingPair);

  await sudo.addMGATokens(sudo);
});

beforeEach(async () => {
  const api = getApi();
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Finished") {
    const bootstrapFinalize = await finalizeBootstrap(sudo);
    eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

    await waitForNBlocks(4);
  }

  expect(bootstrapPhase.toString()).toEqual("BeforeStart");

  bootstrapCurrency = await Assets.issueAssetToUser(sudo, toBN("1", 20), sudo);

  testUser1 = new User(keyring);
  keyring.addPair(testUser1.keyRingPair);

  testUser2 = new User(keyring);
  keyring.addPair(testUser2.keyRingPair);
});

test("bootstrap - GIVEN a user who provisioned  AND  bootstrap is finished WHEN pool was  promoted THEN claim and activate successfully works AND rewards are activated", async () => {
  const api = getApi();

  await testUser1.addMGATokens(sudo);
  await sudo.mint(bootstrapCurrency, testUser1, toBN("1", 20));
  await testUser2.addMGATokens(sudo);
  await sudo.mint(bootstrapCurrency, testUser2, toBN("1", 20));

  const sudoBootstrap = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod
  );
  eventResponse = getEventResultFromMangataTx(sudoBootstrap);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForNBlocks(waitingPeriod);

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("Public");

  // provision from User1
  const provisionBTUser1 = await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionBTUser1);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const provisionMGAUser1 = await provisionBootstrap(
    testUser1,
    MGA_ASSET_ID,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionMGAUser1);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // provision from User2
  const provisionBTUser2 = await provisionBootstrap(
    testUser2,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionBTUser2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const provisionMGAUser2 = await provisionBootstrap(
    testUser2,
    MGA_ASSET_ID,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionMGAUser2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForNBlocks(bootstrapPeriod);

  const bootstrapAmountPool = bootstrapAmount.muln(2);
  bootstrapPool = await api.query.xyk.pools([MGA_ASSET_ID, bootstrapCurrency]);
  expect(bootstrapPool[0]).bnEqual(bootstrapAmountPool);
  expect(bootstrapPool[1]).bnEqual(bootstrapAmountPool);
  const bootstrapExpectedUserLiquidity = new BN(
    bootstrapPool[0].add(bootstrapPool[1]) / 4
  );

  const liquidityID = await getLiquidityAssetId(
    MGA_ASSET_ID,
    bootstrapCurrency
  );

  const promotingPool = await promotePool(sudo.keyRingPair, liquidityID);
  expect(promotingPool.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const claimAndActivate1 = await claimAndActivateBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimAndActivate1);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const claimAndActivate2 = await claimAndActivateBootstrap(testUser2);
  eventResponse = getEventResultFromMangataTx(claimAndActivate2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // finalaze bootstrap
  const bootstrapFinalize = await finalizeBootstrap(sudo);
  eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  bootstrapUserLiquidity = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    liquidityID
  );
  expect(bootstrapUserLiquidity.reserved).bnEqual(
    bootstrapExpectedUserLiquidity
  );

  bootstrapUserLiquidity = await api.query.tokens.accounts(
    testUser2.keyRingPair.address,
    liquidityID
  );
  expect(bootstrapUserLiquidity.reserved).bnEqual(
    bootstrapExpectedUserLiquidity
  );

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");
});

test("bootstrap - GIVEN a bootstrap finished WHEN pool was not promoted THEN claim and activate fails AND Only claim is done", async () => {
  const api = getApi();

  await testUser1.addMGATokens(sudo);
  await sudo.mint(bootstrapCurrency, testUser1, toBN("1", 20));
  await testUser2.addMGATokens(sudo);
  await sudo.mint(bootstrapCurrency, testUser2, toBN("1", 20));

  const sudoBootstrap = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod
  );
  eventResponse = getEventResultFromMangataTx(sudoBootstrap);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForNBlocks(waitingPeriod);

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("Public");

  // provision from User1
  const provisionBTUser1 = await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionBTUser1);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const provisionMGAUser1 = await provisionBootstrap(
    testUser1,
    MGA_ASSET_ID,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionMGAUser1);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // provision from User2
  const provisionBTUser2 = await provisionBootstrap(
    testUser2,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionBTUser2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const provisionMGAUser2 = await provisionBootstrap(
    testUser2,
    MGA_ASSET_ID,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionMGAUser2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForNBlocks(bootstrapPeriod);

  const bootstrapAmountPool = bootstrapAmount.muln(2);
  bootstrapPool = await api.query.xyk.pools([MGA_ASSET_ID, bootstrapCurrency]);
  expect(bootstrapPool[0]).bnEqual(bootstrapAmountPool);
  expect(bootstrapPool[1]).bnEqual(bootstrapAmountPool);
  const bootstrapExpectedUserLiquidity = new BN(
    bootstrapPool[0].add(bootstrapPool[1]) / 4
  );

  const liquidityID = await getLiquidityAssetId(
    MGA_ASSET_ID,
    bootstrapCurrency
  );

  const claimAndActivate1 = await claimAndActivateBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimAndActivate1);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const claimAndActivate2 = await claimAndActivateBootstrap(testUser2);
  eventResponse = getEventResultFromMangataTx(claimAndActivate2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // finalaze bootstrap
  const bootstrapFinalize = await finalizeBootstrap(sudo);
  eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  bootstrapUserLiquidity = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    liquidityID
  );
  expect(bootstrapUserLiquidity.free).bnEqual(bootstrapExpectedUserLiquidity);
  expect(bootstrapUserLiquidity.reserved).bnEqual(new BN(0));

  bootstrapUserLiquidity = await api.query.tokens.accounts(
    testUser2.keyRingPair.address,
    liquidityID
  );
  expect(bootstrapUserLiquidity.free).bnEqual(bootstrapExpectedUserLiquidity);
  expect(bootstrapUserLiquidity.reserved).bnEqual(new BN(0));

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");
});

test("bootstrap - GIVEN a user who vested-provision AND  bootstrap is finished WHEN pool was  promoted THEN claim and activate fails AND Only claim is done", async () => {
  const api = getApi();
  const bootstrapBlockNumber = await getBlockNumber();

  await sudo.addMGATokens(sudo);
  const vestingUser = await vestingTransfer(
    sudo,
    MGA_ASSET_ID,
    sudo,
    testUser1,
    bootstrapBlockNumber
  );
  eventResponse = getEventResultFromMangataTx(vestingUser);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  await sudo.mint(bootstrapCurrency, testUser1, toBN("1", 20));
  await testUser2.addMGATokens(sudo);
  await sudo.mint(bootstrapCurrency, testUser2, toBN("1", 20));

  const sudoBootstrap = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod
  );
  eventResponse = getEventResultFromMangataTx(sudoBootstrap);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForNBlocks(waitingPeriod);

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("Public");

  // provision from User1
  const provisionBTUser1 = await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionBTUser1);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const provisionMGAUser1 = await provisionVestedBootstrap(
    testUser1,
    MGA_ASSET_ID,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionMGAUser1);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // provision from User2
  const provisionBTUser2 = await provisionBootstrap(
    testUser2,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionBTUser2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const provisionMGAUser2 = await provisionBootstrap(
    testUser2,
    MGA_ASSET_ID,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionMGAUser2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForNBlocks(bootstrapPeriod);

  const bootstrapAmountPool = bootstrapAmount.muln(2);
  bootstrapPool = await api.query.xyk.pools([MGA_ASSET_ID, bootstrapCurrency]);
  expect(bootstrapPool[0]).bnEqual(bootstrapAmountPool);
  expect(bootstrapPool[1]).bnEqual(bootstrapAmountPool);
  const bootstrapExpectedUserLiquidity = new BN(
    bootstrapPool[0].add(bootstrapPool[1]) / 4
  );

  const liquidityID = await getLiquidityAssetId(
    MGA_ASSET_ID,
    bootstrapCurrency
  );

  const claimAndActivate1 = await claimAndActivateBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimAndActivate1);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const claimAndActivate2 = await claimAndActivateBootstrap(testUser2);
  eventResponse = getEventResultFromMangataTx(claimAndActivate2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // finalaze bootstrap
  const bootstrapFinalize = await finalizeBootstrap(sudo);
  eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  bootstrapUserLiquidity = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    liquidityID
  );
  expect(bootstrapUserLiquidity.free).bnEqual(bootstrapExpectedUserLiquidity);
  expect(bootstrapUserLiquidity.reserved).bnEqual(new BN(0));
  expect(bootstrapUserLiquidity.frozen).bnGt(new BN(0));

  bootstrapUserLiquidity = await api.query.tokens.accounts(
    testUser2.keyRingPair.address,
    liquidityID
  );
  expect(bootstrapUserLiquidity.free).bnEqual(bootstrapExpectedUserLiquidity);
  expect(bootstrapUserLiquidity.reserved).bnEqual(new BN(0));
  expect(bootstrapUserLiquidity.frozen).bnEqual(new BN(0));

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");
});
