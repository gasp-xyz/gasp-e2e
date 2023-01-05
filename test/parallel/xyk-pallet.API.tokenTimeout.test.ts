/*
 *
 * @group xyk
 * @group parallel
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
import { BN, toBN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { sellAsset, updateTimeoutMetadata } from "../../utils/tx";
import {
  getEventResultFromMangataTx,
  sudoIssueAsset,
} from "../../utils/txHandler";
import { AssetWallet, User } from "../../utils/User";
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
const defaultSwapValue = new BN(50000);
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

  const poolCurrencyIssue = await sudoIssueAsset(
    sudo.keyRingPair,
    toBN("1", 20),
    sudo.keyRingPair.address
  );
  const poolEventResult = await getEventResultFromMangataTx(poolCurrencyIssue, [
    "tokens",
    "Issued",
    sudo.keyRingPair.address,
  ]);
  const poolAssetId = poolEventResult.data[0].split(",").join("");
  createdToken = new BN(poolAssetId);

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

test("xyk-pallet- GIVEN a token WHEN no token timeout is configured THEN fees are charged as normal", async () => {
  const api = getApi();

  const timeoutMetadata = await api.query.tokenTimeout.timeoutMetadata();

  if (timeoutMetadata.isEmpty === true) {
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await sellAsset(
      testUser1.keyRingPair,
      MGA_ASSET_ID,
      createdToken,
      defaultSwapValue,
      new BN(1)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      // eslint-disable-next-line jest/no-conditional-expect
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const tokenFees = testUser1
      .getAsset(MGA_ASSET_ID)
      ?.amountBefore.free.sub(
        testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!
      )
      .add(defaultSwapValue);
    // eslint-disable-next-line jest/no-conditional-expect
    expect(tokenFees).bnGt(new BN(0));
  }
});

test("GIVEN a non sudo user WHEN tokenTimeout configuration extrinsic is submitted THEN it fails with RequireSudo", async () => {
  await updateTimeoutMetadata(testUser1, new BN(20), new BN(200000), [
    [MGA_ASSET_ID, thresholdValue],
  ]).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toContain("RequireSudo");
  });
});

test("GIVEN an empty tokenTimeout configuration (all options empty) WHEN sudo submit the extrinsic THEN Tx fails because insuficient params", async () => {
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

test("GIVEN a tokenTimeout WHEN periodLength and timeoutAmount are set THEN extrinsic succeed and tokensTimeout is correctly configured", async () => {
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
});

test("Сhanging timeout config parameter on the fly is works robustly", async () => {
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
    [
      [MGA_ASSET_ID, thresholdValue],
      [createdToken, thresholdValue],
    ]
  );
  await waitSudoOperataionSuccess(setupTimeoutConfig);

  const newPeriodLength = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.tokenTimeout.timeoutMetadata())
    ).periodLength.toString()
  );

  expect(newPeriodLength).bnEqual(lastPeriodLength.add(new BN(10)));
});
