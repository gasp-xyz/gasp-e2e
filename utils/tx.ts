/* eslint-disable no-console */
import {
  BN_ONE,
  MangataGenericEvent,
  signTx,
  toBN,
  TokenBalance,
} from "@mangata-finance/sdk";
import { AddressOrPair, SubmittableExtrinsic } from "@polkadot/api/types";
import { KeyringPair } from "@polkadot/keyring/types";
import { StorageKey } from "@polkadot/types";
import { AccountData, AccountId32 } from "@polkadot/types/interfaces";
import { AnyJson, AnyTuple, Codec } from "@polkadot/types/types";
import { BN } from "@polkadot/util";
import { env } from "process";
import { getApi, getMangataInstance } from "./api";
import {
  ETH_ASSET_ID,
  MAX_BALANCE,
  MGA_ASSET_ID,
  MGA_DEFAULT_LIQ_TOKEN,
} from "./Constants";
import { Fees } from "./Fees";
import { SudoUser } from "./Framework/User/SudoUser";
import { testLog } from "./Logger";
import { SudoDB } from "./SudoDB";
import {
  getEventResultFromMangataTx,
  setAssetInfo,
  signSendAndWaitToFinishTx,
} from "./txHandler";
import { User } from "./User";
import { getEnvironmentRequiredVars, stringToBN } from "./utils";
import Keyring from "@polkadot/keyring";
import { ExtrinsicResult } from "./eventListeners";
import { Sudo } from "./sudo";
import { Assets } from "./Assets";

export const signTxDeprecated = async (
  tx: SubmittableExtrinsic<"promise">,
  address: AddressOrPair,
  nonce: BN,
) => {
  await tx.signAndSend(address, { nonce }, () => {
    // handleTx(result, unsub)
  });
  //   setNonce(nonce + 1)
};

export async function calcuate_mint_liquidity_price_local(
  firstAssetId: BN,
  secondAssetId: BN,
  first_asset_amount: BN,
) {
  const liquidity_asset_id = await getLiquidityAssetId(
    firstAssetId,
    secondAssetId,
  );
  const total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  const [first_asset_reserve, second_asset_reserve] = await getBalanceOfPool(
    firstAssetId,
    secondAssetId,
  );

  const second_asset_amount: BN = first_asset_amount
    .mul(second_asset_reserve)
    .div(first_asset_reserve)
    .add(new BN(1));
  const liquidity_assets_minted: BN = first_asset_amount
    .mul(total_liquidity_assets)
    .div(first_asset_reserve);

  return [second_asset_amount, liquidity_assets_minted];
}

export async function calcuate_burn_liquidity_price_local(
  firstAssetId: BN,
  secondAssetId: BN,
  liquidity_asset_amount: BN,
) {
  const liquidity_asset_id = await getLiquidityAssetId(
    firstAssetId,
    secondAssetId,
  );
  const total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  const [first_asset_reserve, second_asset_reserve] = await getBalanceOfPool(
    firstAssetId,
    secondAssetId,
  );

  const first_asset_amount: BN = first_asset_reserve
    .mul(liquidity_asset_amount)
    .div(total_liquidity_assets);
  const second_asset_amount: BN = second_asset_reserve
    .mul(liquidity_asset_amount)
    .div(total_liquidity_assets);

  return [first_asset_amount, second_asset_amount];
}

export function calculate_sell_price_local(
  input_reserve: BN,
  output_reserve: BN,
  sell_amount: BN,
) {
  const input_amount_with_fee: BN = sell_amount.mul(new BN(997));
  const numerator: BN = input_amount_with_fee.mul(output_reserve);
  const denominator: BN = input_reserve
    .mul(new BN(1000))
    .add(input_amount_with_fee);
  const result: BN = numerator.div(denominator);
  return new BN(result.toString());
}

export function calculate_sell_price_local_no_fee(
  input_reserve: BN,
  output_reserve: BN,
  sell_amount: BN,
) {
  const input_amount_with_no_fee: BN = sell_amount.mul(new BN(1000));
  const numerator: BN = input_amount_with_no_fee.mul(output_reserve);
  const denominator: BN = input_reserve
    .mul(new BN(1000))
    .add(input_amount_with_no_fee);
  const result: BN = numerator.div(denominator);
  return new BN(result.toString());
}

