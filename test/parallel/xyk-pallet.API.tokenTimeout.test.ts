/*
 *
 * @group xyk
 * @group parallel
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import {
  getEventResultFromMangataTx,
  sudoIssueAsset,
} from "../../utils/txHandler";
import { setupApi, setupUsers } from "../../utils/setup";
import { BN, toBN } from "@mangata-finance/sdk";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars, getBlockNumber } from "../../utils/utils";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { Xyk } from "../../utils/xyk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { updateTimeoutMetadata } from "../../utils/tx";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let createdToken: BN;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
});

beforeEach(async () => {
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
});

test("xyk-pallet- create pool and updete Token Timeout", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(createdToken, sudo, defaultCurrencyValue),
    Assets.mintToken(createdToken, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultCurrencyValue,
        createdToken,
        defaultCurrencyValue
      )
    )
  );

  await updateTimeoutMetadata(sudo, new BN(20), new BN(200000), [
    // {
    // //@ts-ignore
    //  0,
    //  1000
    //  }
  ]);
});
