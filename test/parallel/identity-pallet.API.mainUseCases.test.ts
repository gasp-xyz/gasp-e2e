/*
 *
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import {
  addUserIdentitySub,
  clearUserIdentity,
  setUserIdentity,
} from "../../utils/tx";
import { getUserIdentity, getUserSubIdentity } from "../../utils/utils";
import { BN_THOUSAND, BN_FIVE } from "@polkadot/util";
import { BN_ONE, BN_HUNDRED } from "@mangata-finance/sdk";
import { AssetWallet, User } from "../../utils/User";
import { GASP_ASSET_ID } from "../../utils/Constants";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

let users: User[];
describe("Identity pallet tests: Main use cases", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    users = await setupUsers();
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(
        users[0],
        BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
      ),
      Assets.mintNative(
        users[1],
        BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
      ),
      Assets.mintNative(
        users[2],
        BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
      ),
      Assets.mintNative(
        users[3],
        BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
      ),
    );
  });
  it("Check setter & getters for identity pallet and reserves 5k mgas", async () => {
    const name = "CookiesAndMilk";
    const testUser = users[0];
    testUser.addAsset(GASP_ASSET_ID);
    await testUser.refreshAmounts();
    await setUserIdentity(testUser, name);
    const identity = await getUserIdentity(testUser);
    expect(identity.info.display.Raw).toEqual(name);
    await testUser.refreshAmounts(AssetWallet.AFTER);
    const reserved = testUser.getWalletDifferences()[0].diff.reserved;
    const free = testUser.getWalletDifferences()[0].diff.free;
    expect(reserved).bnGt(BN_FIVE.mul(BN_THOUSAND).mul(Assets.MG_UNIT));
    expect(free.neg()).bnGt(BN_FIVE.mul(BN_THOUSAND).mul(Assets.MG_UNIT));
  });
  it("Check that a user can unset the name with identity pallet and tokens are unreserved", async () => {
    const name = "CookiesAndMilk2";
    const testUser = users[1];
    await setUserIdentity(testUser, name);
    testUser.addAsset(GASP_ASSET_ID);
    await testUser.refreshAmounts();
    const identity = await getUserIdentity(testUser);
    expect(identity.info.display.Raw).toEqual(name);
    await clearUserIdentity(testUser);
    await testUser.refreshAmounts(AssetWallet.AFTER);
    const identityAfterClear = await getUserIdentity(testUser);
    expect(identityAfterClear).toBeNull();
    const reserved = testUser.getWalletDifferences()[0].diff.reserved;
    const free = testUser.getWalletDifferences()[0].diff.free;
    expect(free).bnGt(BN_ONE);
    //Gt because some tokens goes to fees.
    expect(free.neg()).bnGt(reserved);
  });
  it("Check that a user can sub one address", async () => {
    const name = "CookiesAndMilk3";
    const subName = "CookiesSub4";
    const testUser = users[2];
    const userToSub = users[3];
    await setUserIdentity(testUser, name);
    await addUserIdentitySub(testUser, userToSub, "CookiesSub4");
    const identity = await getUserIdentity(testUser);
    const subIdentity = await getUserSubIdentity(userToSub);
    expect(identity.info.display.Raw).toEqual(name);
    expect(subIdentity[1].Raw).toEqual(subName);
  });
});