export function calculate_buy_price_local(
  input_reserve: BN,
  output_reserve: BN,
  buy_amount: BN,
) {
  const numerator: BN = input_reserve.mul(buy_amount).mul(new BN(1000));
  const denominator: BN = output_reserve.sub(buy_amount).mul(new BN(997));
  const result: BN = numerator.div(denominator).add(new BN(1));
  return new BN(result.toString());
}

export function calculate_buy_price_local_no_fee(
  input_reserve: BN,
  output_reserve: BN,
  buy_amount: BN,
) {
  const numerator: BN = input_reserve.mul(buy_amount).mul(new BN(1000));
  const denominator: BN = output_reserve.sub(buy_amount).mul(new BN(1000));
  const result: BN = numerator.div(denominator).add(new BN(1));
  return new BN(result.toString());
}

export async function getBurnAmount(
  firstAssetId: BN,
  secondAssetId: BN,
  liquidityAssetAmount: BN,
) {
  const mangata = await getMangataInstance();
  const result = await mangata.rpc.getBurnAmount({
    firstTokenId: firstAssetId.toString(),
    secondTokenId: secondAssetId.toString(),
    amount: liquidityAssetAmount,
  });
  testLog.getLog().info(result.firstAssetAmount.toString());
  return result;
}

export async function calculate_sell_price_rpc(
  input_reserve: BN,
  output_reserve: BN,
  sell_amount: BN,
): Promise<BN> {
  const mangata = await getMangataInstance();
  return await mangata.rpc.calculateSellPrice({
    amount: sell_amount,
    inputReserve: input_reserve,
    outputReserve: output_reserve,
  });
}

export async function calculate_buy_price_rpc(
  inputReserve: BN,
  outputReserve: BN,
  buyAmount: BN,
) {
  const mangata = await getMangataInstance();
  return await mangata.rpc.calculateBuyPrice({
    inputReserve: inputReserve,
    outputReserve: outputReserve,
    amount: buyAmount,
  });
}

export async function calculate_buy_price_id_rpc(
  soldTokenId: BN,
  boughtTokenId: BN,
  buyAmount: BN,
) {
  const mangata = await getMangataInstance();
  return await mangata.rpc.calculateBuyPriceId(
    soldTokenId.toString(),
    boughtTokenId.toString(),
    buyAmount,
  );
}

export async function calculate_sell_price_id_rpc(
  soldTokenId: BN,
  boughtTokenId: BN,
  sellAmount: BN,
) {
  const mangata = await getMangataInstance();
  return await mangata.rpc.calculateSellPriceId(
    soldTokenId.toString(),
    boughtTokenId.toString(),
    sellAmount,
  );
}

export async function getCurrentNonce(account?: string) {
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  const sudo = new User(new Keyring({ type: "sr25519" }), sudoUserName);
  // lets check if sudo -> calculate manually nonce.
  if (account === sudo.keyRingPair.address) {
    return new BN(await SudoDB.getInstance().getSudoNonce(account));
  } else if (account) {
    return getChainNonce(account);
  }
  return new BN(-1);
}

export async function getChainNonce(address: string) {
  const mangata = await getMangataInstance();
  return await mangata.query.getNonce(address);
}

export async function getUserAssets(account: any, assets: BN[]) {
  const user_asset_balances: TokenBalance[] = [];

  for (const asset of assets) {
    const user_asset_balance = await getBalanceOfAssetStr(asset, account);
    user_asset_balances.push(user_asset_balance);
  }
  return user_asset_balances;
}

export async function getBalanceOfAssetStr(assetId: BN, account: string) {
  const mangata = await getMangataInstance();
  return await mangata.query.getTokenBalance(assetId.toString(), account);
}
export async function getBalanceOfAsset(assetId: BN, account: User) {
  const mangata = await getMangataInstance();
  return await mangata.query.getTokenBalance(
    assetId.toString(),
    account.keyRingPair.address,
  );
}

export async function getBalanceOfPool(
  assetId1: BN,
  assetId2: BN,
): Promise<BN[]> {
  const mangata = await getMangataInstance();
  return await mangata.query.getAmountOfTokensInPool(
    assetId1.toString(),
    assetId2.toString(),
  );
}

export async function getLiquidityAssetId(assetId1: BN, assetId2: BN) {
  const api = getApi();

  let liquidity_asset_id = await api.query.xyk.liquidityAssets([
    assetId1,
    assetId2,
  ]);
  if (liquidity_asset_id.isEmpty) {
    liquidity_asset_id = await api.query.xyk.liquidityAssets([
      assetId2,
      assetId1,
    ]);
  }
  if (!liquidity_asset_id.toString()) {
    return new BN(-1);
  }
  return new BN(liquidity_asset_id.toString());
}

