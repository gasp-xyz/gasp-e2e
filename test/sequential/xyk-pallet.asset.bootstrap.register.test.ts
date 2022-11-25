/*
 *
 * @group xyk
 * @group asset
 * @group bootstrap
 * @group sequential
 */
import { getApi } from "../../utils/api";
import {
  getEnvironmentRequiredVars,
  waitForBootstrapStatus,
} from "../../utils/utils";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import {
  EventResult,
  ExtrinsicResult,
  findEventData,
} from "../../utils/eventListeners";
import {
  claimRewardsBootstrap,
  finalizeBootstrap,
  provisionBootstrap,
  scheduleBootstrap,
} from "../../utils/tx";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN } from "@polkadot/util";
import { BN_ONE, MangataGenericEvent, toBN } from "@mangata-finance/sdk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { setupApi } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod = 12;
const bootstrapPeriod = 15;
const whitelistPeriod = 1;
const poolAssetAmount = new BN(100000);
jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());

let sudo: User;
let testUser1: User;
let eventResponse: EventResult;
let bootstrapPool: any;

async function checkSudoOperataionSuccess(
  checkingEvent: MangataGenericEvent[]
) {
  const filterBootstrapEvent = checkingEvent.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid"
  );

  const userBootstrapCall = filterBootstrapEvent[0].event.data[0].toString();

  expect(userBootstrapCall).toContain("Ok");
}

async function runBootstrap(assetId: BN) {
  const api = getApi();
  const scheduleBootstrapEvent = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    assetId,
    waitingPeriod,
    bootstrapPeriod,
    whitelistPeriod
  );
  await checkSudoOperataionSuccess(scheduleBootstrapEvent);

  await sudo.mint(assetId, testUser1, toBN("1", 13));

  await waitForBootstrapStatus("Public", waitingPeriod);

  const provisionPublicBootstrapCurrency = await provisionBootstrap(
    testUser1,
    assetId,
    poolAssetAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicBootstrapCurrency);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const provisionPublicMGA = await provisionBootstrap(
    testUser1,
    MGA_ASSET_ID,
    poolAssetAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicMGA);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForBootstrapStatus("Finished", bootstrapPeriod);

  bootstrapPool = await api.query.xyk.pools([MGA_ASSET_ID, assetId]);
  expect(bootstrapPool[0]).bnEqual(poolAssetAmount);
  expect(bootstrapPool[1]).bnEqual(poolAssetAmount);

  const claimRewards = await claimRewardsBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimRewards);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const bootstrapFinalize = await finalizeBootstrap(sudo);
  await checkSudoOperataionSuccess(bootstrapFinalize);
}

beforeAll(async () => {
  await setupApi();
});

beforeEach(async () => {
  const keyring = new Keyring({ type: "sr25519" });
  sudo = new User(keyring, sudoUserName);
  testUser1 = new User(keyring);
  keyring.addPair(testUser1.keyRingPair);
  await testUser1.addMGATokens(sudo);
});

test("register asset with xyk disabled and try to schedule bootstrap, expect to success", async () => {
  const register = Assets.registerAsset(
    "Disabled Xyk",
    "Disabled Xyk",
    10,
    undefined,
    undefined,
    { operationsDisabled: true }
  );
  const result = await Sudo.asSudoFinalized(register);
  const assetId = findEventData(
    result,
    "assetRegistry.RegisteredAsset"
  ).assetId;

  await runBootstrap(assetId);
});

test("register asset with xyk enabled and try to schedule bootstrap, expect to success", async () => {
  const register = Assets.registerAsset(
    "Enabled Xyk",
    "Enabled Xyk",
    10,
    undefined,
    undefined,
    { operationsDisabled: false }
  );
  const result = await Sudo.asSudoFinalized(register);
  // assetRegistry.RegisteredAsset [8,{"decimals":10,"name":"0x44697361626c65642058796b","symbol":"0x44697361626c65642058796b","existentialDeposit":0,"location":null,"additional":{"xcm":null,"xyk":{"operationsDisabled":true}}}]
  const assetId = findEventData(
    result,
    "assetRegistry.RegisteredAsset"
  ).assetId;

  await runBootstrap(assetId);
});

test("try to schedule bootstrap for token when does not have AssetRegistry, expect to success", async () => {
  const assetId = await Assets.setupUserWithCurrencies(
    testUser1,
    [BN_ONE],
    sudo,
    true
  );

  await runBootstrap(assetId[0]);
});

test("register asset without asset metadata  and try to schedule bootstrap, expect to success", async () => {
  const register = Assets.registerAsset("Without Meta", "Without Meta", 10);
  const result = await Sudo.asSudoFinalized(register);
  // assetRegistry.RegisteredAsset [8,{"decimals":10,"name":"0x44697361626c65642058796b","symbol":"0x44697361626c65642058796b","existentialDeposit":0,"location":null,"additional":{"xcm":null,"xyk":{"operationsDisabled":true}}}]
  const assetId = findEventData(
    result,
    "assetRegistry.RegisteredAsset"
  ).assetId;

  await runBootstrap(assetId);
});
