/*
 *
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN, BN_ZERO, signTx } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { getLiquidityAssetId, promotePool } from "../../utils/tx";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars, stringToBN } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let liqId: BN;
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

  [testUser1] = setupUsers();

  await setupApi();
});

beforeEach(async () => {
  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  liqId = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Assets.mintNative(testUser1)
  );
});

test("Check that we can get the list of promoted pools with proofOfStake.promotedPoolRewards data storage", async () => {
  const poolWeight = await getPoolWeight(liqId);

  expect(poolWeight).bnGt(BN_ZERO);
});

test("Validate that weight can be modified by using updatePoolPromotion AND only sudo can update weights", async () => {
  const api = getApi();

  const poolWeightBefore = await getPoolWeight(liqId);

  await signTx(
    api,
    api.tx.proofOfStake.updatePoolPromotion(
      liqId,
      poolWeightBefore.div(new BN(2))
    ),
    testUser1.keyRingPair
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("UnknownError");
  });

  await promotePool(
    sudo.keyRingPair,
    liqId,
    poolWeightBefore.div(new BN(2)).toNumber()
  );

  const poolWeightAfter = await getPoolWeight(liqId);

  expect(poolWeightAfter).bnEqual(poolWeightBefore.div(new BN(2)));
});

async function getPoolWeight(tokenId: BN) {
  const api = getApi();

  const poolRewards = JSON.parse(
    JSON.stringify(await api.query.proofOfStake.promotedPoolRewards())
  );

  const poolWeight = stringToBN(poolRewards[tokenId.toString()].weight);

  return poolWeight;
}