export async function getLiquiditybalance(liquidityAssetId: BN) {
  const pool = await getLiquidityPool(liquidityAssetId);
  return await getBalanceOfPool(pool[0], pool[1]);
}

export async function getLiquidityPool(liquidityAssetId: BN) {
  const mangata = await getMangataInstance();

  const liqPool = await mangata.query.getLiquidityPool(
    liquidityAssetId.toString(),
  );
  const poolAssetIds = await liqPool.map((string) => stringToBN(string));
  if (!poolAssetIds) {
    return [new BN(-1), new BN(-1)];
  }

  return poolAssetIds;
}

export async function getAssetSupply(assetId1: BN) {
  const api = getApi();

  const asset_supply = await api.query.tokens.totalIssuance(
    assetId1.toString(),
  );

  return new BN(asset_supply.toString());
}

export async function getNextAssetId() {
  const api = getApi();

  const nextAssetId = await api.query.tokens.nextCurrencyId();
  return new BN(nextAssetId.toString());
}

export async function getAvailableCurrencies(): Promise<AccountData[]> {
  const api = getApi();
  const curerncies = await api.query.tokens.totalIssuance();
  return curerncies as unknown as AccountData[];
}

export async function getSudoKey(): Promise<AccountId32> {
  const api = getApi();

  const sudoKey = await api.query.sudo.key();

  return (sudoKey as any).unwrap();
}

export const balanceTransfer = async (
  account: any,
  target: any,
  amount: number,
) => {
  const api = getApi();

  return await signTx(api, api.tx.balances.transfer(target, amount), account, {
    nonce: await getCurrentNonce(account.address),
  });
};

export const transferAsset = async (
  account: KeyringPair,
  tokenId: BN,
  targetAddress: string,
  amount: BN,
) => {
  const mangata = await getMangataInstance();
  const nonce = await getCurrentNonce(account.address);
  return await mangata.tokens.transferTokens({
    account: account,
    tokenId: tokenId.toString(),
    address: targetAddress,
    amount: amount,
    txOptions: { nonce: nonce },
  });
};

export const transferAll = async (
  account: KeyringPair,
  tokenId: BN,
  target: any,
) => {
  const mangata = await getMangataInstance();
  const nonce = await getCurrentNonce(account.address);
  return await mangata.tokens.transferAllTokens({
    account: account,
    tokenId: tokenId.toString(),
    address: target,
    txOptions: { nonce: nonce },
  });
};

export const mintAsset = async (
  account: any,
  asset_id: BN,
  target: any,
  amount: BN,
  sudoNonce: BN = new BN(-1),
) => {
  console.log("minting asset" + account + sudoNonce);
  const res = await Sudo.batchAsSudoFinalized(
    Assets.mintToken(asset_id, target, amount),
  ).catch((reason) => {
    // eslint-disable-next-line no-console
    console.error("OhOh sth went wrong. " + reason.toString());
    testLog
      .getLog()
      .error(`W[${env.JEST_WORKER_ID}] - ${JSON.stringify(reason).toString()}`);
  });
  return res as MangataGenericEvent[];
};

export const createPool = async (
  account: KeyringPair,
  firstAssetId: BN,
  firstAssetAmount: BN,
  secondAssetId: BN,
  secondAssetAmount: BN,
) => {
  const nonce = await getCurrentNonce(account.address);
  testLog
    .getLog()
    .info(
      `Creating pool:${firstAssetId},${firstAssetAmount},${secondAssetId},${secondAssetAmount}`,
    );
  const api = getApi();

  return await signTx(
    api,
    api.tx.xyk.createPool(
      firstAssetId,
      firstAssetAmount,
      secondAssetId,
      secondAssetAmount,
    ),
    account,
    {
      nonce: nonce,
    },
  );
};

// for alignment purposes lets keep it backward comaptible
// so every pool will have same weight
export const promotePool = async (
  sudoAccount: KeyringPair,
  liqAssetId: BN,
  weight: number = 100,
) => {
  testLog.getLog().info(`Promoting pool :${liqAssetId}`);
  const mangata = await getMangataInstance();
  const api = await mangata.api();
  return await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.proofOfStake.updatePoolPromotion(liqAssetId, weight),
    ),
    sudoAccount,
    { nonce: await getCurrentNonce(sudoAccount.address) },
  );
};

