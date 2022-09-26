/*
 *
 * @group setup
 */
import { getApi, initApi } from "../../utils/api";
import { getAllAssetsInfo, getBalanceOfPool } from "../../utils/tx";
import { BN } from "@polkadot/util";
import {
  MGA_ASSET_ID,
  MGA_ASSET_NAME,
  KSM_ASSET_ID,
  KSM_ASSET_NAME,
  BTC_ASSET_ID,
  BTC_ASSET_NAME,
  USDC_ASSET_ID,
  USDC_ASSET_NAME,
} from "../../utils/Constants";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { setAssetInfo } from "../../utils/txHandler";
import { toBN } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let sudo: User;
let keyring: Keyring;
const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const KSM_asset_amount = toBN("1", 16);
const oth_asets_amount = toBN("1", 22);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  //set sudo user for creating pool.
  keyring = new Keyring({ type: "sr25519" });
  sudo = new User(keyring, sudoUserName);
  keyring.addPair(sudo.keyRingPair);
  await sudo.addMGATokens(sudo);
});

test("xyk-CI - Check if MGA, mKSM, mBTC and mUSD exist", async () => {
  const assetsInfo = await getAllAssetsInfo();
  expect(assetsInfo).not.toBeUndefined();

  const assetMGAexist = assetsInfo.findIndex(
    (asset) => asset.name === "Mangata"
  );
  const assetKSMexist = assetsInfo.findIndex((asset) => asset.name === "mKSM");
  const assetBTCexist = assetsInfo.findIndex((asset) => asset.name === "mBTC");
  const assetUSDCexist = assetsInfo.findIndex((asset) => asset.name === "mUSD");

  if (assetMGAexist < 0) {
    await setAssetInfo(
      sudo,
      MGA_ASSET_ID,
      MGA_ASSET_NAME,
      MGA_ASSET_NAME,
      "Mangata token",
      new BN(18)
    );
  }

  if (assetKSMexist < 0) {
    await setAssetInfo(
      sudo,
      KSM_ASSET_ID,
      KSM_ASSET_NAME,
      KSM_ASSET_NAME,
      "Kusama token",
      new BN(12)
    );
  }

  if (assetBTCexist < 0) {
    await setAssetInfo(
      sudo,
      BTC_ASSET_ID,
      BTC_ASSET_NAME,
      BTC_ASSET_NAME,
      "BTC token",
      new BN(18)
    );
  }

  if (assetUSDCexist < 0) {
    await setAssetInfo(
      sudo,
      USDC_ASSET_ID,
      USDC_ASSET_NAME,
      USDC_ASSET_NAME,
      "USDC token",
      new BN(18)
    );
  }
});

test("xyk-CI - Check if pool MGA-mKSM, MGA-mBTC and MGA-mUSD exist", async () => {
  const balanceMGAKSM = await getBalanceOfPool(MGA_ASSET_ID, KSM_ASSET_ID);
  const balanceMGABTC = await getBalanceOfPool(MGA_ASSET_ID, BTC_ASSET_ID);
  const balanceMGAUSD = await getBalanceOfPool(MGA_ASSET_ID, USDC_ASSET_ID);

  if (balanceMGAKSM[0].isZero()) {
    await sudo.mint(KSM_ASSET_ID, sudo, toBN("1", 17));
    await sudo.createPoolToAsset(
      oth_asets_amount,
      KSM_asset_amount,
      MGA_ASSET_ID,
      KSM_ASSET_ID
    );
  }

  if (balanceMGABTC[0].isZero()) {
    await sudo.mint(BTC_ASSET_ID, sudo, toBN("1", 23));
    await sudo.createPoolToAsset(
      oth_asets_amount,
      oth_asets_amount,
      MGA_ASSET_ID,
      BTC_ASSET_ID
    );
  }

  if (balanceMGAUSD[0].isZero()) {
    await sudo.mint(USDC_ASSET_ID, sudo, toBN("1", 23));
    await sudo.createPoolToAsset(
      oth_asets_amount,
      oth_asets_amount,
      MGA_ASSET_ID,
      USDC_ASSET_ID
    );
  }
});
