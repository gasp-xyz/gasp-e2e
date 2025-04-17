/*
 *
 * @group maintenance
 */
import { jest } from "@jest/globals";
import { hexToU8a } from "@polkadot/util";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { BN_HUNDRED_BILLIONS, BN_ZERO, MangataGenericEvent } from "gasp-sdk";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers, sudo } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { Maintenance } from "../../utils/Maintenance";
import { getLiquidityAssetId, sellAsset } from "../../utils/tx";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { testLog } from "../../utils/Logger";
import { checkMaintenanceStatus } from "../../utils/validators";
import { Market } from "../../utils/market";
import { FoundationMembers } from "../../utils/FoundationMembers";
import {
  checkLastBootstrapFinalized,
  claimRewardsBootstrap,
  createNewBootstrapCurrency,
  provisionBootstrap,
  scheduleBootstrap,
  setupBootstrapTokensBalance,
  waitForBootstrapStatus,
} from "../../utils/Bootstrap";
import { xykErrors } from "../../utils/utils";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser1: User;
//let keyring: Keyring;
let firstCurrency: BN;
let liqId: BN;
let foundationAccountAddress: string;
const defaultCurrencyValue = new BN(1000000000000000);
const defaultPoolVolumeValue = new BN(10000000000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  [testUser1] = setupUsers();

  await setupApi();

  const foundationMembers = await FoundationMembers.getFoundationMembers();
  foundationAccountAddress = foundationMembers[0];

  firstCurrency = await Assets.issueAssetToUser(
    sudo,
    defaultCurrencyValue,
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(firstCurrency, sudo, defaultCurrencyValue),
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Market.createPool(
        GASP_ASSET_ID,
        defaultPoolVolumeValue,
        firstCurrency,
        defaultPoolVolumeValue,
      ),
    ),
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOff(),
    ),
  );

  liqId = await getLiquidityAssetId(GASP_ASSET_ID, firstCurrency);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Sudo.sudoAs(
      testUser1,
      Market.mintLiquidity(liqId, GASP_ASSET_ID, defaultPoolVolumeValue),
    ),
  );
});

test("maintenance- try to change Maintenance Mode with a non-foundation account THEN it failed", async () => {
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOn(),
    ),
  );

  const userSwitchModeEvents = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser1.keyRingPair.address,
      Maintenance.switchMaintenanceModeOff(),
    ),
  );

  await getSudoError(userSwitchModeEvents, "NotFoundationAccount");

  const sudoSwitchModeEvents = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      sudo.keyRingPair.address,
      Maintenance.switchMaintenanceModeOff(),
    ),
  );

  await getSudoError(sudoSwitchModeEvents, "NotFoundationAccount");

  const foundationSwitchModeEvents = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOff(),
    ),
  );

  const filteredEvent = foundationSwitchModeEvents.filter(
    (extrinsicResult) => extrinsicResult.method === "SudoAsDone",
  );
  const eventIndex = JSON.parse(JSON.stringify(filteredEvent[0].event.data[0]));
  expect(eventIndex.ok).toBeDefined();
});

test("check UpgradabilityOn can only be set after MaintenanceModeOn is set and MaintenanceMode works without UpgradabilityOn", async () => {
  await checkMaintenanceStatus(false, false);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchUpgradabilityInMaintenanceModeOn(),
    ),
  );

  await checkMaintenanceStatus(false, false);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOn(),
    ),
  );

  await checkMaintenanceStatus(true, false);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchUpgradabilityInMaintenanceModeOn(),
    ),
  );

  await checkMaintenanceStatus(true, true);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOff(),
    ),
  );

  await checkMaintenanceStatus(false, false);
});

test("maintenance- check we can sell GASP tokens THEN switch maintenanceMode to on, repeat the operation and receive error", async () => {
  testUser1.addAsset(GASP_ASSET_ID);
  testUser1.addAsset(firstCurrency);
  testUser1.addAsset(liqId);

  await waitForRewards(testUser1, liqId);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await sellAsset(
    testUser1.keyRingPair,
    firstCurrency,
    GASP_ASSET_ID,
    new BN(10000),
    new BN(1),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOn(),
    ),
  );

  await sellAsset(
    testUser1.keyRingPair,
    firstCurrency,
    GASP_ASSET_ID,
    new BN(10000),
    new BN(1),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("TradingBlockedByMaintenanceMode");
  });

  await waitForRewards(testUser1, liqId);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOff(),
    ),
  );

  await sellAsset(
    testUser1.keyRingPair,
    firstCurrency,
    GASP_ASSET_ID,
    new BN(10000),
    new BN(1),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const currencyAssetDifference = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore.free!.sub(
      testUser1.getAsset(firstCurrency)?.amountAfter.free!,
    );
  // it failed before, that means a 0.3% fee was applied on the failed swap at L195,
  // changed from 20000 to 20030
  expect(currencyAssetDifference).bnEqual(new BN(20030));
});
async function getSudoError(
  mangataEvent: MangataGenericEvent[],
  expectedError: string,
) {
  const api = getApi();

  const filteredEvent = mangataEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "SudoAsDone",
  );

  if (filteredEvent[1] !== undefined) {
    testLog.getLog().warn("WARN: Received more than one errors");
    //throw new Error("  --- TX Mapping issue --- ");
  }

  const eventErrorValue = hexToU8a(
    JSON.parse(JSON.stringify(filteredEvent[0].event.data[0])).err.module.error,
  );
  const eventErrorIndex = JSON.parse(
    JSON.stringify(filteredEvent[0].event.data[0]),
  ).err.module.index;

  const sudoEventError = api?.registry.findMetaError({
    error: eventErrorValue,
    index: new BN(eventErrorIndex),
  });

  expect(sudoEventError.name).toEqual(expectedError);
}