export const sellAsset = async (
  account: KeyringPair,
  soldAssetId: BN,
  boughtAssetId: BN,
  amount: BN,
  minAmountOut: BN,
  options = {},
) => {
  const mangata = await getMangataInstance();
  return await mangata.xyk.multiswapSellAsset({
    account: account,
    tokenIds: [soldAssetId.toString(), boughtAssetId.toString()],
    amount: amount,
    minAmountOut: minAmountOut,
    txOptions: options,
  });
};
export const delegate = async (
  account: KeyringPair,
  liqToken: BN,
  amount: BN,
  from: "AvailableBalance",
) => {
  const mangata = await getMangataInstance();
  const api = await mangata.api();
  const candidates = JSON.parse(
    JSON.stringify(await api?.query.parachainStaking.candidatePool()),
  );
  const collator = candidates.filter(
    (candidate: { liquidityToken: string | null | undefined }) =>
      Number(candidate.liquidityToken!.toString()) === liqToken.toNumber(),
  )[0].owner;

  const delegatorIdx = JSON.parse(
    JSON.stringify(await api?.query.parachainStaking.delegatorState(collator)),
  );
  const delCount = delegatorIdx === null ? 0 : delegatorIdx.length;
  return await signSendAndWaitToFinishTx(
    api?.tx.parachainStaking.delegate(
      collator,
      new BN(amount),
      from,
      new BN(delCount),
      new BN(delCount),
    ),
    account,
  );
};
export const joinCandidate = async (
  account: KeyringPair,
  liqToken: BN,
  amount: BN,
  from: any = "AvailableBalance",
  stricSuccess = true,
) => {
  const mangata = await getMangataInstance();
  const api = await mangata.api();
  const candidates = JSON.parse(
    JSON.stringify(await api?.query.parachainStaking.candidatePool()),
  );
  const liqTokens = await api?.query.parachainStaking.stakingLiquidityTokens();
  const liqTokenCount = Object.keys(JSON.parse(liqTokens as any)).length;

  return await signSendAndWaitToFinishTx(
    api?.tx.parachainStaking.joinCandidates(
      new BN(amount),
      new BN(liqToken),
      from,
      new BN(candidates.length).addn(10),
      new BN(liqTokenCount).addn(10),
    ),
    account,
    stricSuccess,
  );
};
export const activateLiquidity = async (
  account: KeyringPair,
  liqToken: BN,
  amount: BN,
  from: any = "AvailableBalance",
  strictsuccess = false,
) => {
  const mangata = await getMangataInstance();
  const result = await mangata.xyk.activateLiquidity(
    {
      account: account,
      amount: amount,
      liquidityTokenId: liqToken.toString(),
    },
    from,
  );
  if (strictsuccess) {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toBe(ExtrinsicResult.ExtrinsicSuccess);
  }
  return result;
};
export const deactivateLiquidity = async (
  account: KeyringPair,
  liqToken: BN,
  amount: BN,
) => {
  const mangata = await getMangataInstance();

  return await mangata.xyk.deactivateLiquidity({
    account: account,
    amount: amount,
    liquidityTokenId: liqToken.toString(),
  });
};

export const provideLiquidity = async (
  user: KeyringPair,
  liquidityAssetId: BN,
  providedAssetId: BN,
  amount: BN,
) => {
  const mangata = await getMangataInstance();
  const api = await mangata.api();
  return await signTx(
    api,
    api.tx.xyk.provideLiquidityWithConversion(
      liquidityAssetId,
      providedAssetId,
      amount,
    ),
    user,
  );
};

export const reserveVestingLiquidityTokens = async (
  keyRingPair: KeyringPair,
  liqToken: BN,
  amount: BN,
  strictSuccess = true,
) => {
  const mangata = await getMangataInstance();
  const api = await mangata.api();

  return await signSendAndWaitToFinishTx(
    api?.tx.multiPurposeLiquidity.reserveVestingLiquidityTokens(
      new BN(liqToken),
      new BN(amount),
    ),
    keyRingPair,
    strictSuccess,
  );
};
export const buyAsset = async (
  account: any,
  soldAssetId: BN,
  boughtAssetId: BN,
  amount: BN,
  maxAmountIn: BN,
  options = {},
) => {
  const mangata = await getMangataInstance();
  return await mangata.xyk.multiswapBuyAsset({
    account: account,
    tokenIds: [soldAssetId.toString(), boughtAssetId.toString()],
    amount: amount,
    maxAmountIn: maxAmountIn,
    txOptions: options,
  });
};

