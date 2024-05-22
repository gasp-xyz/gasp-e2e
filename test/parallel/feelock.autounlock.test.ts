/*
 *
 * @group parallel
 * @group paralgasless
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { sellAsset } from "../../utils/tx";
import { getBlockNumber, getFeeLockMetadata } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { ExtrinsicResult, waitForEvents } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let firstToken: BN;
let secondToken: BN;
const millionNative = new BN("1000000000000000000000000");
const nativeCurrencyId = MGA_ASSET_ID;
const defaultCurrencyValue = new BN(10000000);
const defaultPoolVolumeValue = new BN(1000000);
const FREE_AND_RESERVED = false;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();
});

beforeEach(async () => {
  await setupApi();

  [testUser1] = setupUsers();

  [firstToken, secondToken] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );
  testUser1.addAsset(nativeCurrencyId);
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1, millionNative),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        firstToken,
        defaultPoolVolumeValue,
        secondToken,
        defaultPoolVolumeValue,
      ),
    ),
  );
});

test("[gasless] Happy path: automatic-unlock", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  // act
  await sellAsset(
    testUser1.keyRingPair,
    firstToken,
    secondToken,
    new BN(10000),
    new BN(0),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "AssetsSwapped",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  const blockNo = await getBlockNumber();
  const gaslessMetadata = await getFeeLockMetadata(await getApi());
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  expect(
    testUser1.getAsset(nativeCurrencyId, FREE_AND_RESERVED)?.amountBefore!
      .reserved,
  ).bnEqual(new BN(0));
  expect(
    testUser1.getAsset(nativeCurrencyId, FREE_AND_RESERVED)?.amountAfter!
      .reserved,
  ).bnEqual(gaslessMetadata.feeLockAmount);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  // wait until lock is automatically released
  await waitForEvents(
    await getApi(),
    "feeLock.FeeLockUnlocked",
    gaslessMetadata.periodLength.toNumber() + 5,
    testUser1.keyRingPair.address,
  );
  const blockNoAfterEvent = await getBlockNumber();

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  // assert
  expect(
    testUser1.getAsset(nativeCurrencyId, FREE_AND_RESERVED)!.amountBefore
      .reserved,
  ).bnEqual(gaslessMetadata.feeLockAmount);
  expect(
    testUser1.getAsset(nativeCurrencyId, FREE_AND_RESERVED)!.amountAfter
      .reserved,
  ).bnEqual(new BN(0));
  //check that  did not stop waiting because of the limit of waits
  expect(blockNoAfterEvent - blockNo).toBeLessThan(
    gaslessMetadata.periodLength.toNumber() + 5,
  );
  //check that  did not happened before it should!
  expect(blockNoAfterEvent - blockNo).toBeGreaterThanOrEqual(
    gaslessMetadata.periodLength.toNumber(),
  );
});