test("maintenance- bootstrap can be run in maintenanceMode, but you can't provide it and the pool will not be created", async () => {
  await checkMaintenanceStatus(false, false);
  await checkLastBootstrapFinalized(sudo);
  const bootstrapCurrency = await createNewBootstrapCurrency(sudo);
  const waitingPeriod = 10;
  const bootstrapPeriod = 8;

  [testUser1] = setupUsers();

  await setupBootstrapTokensBalance(bootstrapCurrency, sudo, [testUser1]);

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(bootstrapCurrency, testUser1),
    Assets.mintNative(testUser1),
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOn(),
    ),
  );

  await checkMaintenanceStatus(true, false);

  await scheduleBootstrap(
    sudo,
    GASP_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await waitForBootstrapStatus("Public", waitingPeriod);

  // check that user can make provision while bootstrap running
  await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    BN_HUNDRED_BILLIONS,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("ProvisioningBlockedByMaintenanceMode");
  });

  await provisionBootstrap(testUser1, GASP_ASSET_ID, BN_HUNDRED_BILLIONS).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(
        "ProvisioningBlockedByMaintenanceMode",
      );
    },
  );

  await waitForBootstrapStatus("Finished", bootstrapPeriod);
  await claimRewardsBootstrap(testUser1).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(xykErrors.MathOverflow);
  });

  const foundationSwitchModeEvents = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOff(),
    ),
  );

  const filteredEvent = foundationSwitchModeEvents.filter(
    (extrinsicResult) => extrinsicResult.method === "SudoAsDone",
  );
  const eventIndex = JSON.parse(JSON.stringify(filteredEvent[0].event.data[0]));
  expect(eventIndex.ok).toBeDefined();

  const poolId = await getLiquidityAssetId(GASP_ASSET_ID, bootstrapCurrency);
  expect(poolId).bnEqual(new BN(-1));
  await checkMaintenanceStatus(false, false);
  await checkLastBootstrapFinalized(sudo);
});

test("[BUG] maintenance - GIVEN bootstrap start AND provision with one user WHEN maintenanceMode runs in Public phase THEN bootstrap pool doesn't appear", async () => {
  await checkMaintenanceStatus(false, false);
  await checkLastBootstrapFinalized(sudo);
  const bootstrapCurrency = await createNewBootstrapCurrency(sudo);
  const waitingPeriod = 10;
  const bootstrapPeriod = 8;

  [testUser1] = setupUsers();

  await setupBootstrapTokensBalance(bootstrapCurrency, sudo, [testUser1]);

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(bootstrapCurrency, testUser1),
    Assets.mintNative(testUser1),
  );

  await scheduleBootstrap(
    sudo,
    GASP_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await waitForBootstrapStatus("Public", waitingPeriod);

  await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    BN_HUNDRED_BILLIONS,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await provisionBootstrap(testUser1, GASP_ASSET_ID, BN_HUNDRED_BILLIONS).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOn(),
    ),
  );

  await checkMaintenanceStatus(true, false);

  await waitForBootstrapStatus("Finished", bootstrapPeriod);

  //BUG - we need to have a possibility to claim rewards, but we received an error here
  await claimRewardsBootstrap(testUser1).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const poolId = await getLiquidityAssetId(GASP_ASSET_ID, bootstrapCurrency);
  expect(poolId).bnGt(BN_ZERO);
  await checkLastBootstrapFinalized(sudo);

  const foundationSwitchModeEvents = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOff(),
    ),
  );
  const filteredEvent = foundationSwitchModeEvents.filter(
    (extrinsicResult) => extrinsicResult.method === "SudoAsDone",
  );
  const eventIndex = JSON.parse(JSON.stringify(filteredEvent[0].event.data[0]));
  expect(eventIndex.ok).toBeDefined();
  await checkMaintenanceStatus(false, false);
});