export const mintLiquidity = async (
  account: KeyringPair,
  firstAssetId: BN,
  secondAssetId: BN,
  firstAssetAmount: BN,
  expectedSecondAssetAmount: BN = new BN(Number.MAX_SAFE_INTEGER),
) => {
  const mangata = await getMangataInstance();
  return await mangata.xyk.mintLiquidity({
    account: account,
    expectedSecondTokenAmount: expectedSecondAssetAmount,
    firstTokenAmount: firstAssetAmount,
    firstTokenId: firstAssetId.toString(),
    secondTokenId: secondAssetId.toString(),
  });
};
export const mintLiquidityUsingVestingNativeTokens = async (
  user: KeyringPair,
  vestingTokensAmount: BN,
  secondAssetId: BN,
  expectedSecondAssetAmount: BN = new BN(Number.MAX_SAFE_INTEGER),
) => {
  const mangata = await getMangataInstance();
  const api = await mangata.api();
  return await signTx(
    api,
    api.tx.xyk.mintLiquidityUsingVestingNativeTokens(
      vestingTokensAmount,
      secondAssetId.toString(),
      expectedSecondAssetAmount,
    ),
    user,
  );
};

export const burnLiquidity = async (
  account: KeyringPair,
  firstAssetId: BN,
  secondAssetId: BN,
  liquidityAssetAmount: BN,
) => {
  const mangata = await getMangataInstance();
  const nonce = await getCurrentNonce(account.address);
  return await mangata.xyk.burnLiquidity({
    account: account,
    firstTokenId: firstAssetId.toString(),
    secondTokenId: secondAssetId.toString(),
    amount: liquidityAssetAmount,
    txOptions: { nonce: nonce },
  });
};

export async function getTokensAccountInfo(account: string, assetId: BN) {
  const api = getApi();
  const data = await api.query.tokens.accounts(account, assetId);
  return JSON.parse(data.toString());
}

export async function getTreasury(tokenId: BN): Promise<BN> {
  const { treasuryPalletAddress } = getEnvironmentRequiredVars();
  const treasuryBalance = await getBalanceOfAssetStr(
    tokenId,
    treasuryPalletAddress,
  );
  return new BN(treasuryBalance.free.toString());
}

export async function getTreasuryBurn(tokenId: BN): Promise<BN> {
  const { treasuryBurnPalletAddress } = getEnvironmentRequiredVars();
  const treasuryBalance = await getBalanceOfAssetStr(
    tokenId,
    treasuryBurnPalletAddress,
  );
  return new BN(treasuryBalance.free.toString());
}

export async function getAssetId(assetName: string): Promise<any> {
  const api = getApi();
  const assetRegistryInfo = await api.query.assetRegistry.metadata.entries();
  const assetFiltered = assetRegistryInfo.filter((el) =>
    JSON.stringify(el[1].toHuman()).includes(assetName),
  )[0];
  if (!Array.isArray(assetFiltered) || !assetFiltered.length) {
    return undefined;
  } else {
    const assetId = JSON.stringify(assetFiltered[0].toHuman());
    return new BN(parseInt(JSON.parse(assetId)[0]));
  }
}

export async function getLock(accountAddress: string, assetId: BN) {
  const api = getApi();
  const locksResponse = await api.query.tokens.locks(accountAddress, assetId)!;
  return JSON.parse(JSON.stringify(locksResponse.toHuman()));
}

export async function getAllAssets(accountAddress: string) {
  const api = getApi();
  const availableAssets = await api.query.tokens.accounts.entries();
  // Example of the returned object:
  // availableAssets[0][0].toHuman() -> ['5ERGFUfA5mhYGvgNQ1bkkeoW5gwEeggdVrrnKUsHuBGNLxL4', '5']
  // first entry is a StorageKey with contains the addres and the assetId, so we filter by it and get the id
  return availableAssets
    .filter(
      (asset) =>
        (((asset as any[])[0] as StorageKey).toHuman() as any[])[0] ===
        accountAddress,
    )
    .map((tuple) => new BN((tuple[0].toHuman() as any[])[1]));
}

export async function lockAsset(user: User, amount: BN) {
  const api = getApi();

  // @ts-ignore
  await signSendAndWaitToFinishTx(
    // @ts-ignore
    api?.tx.staking.bond(
      user.keyRingPair.address,
      amount,
      // @ts-ignore
      "Staked",
      // @ts-ignore
      MGA_DEFAULT_LIQ_TOKEN,
    ),
    user.keyRingPair,
  );
}

