import { jest } from "@jest/globals";
import { BN } from "ethereumjs-util";
import { User } from "../../utils/User";
import { getApi, initApi } from "../../utils/api";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Market } from "../../utils/market";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { getLiquidityAssetId, updateFeeLockMetadata } from "../../utils/tx";
import { stringToBN } from "../../utils/utils";
import { ApiPromise } from "@polkadot/api";
import { signTx } from "gasp-sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser: User;
let sudo: User;

let api: ApiPromise;
let threshold: BN;

let firstCurrency: BN;
let secondCurrency: BN;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  api = getApi();
  await setupApi();
  setupUsers();

  const meta = await api.query.feeLock.feeLockMetadata();
  threshold = stringToBN(
    JSON.parse(JSON.stringify(meta)).swapValueThreshold.toString(),
  );
  sudo = getSudoUser();

  await updateFeeLockMetadata(sudo, null, null, null, [[GASP_ASSET_ID, true]]);

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(sudo),
  );
});

beforeEach(async () => {
  [testUser] = setupUsers();

  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [threshold.muln(10), threshold.muln(10)],
    sudo,
  );
});

test("Sell asset - Only sold asset ( USDC ) in the wallet (Xyk pool, amount> threshold)", async () => {
  await Sudo.batchAsSudoFinalized(
    Market.createPool(
      firstCurrency,
      threshold.muln(2),
      secondCurrency,
      threshold.muln(2),
    ),
    Market.createPool(
      GASP_ASSET_ID,
      threshold.muln(2),
      firstCurrency,
      threshold.muln(2),
    ),
    Market.createPool(
      GASP_ASSET_ID,
      threshold.muln(2),
      secondCurrency,
      threshold.muln(2),
    ),
  );

  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
  );

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  await signTx(
    api,
    Market.sellAsset(
      liqId,
      firstCurrency,
      secondCurrency,
      threshold.add(threshold.divn(2)),
    ),
    testUser.keyRingPair,
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});
