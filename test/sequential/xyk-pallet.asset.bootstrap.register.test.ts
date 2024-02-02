/*
 *
 * @group xyk
 * @group asset
 * @group rewards-bootstrap
 */
import { jest } from "@jest/globals";
import { getApi } from "../../utils/api";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import {
  findEventData,
  waitSudoOperationSuccess,
  waitSudoOperationFail,
  expectMGAExtrinsicSuDidSuccess,
} from "../../utils/eventListeners";
import {
  scheduleBootstrap,
  waitForBootstrapStatus,
} from "../../utils/Bootstrap";
import { getNextAssetId } from "../../utils/tx";
import { BN } from "@polkadot/util";
import { BN_ONE, toBN } from "@mangata-finance/sdk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod = 4;
const bootstrapPeriod = 5;
const poolAssetAmount = new BN(100000);
jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());

let sudo: User;
let testUser1: User;
//let eventResponse: EventResult;
let bootstrapPool: any;

async function runBootstrap(assetId: any) {
  const api = getApi();
  const assetIdBn = new BN(assetId.toString());
  const scheduleBootstrapEvent = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    assetIdBn,
    waitingPeriod,
    bootstrapPeriod,
  );
  await waitSudoOperationSuccess(scheduleBootstrapEvent);

  await waitForBootstrapStatus("Public", waitingPeriod);

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(assetId, testUser1, toBN("1", 13)),
    Sudo.sudoAs(
      testUser1,
      api.tx.bootstrap.provision(assetId, poolAssetAmount),
    ),
    Sudo.sudoAs(
      testUser1,
      api.tx.bootstrap.provision(MGA_ASSET_ID, poolAssetAmount),
    ),
  );

  await waitForBootstrapStatus("Finished", bootstrapPeriod);

  bootstrapPool = await api.query.xyk.pools([MGA_ASSET_ID, assetId]);
  expect(bootstrapPool[0]).bnEqual(poolAssetAmount);
  expect(bootstrapPool[1]).bnEqual(poolAssetAmount);

  const claimRewardsAndBootstrapFinalize = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, api.tx.bootstrap.claimLiquidityTokens()),
    Sudo.sudoAs(sudo, api.tx.bootstrap.preFinalize()),
    Sudo.sudoAs(sudo, api.tx.bootstrap.finalize()),
  );
  await expectMGAExtrinsicSuDidSuccess(claimRewardsAndBootstrapFinalize);
  // const claimRewards = await claimRewardsBootstrap(testUser1);
  // eventResponse = getEventResultFromMangataTx(claimRewards);
  // expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // const bootstrapFinalize = await finalizeBootstrap(sudo);
  // eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
  // expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
}

beforeAll(async () => {
  await setupApi();
  setupUsers();
  const keyring = new Keyring({ type: "sr25519" });
  sudo = new User(keyring, sudoUserName);
  testUser1 = new User(keyring);
  keyring.addPair(sudo.keyRingPair);
  keyring.addPair(testUser1.keyRingPair);
  await testUser1.addMGATokens(sudo, toBN("1", 22));
});

test("register asset and then try to register new one with the same location, expect to conflict", async () => {
  const assetId = (
    await Assets.setupUserWithCurrencies(sudo, [new BN(250000)], sudo, true)
  )[0];

  await sudo.registerAsset(assetId);

  const tempAssetId = await getNextAssetId();

  const userRegisterNewAsset = await sudo.registerAsset(
    tempAssetId,
    tempAssetId,
    {
      V2: {
        parents: 1,
        interior: {
          X3: [
            {
              Parachain: 3210 + assetId.toNumber(),
            },
            {
              GeneralKey: "0x00834",
            },
            {
              PalletInstance: 10,
            },
          ],
        },
      },
    },
  );

  await waitSudoOperationFail(userRegisterNewAsset, ["ConflictingLocation"]);
});

test("register asset with xyk disabled and try to schedule bootstrap, expect to success", async () => {
  const register = Assets.registerAsset(
    "Disabled Xyk",
    "Disabled Xyk",
    10,
    undefined,
    undefined,
    { operationsDisabled: true },
  );
  const result = await Sudo.asSudoFinalized(register);
  const assetId = findEventData(
    result,
    "assetRegistry.RegisteredAsset",
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
    { operationsDisabled: false },
  );
  const result = await Sudo.asSudoFinalized(register);
  // assetRegistry.RegisteredAsset [8,{"decimals":10,"name":"0x44697361626c65642058796b","symbol":"0x44697361626c65642058796b","existentialDeposit":0,"location":null,"additional":{"xcm":null,"xyk":{"operationsDisabled":true}}}]
  const assetId = findEventData(
    result,
    "assetRegistry.RegisteredAsset",
  ).assetId;

  await runBootstrap(assetId);
});

test("try to schedule bootstrap for token when does not have AssetRegistry, expect to success", async () => {
  const assetId = await Assets.setupUserWithCurrencies(
    testUser1,
    [BN_ONE],
    sudo,
    true,
  );

  await runBootstrap(assetId[0]);
});

test("register asset without asset metadata  and try to schedule bootstrap, expect to success", async () => {
  const register = Assets.registerAsset("Without Meta", "Without Meta", 10);
  const result = await Sudo.asSudoFinalized(register);
  // assetRegistry.RegisteredAsset [8,{"decimals":10,"name":"0x44697361626c65642058796b","symbol":"0x44697361626c65642058796b","existentialDeposit":0,"location":null,"additional":{"xcm":null,"xyk":{"operationsDisabled":true}}}]
  const assetId = findEventData(
    result,
    "assetRegistry.RegisteredAsset",
  ).assetId;

  await runBootstrap(assetId);
});