export async function getAllAssetsInfo(): Promise<any[]> {
  const api = getApi();
  const availableAssetsInfo = await api.query.assetRegistry.metadata.entries();
  /// returns something like this:
  ///[
  ///    [
  ///      0
  ///    ],
  ///    {
  ///      name: Mangata,
  ///      symbol: MGA,
  ///      description: Mangata Asset,
  ///      decimals: 18
  ///    }
  ///  ],
  /// Humanize the [1]  ( zero is the ID ), stringify and converting to json.

  return availableAssetsInfo.map((asset) =>
    JSON.parse(JSON.stringify(((asset as any[])[1] as StorageKey).toHuman())),
  );
}

export async function calculateTxCost(
  transactionExtrinsic: string,
): Promise<Record<string, AnyJson>> {
  const api = getApi();
  const queryInfoResult = await api.rpc.payment.queryInfo(transactionExtrinsic);
  return queryInfoResult.toHuman();
}
export async function getAllAcountEntries(): Promise<
  [StorageKey<AnyTuple>, Codec][]
> {
  const api = getApi();
  return await api.query.tokens.accounts.entries();
}

export function requireFees() {
  return (
    _target: any,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...params: any[]) => Promise<any>>,
  ) => {
    // eslint-disable-next-line no-console
    // console.log("first(): called");
    const oldFunc = descriptor.value;
    descriptor.value = async function () {
      if (Fees.swapFeesEnabled) {
        const mgas = await getTokensAccountInfo(
          arguments[0].address,
          new BN(0),
        );
        if (mgas.free === 0) {
          await mintMgas(arguments[0]);
        }
      }
      return oldFunc!.apply(this, arguments as any);
    };
  };
}

async function mintMgas(account: KeyringPair) {
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  const keyring = new Keyring({ type: "sr25519" });
  const sudo = new User(keyring, sudoUserName);
  const user = new User(keyring);
  user.addFromAddress(keyring, account.address);
  await user.addMGATokens(sudo);
}
export async function createPoolIfMissing(
  sudo: SudoUser,
  amountInPool: string,
  firstAssetId = MGA_ASSET_ID,
  seccondAssetId = ETH_ASSET_ID,
  promoted = false,
) {
  const balance = await getBalanceOfPool(firstAssetId, seccondAssetId);
  const poolValue = new BN(amountInPool).div(new BN(2));
  if (balance[0].isZero() || balance[1].isZero()) {
    await sudo
      .withFn(
        sudo.node.api!.tx.sudo.sudo(
          sudo.node.api!.tx.tokens.mint(
            firstAssetId,
            sudo.keyRingPair.address,
            new BN(amountInPool),
          ),
        ),
      )
      .withFn(
        sudo.node.api!.tx.sudo.sudo(
          sudo.node.api!.tx.tokens.mint(
            seccondAssetId,
            sudo.keyRingPair.address,
            new BN(amountInPool),
          ),
        ),
      )
      .withFn(
        sudo.node.api!.tx.sudo.sudo(
          sudo.node.api!.tx.tokens.mint(
            MGA_ASSET_ID,
            sudo.keyRingPair.address,
            new BN(Math.pow(10, 20).toString()),
          ),
        ),
      )
      .withFn(
        sudo.node.api!.tx.xyk.createPool(
          firstAssetId,
          poolValue,
          seccondAssetId,
          poolValue,
        ),
      )
      .sudoBatch(sudo);
    const liqToken = await getLiquidityAssetId(firstAssetId, seccondAssetId);
    if (promoted) {
      await sudo.promotePool(liqToken);
    }
  }
}

export async function createAssetIfMissing(sudo: SudoUser, assetName: string) {
  const assetId = await getAssetId(assetName);
  if (assetId === undefined) {
    const nextAssetId = await getNextAssetId();
    const emptyAssetID = new BN(nextAssetId.toString());
    await setAssetInfo(
      sudo,
      emptyAssetID,
      assetName,
      assetName,
      "",
      new BN(12),
    );
    return nextAssetId;
  } else {
    testLog
      .getLog()
      .info(
        `createAssetIfMissing: Asset ${assetName} already exists, skipping...`,
      );
    return assetId;
  }
}

