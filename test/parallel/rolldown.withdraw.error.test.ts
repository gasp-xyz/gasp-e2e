/*
 *
 * @group parallel
 */
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { expectExtrinsicFail } from "../../utils/utils";
import { signTx } from "gasp-sdk";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Withdraw } from "../../utils/rolldown";
import { BN_TWO } from "@polkadot/util";

let user: User;

describe("Rolldown withdraw error", () => {
  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    [user] = setupUsers();
    await Sudo.batchAsSudoFinalized(Assets.mintNative(user));
  });

  test("withdrawing token which does not exist should return correct error", async () => {
    const nonExistingToken = "0x2bdcc0de6be1f7d2ee689a0342d76f52e8efa111";
    const errorMsg = "TokenDoesNotExist";

    const api = getApi();

    const withdrawTx = await Withdraw(
      user,
      BN_TWO,
      nonExistingToken,
      "Ethereum",
    );

    const events = await signTx(api, withdrawTx, user.keyRingPair);
    const response = expectExtrinsicFail(events);
    expect(response.data).toEqual(errorMsg);
  });
});
