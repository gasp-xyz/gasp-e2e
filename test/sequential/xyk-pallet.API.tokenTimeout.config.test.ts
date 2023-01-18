/*
 *
 * @group xyk
 * @group sequential
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
import { updateTimeoutMetadata } from "../../utils/tx";
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
let createdToken: BN;
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

  createdToken = await Assets.issueAssetToUser(
    sudo,
    defaultCurrencyValue,
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(createdToken, sudo, defaultCurrencyValue),
    Assets.mintToken(createdToken, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultPoolVolumeValue,
        createdToken,
        defaultPoolVolumeValue
      )
    )
  );
});

test("gassless- GIVEN a non sudo user WHEN tokenTimeout configuration extrinsic is submitted THEN it fails with RequireSudo", async () => {
  await updateTimeoutMetadata(testUser1, new BN(20), new BN(200000), [
    [MGA_ASSET_ID, thresholdValue],
  ]).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toContain("RequireSudo");
  });
});

test("gassless- GIVEN an empty tokenTimeout configuration (all options empty) WHEN sudo submit the extrinsic THEN Tx fails because insuficient params", async () => {
  const checkEmptyTimeoutConfig = await updateTimeoutMetadata(
    sudo,
    new BN(0),
    new BN(0),
    null
  );
  await waitSudoOperataionFail(
    checkEmptyTimeoutConfig,
    "InvalidTimeoutMetadata"
  );
});

test("xyk-pallet-gassless GIVEN a tokenTimeout WHEN periodLength and timeoutAmount are set THEN extrinsic succeed and tokensTimeout is correctly configured", async () => {
  const api = getApi();

  const setupTimeoutConfig = await updateTimeoutMetadata(
    sudo,
    new BN(20),
    new BN(10000),
    [
      [MGA_ASSET_ID, thresholdValue],
      [createdToken, thresholdValue],
    ]
  );
  await waitSudoOperataionSuccess(setupTimeoutConfig);

  const currentPeriodLength = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.tokenTimeout.timeoutMetadata())
    ).periodLength.toString()
  );

  const currentTimeoutAmount = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.tokenTimeout.timeoutMetadata())
    ).timeoutAmount.toString()
  );

  expect(currentPeriodLength).bnEqual(new BN(20));
  expect(currentTimeoutAmount).bnEqual(new BN(10000));
});

test("gassless- Сhanging timeout config parameter on the fly is works robustly", async () => {
  const api = getApi();

  const lastPeriodLength = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.tokenTimeout.timeoutMetadata())
    ).periodLength.toString()
  );
  const timeoutAmount = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.tokenTimeout.timeoutMetadata())
    ).timeoutAmount.toString()
  );

  const setupTimeoutConfig = await updateTimeoutMetadata(
    sudo,
    lastPeriodLength.add(new BN(10)),
    timeoutAmount,
    null
  );
  await waitSudoOperataionSuccess(setupTimeoutConfig);

  const newPeriodLength = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.tokenTimeout.timeoutMetadata())
    ).periodLength.toString()
  );

  expect(newPeriodLength).bnEqual(lastPeriodLength.add(new BN(10)));
});