export async function vestingTransfer(
  sudoUser: User,
  tokenID: BN,
  source: User,
  target: User,
  startingBlock: number,
  locked = toBN("1", 20),
  perBlock = new BN(100),
) {
  const api = getApi();
  return await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.vesting.forceVestedTransfer(
        tokenID,
        source.keyRingPair.address,
        target.keyRingPair.address,
        // @ts-ignore
        {
          locked,
          perBlock,
          startingBlock,
        },
      ),
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    },
  );
}

export async function unlockVestedToken(User: User, tokenID: BN) {
  const api = getApi();
  // @ts-ignore
  return await signTx(api, api.tx.vesting.vest(tokenID), User.keyRingPair);
}

export class FeeTxs {
  @requireFees()
  async sellAsset(
    account: KeyringPair,
    soldAssetId: BN,
    boughtAssetId: BN,
    amount: BN,
    minAmountOut: BN,
  ) {
    return sellAsset(account, soldAssetId, boughtAssetId, amount, minAmountOut);
  }

  @requireFees()
  async buyAsset(
    account: KeyringPair,
    soldAssetId: BN,
    boughtAssetId: BN,
    amount: BN,
    maxAmountIn: BN,
  ) {
    return buyAsset(account, soldAssetId, boughtAssetId, amount, maxAmountIn);
  }
}

export async function registerAsset(
  sudoUser: User,
  assetId: BN,
  addressLocation: any,
  locMarker: BN,
  additional: any,
) {
  const api = getApi();
  return await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.assetRegistry.registerAsset(
        {
          decimals: 12,
          name: "TEST_TOKEN-" + locMarker.toString(),
          symbol: "TEST" + locMarker.toString(),
          existentialDeposit: 0,
          location: addressLocation,
          additional,
        },
        //@ts-ignore
        assetId,
      ),
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    },
  );
}

export async function updateAsset(
  sudoUser: User,
  assetId: any,
  location: any,
  additional: any,
) {
  const api = getApi();
  return await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.assetRegistry.updateAsset(
        assetId,
        "12",
        //@ts-ignore
        api!.createType("Vec<u8>", "TESTUPDT-" + assetId.toString()),
        api!.createType("Vec<u8>", "TSTUPD" + assetId.toString()),
        "0",
        location,
        additional,
      ),
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    },
  );
}

export async function compoundRewards(
  User: User,
  liquidityAssetId: BN,
  amountPermille: number = 1000000,
) {
  const api = getApi();
  return await signTx(
    api,
    api.tx.xyk.compoundRewards(liquidityAssetId, amountPermille),
    User.keyRingPair,
  );
}

export async function multiSwapBuy(
  user: User,
  tokenIds: BN[],
  buyAmount: BN,
  maxAmountIn: BN = MAX_BALANCE,
) {
  const account = user.keyRingPair;
  const mangata = await getMangataInstance();
  // noinspection JSMismatchedCollectionQueryUpdate
  const tokenIdsArray: string[] = [];
  let tokenIdsString: string;
  tokenIds.forEach((_, index) => {
    tokenIdsString = tokenIds[index].toString();
    tokenIdsArray.push(tokenIdsString);
  });
  return await mangata.xyk.multiswapBuyAsset({
    account: account,
    amount: buyAmount,
    maxAmountIn: maxAmountIn,
    tokenIds: tokenIdsArray!,
  });
}
export async function multiSwapSell(
  user: User,
  tokenIds: BN[],
  soldAmount: BN,
  minAmountOut: BN = BN_ONE,
) {
  const account = user.keyRingPair;
  const mangata = await getMangataInstance();
  const tokenIdsArray: string[] = [];
  let tokenIdsString: string;
  tokenIds.forEach((_, index) => {
    tokenIdsString = tokenIds[index].toString();
    tokenIdsArray.push(tokenIdsString);
  });
  return await mangata.xyk.multiswapSellAsset({
    account: account,
    amount: soldAmount,
    minAmountOut: minAmountOut,
    tokenIds: tokenIdsArray,
  });
}

export async function updateFeeLockMetadata(
  sudoUser: User,
  periodLength: any,
  timeoutAmount: any,
  swapValueThresholds: any,
  shouldBeWhitelisted: any,
) {
  const api = getApi();
  return await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.feeLock.updateFeeLockMetadata(
        periodLength,
        timeoutAmount,
        swapValueThresholds,
        shouldBeWhitelisted,
      ),
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    },
  );
}

export async function unlockFee(User: User) {
  const api = getApi();
  return await signTx(api, api.tx.feeLock.unlockFee(), User.keyRingPair);
}

