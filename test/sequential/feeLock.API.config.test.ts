/*
 *
 * @group sequential
 * @group gassless
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  ExtrinsicResult,
  waitSudoOperataionSuccess,
  waitSudoOperataionFail,
} from "../../utils/eventListeners";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata } from "../../utils/tx";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let firstCurrency: BN;
const thresholdValue = new BN(30000);
const defaultCurrencyValue = new BN(10000000);
const defaultPoolVolumeValue = new BN(1000000);

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
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, sudo, defaultCurrencyValue),
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultPoolVolumeValue,
        firstCurrency,
        defaultPoolVolumeValue
      )
    )
  );
});

test("gassless- GIVEN a non sudo user WHEN feeLock configuration extrinsic is submitted THEN it fails with RequireSudo", async () => {
  await updateFeeLockMetadata(
    testUser1,
    new BN(10),
    new BN(10),
    thresholdValue,
    [[MGA_ASSET_ID, true]]
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toContain("RequireSudo");
  });
});

test("gassless- GIVEN an empty feeLock configuration (all options empty) WHEN sudo submit the extrinsic THEN Tx fails because insuficient params", async () => {
  const checkEmptyTimeoutConfig = await updateFeeLockMetadata(
    sudo,
    new BN(0),
    new BN(0),
    new BN(0),
    null
  );
  await waitSudoOperataionFail(
    checkEmptyTimeoutConfig,
    "InvalidFeeLockMetadata"
  );
});

test("xyk-pallet-gassless GIVEN a feeLock WHEN periodLength and timeoutAmount are set THEN extrinsic succeed and tokensTimeout is correctly configured", async () => {
  const api = getApi();

  const setupTimeoutConfig = await updateFeeLockMetadata(
    sudo,
    new BN(10),
    new BN(10),
    thresholdValue,
    [[MGA_ASSET_ID, true]]
  );
  await waitSudoOperataionSuccess(setupTimeoutConfig);

  const currentPeriodLength = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).periodLength.toString()
  );

  const currentFeeLockAmount = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).feeLockAmount.toString()
  );

  expect(currentPeriodLength).bnEqual(new BN(10));
  expect(currentFeeLockAmount).bnEqual(new BN(10));
});

test("gassless- Сhanging feeLock config parameter on the fly is works robustly", async () => {
  const api = getApi();

  const lastPeriodLength = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).periodLength.toString()
  );
  const feeLockAmount = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).feeLockAmount.toString()
  );
  const swapValueThreshold = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).swapValueThreshold.toString()
  );

  const setupTimeoutConfig = await updateFeeLockMetadata(
    sudo,
    lastPeriodLength.add(new BN(5)),
    feeLockAmount,
    swapValueThreshold,
    null
  );
  await waitSudoOperataionSuccess(setupTimeoutConfig);

  const newPeriodLength = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).periodLength.toString()
  );

  expect(newPeriodLength).bnEqual(lastPeriodLength.add(new BN(5)));
});

afterAll(async () => {
  await updateFeeLockMetadata(sudo, new BN(10), new BN(10), null, null);
});
