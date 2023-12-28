/*
 *
 * @group maintenance
 */
import { jest } from "@jest/globals";
import { hexToU8a } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { FOUNDATION_ADDRESS_1, MGA_ASSET_ID } from "../../utils/Constants";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { Maintenance } from "../../utils/Maintenance";
import {
  compoundRewards,
  getCurrentNonce,
  getLiquidityAssetId,
  sellAsset,
} from "../../utils/tx";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import {
  EventResult,
  ExtrinsicResult,
  waitForRewards,
  waitSudoOperationFail,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { testLog } from "../../utils/Logger";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let firstCurrency: BN;
let eventResponse: EventResult;
let liqId: BN;
let maintenanceStatus: any;
const defaultCurrencyValue = new BN(1000000000000000);
const defaultPoolVolumeValue = new BN(10000000000);
const foundationAccountAddress = FOUNDATION_ADDRESS_1;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);

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
      Xyk.createPool(
        MGA_ASSET_ID,
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

  liqId = await getLiquidityAssetId(MGA_ASSET_ID, firstCurrency);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(MGA_ASSET_ID, firstCurrency, defaultPoolVolumeValue),
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

test("maintenance- check we can sell MGX tokens and compoundRewards THEN switch maintenanceMode to on, repeat the operation and receive error", async () => {
  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(firstCurrency);
  testUser1.addAsset(liqId);

  await waitForRewards(testUser1, liqId);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await sellAsset(
    testUser1.keyRingPair,
    firstCurrency,
    MGA_ASSET_ID,
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
      MGA_ASSET_ID,
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
    MGA_ASSET_ID,
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

test("maintenance- validate that when UpgradabilityON, Sudo or council can only run upgradability extrinsics", async () => {
  //const mangata = await getMangataInstance(chainUri);
  const api = getApi();
  const hash =
    "0xa4f385913ba0acb618402fe01aa20a87ed3d5b58cc7d28cb7a9165eb309c9300";

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOn(),
    ),
  );

  const authorizeUpgradeBefore = await signTx(
    api!,
    api!.tx.sudo.sudo(
      //@ts-ignore
      api!.tx.parachainSystem.authorizeUpgrade(hash, false),
    ),
    sudo.keyRingPair,
    {
      nonce: await getCurrentNonce(sudo.keyRingPair.address),
    },
  );
  await waitSudoOperationFail(authorizeUpgradeBefore, [
    "UpgradeBlockedByMaintenanceMode",
  ]);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchUpgradabilityInMaintenanceModeOn(),
    ),
  );

  const authorizeUpgradeAfter = await signTx(
    api!,
    //@ts-ignore
    api!.tx.sudo.sudo(api!.tx.parachainSystem.authorizeUpgrade(hash, false)),
    sudo.keyRingPair,
    {
      nonce: await getCurrentNonce(sudo.keyRingPair.address),
    },
  );
  await waitSudoOperationSuccess(authorizeUpgradeAfter);
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

async function checkMaintenanceStatus(
  maintenanceModeValue: boolean,
  upgradableValue: boolean,
) {
  const api = getApi();
  maintenanceStatus = await api.query.maintenance.maintenanceStatus();
  expect(maintenanceStatus.isMaintenance.isTrue).toEqual(maintenanceModeValue);
  expect(maintenanceStatus.isUpgradableInMaintenance.isTrue).toEqual(
    upgradableValue,
  );
}