export async function getStakingLiquidityTokens(liquidityAssetId: BN) {
  const api = await getApi();
  const stakingLiq = JSON.parse(
    JSON.stringify(await api.query.parachainStaking.stakingLiquidityTokens()),
  ) as any[];
  return stakingLiq[liquidityAssetId.toNumber()];
}
export async function getRewardsInfo(
  address: string,
  liqId: BN,
): Promise<{
  activatedAmount: BN;
  rewardsNotYetClaimed: BN;
  rewardsAlreadyClaimed: BN;
  lastCheckpoint: BN;
  poolRatioAtLastCheckpoint: BN;
  missingAtLastCheckpoint: BN;
}> {
  const api = await getApi();
  const value = await api.query.proofOfStake.rewardsInfo(address, liqId);
  const valueAsJson = JSON.parse(JSON.stringify(value));
  return {
    activatedAmount: stringToBN(valueAsJson.activatedAmount),
    rewardsNotYetClaimed: stringToBN(valueAsJson.rewardsNotYetClaimed),
    rewardsAlreadyClaimed: stringToBN(valueAsJson.rewardsAlreadyClaimed),
    lastCheckpoint: stringToBN(valueAsJson.lastCheckpoint),
    poolRatioAtLastCheckpoint: stringToBN(
      valueAsJson.poolRatioAtLastCheckpoint,
    ),
    missingAtLastCheckpoint: stringToBN(valueAsJson.missingAtLastCheckpoint),
  };
}

export async function claimRewards(user: User, liquidityTokenId: BN) {
  const account = user.keyRingPair;
  const liquidityTokenIdString = liquidityTokenId.toString();
  const mangata = await getMangataInstance();
  return await mangata.xyk.claimRewards({
    account: account,
    liquidityTokenId: liquidityTokenIdString,
  });
}

export async function claimRewardsAll(user: User) {
  const account = user.keyRingPair;
  const mangata = await getMangataInstance();
  return await mangata.xyk.claimRewardsAll({
    account: account,
  });
}

export async function setCrowdloanAllocation(crowdloanAllocationAmount: BN) {
  const api = getApi();
  return await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.setCrowdloanAllocation(crowdloanAllocationAmount),
    ),
  );
}

export async function initializeCrowdloanReward(
  user: User[],
  crowdloanRewardsAmount: BN,
) {
  const api = getApi();
  const rewards: any[] = [];
  user.forEach((account) => {
    rewards.push([
      account.ethAddress.toString(),
      account.ethAddress.toString(),
      crowdloanRewardsAmount,
    ]);
  });
  return await Sudo.batchAsSudoFinalized(
    Sudo.sudo(api.tx.crowdloan.initializeRewardVec([...rewards])),
  );
}

export async function completeCrowdloanInitialization(
  leaseStartBlock: number,
  leaseEndingBlock: number,
) {
  const api = getApi();
  return await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.completeInitialization(
        leaseStartBlock,
        // @ts-ignore
        leaseEndingBlock,
      ),
    ),
  );
}

export async function claimCrowdloanRewards(crowdloanId: any, userId: User) {
  const api = getApi();
  const claimRewards = await signTx(
    api,
    api.tx.crowdloan.claim(crowdloanId),
    userId.keyRingPair,
  );
  return getEventResultFromMangataTx(claimRewards);
}

export async function sudoClaimCrowdloanRewards(
  crowdloanId: any,
  userId: User,
) {
  const api = getApi();
  const claimRewards = await Sudo.batchAsSudoFinalized(
    // @ts-ignore
    Sudo.sudoAs(userId, api.tx.crowdloan.claim(crowdloanId)),
  );
  return getEventResultFromMangataTx(claimRewards);
}

export async function setUserIdentity(user: User, displayname: string) {
  const api = await getApi();
  await signTx(
    api,
    api.tx.identity.setIdentity({
      additional: [],
      display: {
        Raw: displayname,
      },
    }),
    user.keyRingPair,
  );
}
export async function addUserIdentitySub(
  testUser: User,
  userToSub: User,
  newSubName: string,
) {
  const api = await getApi();
  const destAddress = userToSub.keyRingPair.publicKey;

  await signTx(
    api,
    api.tx.identity.setSubs([[destAddress, { Raw: newSubName }]]),
    testUser.keyRingPair,
  );
}
export async function clearUserIdentity(user: User) {
  const api = await getApi();
  await signTx(api, api.tx.identity.clearIdentity(), user.keyRingPair);
}
