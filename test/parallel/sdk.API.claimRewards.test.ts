/*
 *
 * @group sdk
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { Extrinsic, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { claimRewardsAll, getLiquidityAssetId } from "../../utils/tx";
import { getNextAssetId } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser: User;
let sudo: User;
let keyring: Keyring;
let tokenIds: number[];
let batchPromises: Extrinsic[];
const defaultCurrencyValue = new BN(250000);

let token1: BN;
let token2: BN;
let liqId1: BN;
let liqId2: BN;

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

  const nextTokenId = (await getNextAssetId()).toNumber();
  const lastTokenId = (await getNextAssetId()).toNumber() + 5;
  batchPromises = [];

  for (let tokenId = nextTokenId; tokenId < lastTokenId; tokenId++) {
    tokenIds.push(tokenId);
    batchPromises.push(
      Assets.mintToken(new BN(tokenId), testUser, defaultCurrencyValue)
    );
    batchPromises.push(
      Sudo.sudoAs(
        testUser,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.divn(2),
          new BN(tokenId),
          Assets.DEFAULT_AMOUNT.divn(2)
        )
      )
    );
  }

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser),
    Assets.mintNative(sudo)
  );

  await Sudo.batchAsSudoFinalized(...batchPromises);
});

beforeEach(async () => {
  [token1, token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser, defaultCurrencyValue),
    Assets.mintToken(token2, testUser, defaultCurrencyValue)
  );

  liqId1 = await getLiquidityAssetId(MGA_ASSET_ID, token1);
  liqId2 = await getLiquidityAssetId(MGA_ASSET_ID, token2);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId1.toNumber(), 20),
    Assets.promotePool(liqId2.toNumber(), 20)
  );
});

test("GIVEN a user that has available some rewards in ONE pool WHEN claim_all THEN the user gets the rewards for that pool", async () => {
  await claimRewardsAll(testUser, liqId1);
});
