/*
 *
 * @group maintenance
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { Maintenance } from "../../utils/Maintenance";
import { sellAsset } from "../../utils/tx";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let firstCurrency: BN;
const defaultCurrencyValue = new BN(1000000000000000);
const defaultPoolVolumeValue = new BN(100000000);
const foundationAccountAddress =
  "5Gc1GyxLPr1A4jE1U7u9LFYuFftDjeSYZWQXHgejQhSdEN4s";

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
    ),
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOff()
    )
  );
});

test("maintenance- check we can sell MGX tokens THEN switch maintenanceMode to on, repeat the operation and receive error THEN change mode again and check that we can sell tokens", async () => {
  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(firstCurrency);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await sellAsset(
    testUser1.keyRingPair,
    firstCurrency,
    MGA_ASSET_ID,
    new BN(10000),
    new BN(1)
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOn()
    )
  );

  await expect(
    sellAsset(
      testUser1.keyRingPair,
      firstCurrency,
      MGA_ASSET_ID,
      new BN(10000),
      new BN(1)
    ).catch((reason) => {
      throw new Error(reason.data);
    })
  ).rejects.toThrow(
    "1010: Invalid Transaction: The swap prevalidation has failed"
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOff()
    )
  );

  await sellAsset(
    testUser1.keyRingPair,
    firstCurrency,
    MGA_ASSET_ID,
    new BN(10000),
    new BN(1)
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const currencyAssetDifference = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore.free!.sub(
      testUser1.getAsset(firstCurrency)?.amountAfter.free!
    );

  expect(currencyAssetDifference).bnEqual(new BN(20000));
});
