/*
 *
 * @group maintenance
 */
import { jest } from "@jest/globals";
import { hexToU8a } from "@polkadot/util";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { FOUNDATION_ADDRESS_1, GASP_ASSET_ID } from "../../utils/Constants";
import { MangataGenericEvent } from "gasp-sdk";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers, sudo } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { Maintenance } from "../../utils/Maintenance";
import {
  compoundRewards,
  getLiquidityAssetId,
  sellAsset,
} from "../../utils/tx";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import {
  EventResult,
  ExtrinsicResult,
  waitForRewards,
} from "../../utils/eventListeners";
import { testLog } from "../../utils/Logger";
import { checkMaintenanceStatus } from "../../utils/validators";
import { Market } from "../../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser1: User;
//let keyring: Keyring;
let firstCurrency: BN;
let eventResponse: EventResult;
let liqId: BN;
const defaultCurrencyValue = new BN(1000000000000000);
const defaultPoolVolumeValue = new BN(10000000000);
const foundationAccountAddress = FOUNDATION_ADDRESS_1;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  [testUser1] = setupUsers();

  await setupApi();

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

test.skip("maintenance- check we can sell MGX tokens and compoundRewards THEN switch maintenanceMode to on, repeat the operation and receive error", async () => {
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

  await compoundRewards(testUser1, liqId).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOn(),
    ),
  );

  await expect(
    sellAsset(
      testUser1.keyRingPair,
      firstCurrency,
      GASP_ASSET_ID,
      new BN(10000),
      new BN(1),
    ).catch((reason) => {
      throw new Error(reason.data);
    }),
  ).rejects.toThrow(
    "1010: Invalid Transaction: The swap prevalidation has failed",
  );

  await waitForRewards(testUser1, liqId);

  const compoundMaintenanceOn = await compoundRewards(testUser1, liqId);
  eventResponse = getEventResultFromMangataTx(compoundMaintenanceOn);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toContain("TradingBlockedByMaintenanceMode");

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

  expect(currencyAssetDifference).bnEqual(new BN(20000));
  expect(testUser1.getAsset(liqId)?.amountBefore.reserved!).bnLt(
    testUser1.getAsset(liqId)?.amountAfter.reserved!,
  );
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
