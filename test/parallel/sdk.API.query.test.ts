/*
 *
 * @group sdk
 * @group parallel
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  getFeeLockMetadata,
} from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { getLiquidityAssetId } from "../../utils/tx";
import { BN_ZERO, MangataInstance } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser: User;
//let testUser1: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let liqId: BN;
let mangata: MangataInstance;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);

  [testUser] = setupUsers();

  await setupApi();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo
  );

  const { chainUri } = getEnvironmentRequiredVars();
  mangata = await getMangataInstance(chainUri);

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  liqId = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId.toNumber(), 20));
});

// beforeEach(async () => {
//   testUser1 = new User(keyring);
//   await Sudo.batchAsSudoFinalized(
//     Assets.mintNative(testUser1),
//     Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT)
//   );
//   testUser1.addAsset(MGA_ASSET_ID);
//   testUser1.addAsset(token1);
//   testUser1.addAsset(liqId);
// });

test("getAmountOfTokensInPool return poolAmount", async () => {
  const poolAmount = await (
    await mangata
  ).query.getAmountOfTokensInPool(MGA_ASSET_ID.toString(), token1.toString());

  expect(poolAmount[0]).bnEqual(Assets.DEFAULT_AMOUNT.divn(2));
  expect(poolAmount[1]).bnEqual(Assets.DEFAULT_AMOUNT.divn(2));
});

test("check parameters of getAmountOfTokensInPool function", async () => {
  const { feeLockAmount, periodLength, swapValueThreshold } =
    await getFeeLockMetadata();
  expect(feeLockAmount).bnGt(BN_ZERO);
  expect(periodLength).bnGt(BN_ZERO);
  expect(swapValueThreshold).toEqual("666");
});

test("check parameters of getAssetsInfo function", async () => {
  const info = await (await mangata).query.getAssetsInfo();

  expect(info).bnGt(BN_ZERO);
});
