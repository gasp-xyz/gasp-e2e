import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { testLog } from "../../utils/Logger";
import { Assets } from "../../utils/Assets";
import { BN } from "ethereumjs-util";
import { Sudo } from "../../utils/sudo";
import { Market } from "../../utils/market";
import {
  getLiquidityAssetId,
  mintLiquidity,
  promotePool,
} from "../../utils/tx";

let testUser1: User;
let testUser2: User;
let sudo: User;
let firstCurrency: BN;
let secondCurrency: BN;
let liqId: BN;

beforeEach(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  [testUser1, testUser2] = setupUsers();
  sudo = getSudoUser();
  testLog.getLog().info(testUser1.keyRingPair.address);
  //add two currencies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT],
    sudo,
    true,
  );
  await setupApi();
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser1),
    Assets.mintToken(firstCurrency, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(secondCurrency, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
    Assets.mintToken(firstCurrency, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(secondCurrency, testUser2, Assets.DEFAULT_AMOUNT),
    Sudo.sudoAs(
      testUser1,
      Market.createPool(
        firstCurrency,
        Assets.DEFAULT_AMOUNT.divn(2),
        secondCurrency,
        Assets.DEFAULT_AMOUNT.divn(2),
        "StableSwap",
      ),
    ),
  );

  liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  await promotePool(testUser1.keyRingPair, liqId, 20);
});

test("Stable pool - Auto activation when minting, does not activate all the minted amounts", async () => {
  await mintLiquidity(
    testUser2.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(10000),
  );
});
