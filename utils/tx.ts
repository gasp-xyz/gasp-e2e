/* eslint-disable no-console */
import {
  BN_ONE,
  MangataGenericEvent,
  signTx,
  toBN,
  TokenBalance,
} from "@mangata-finance/sdk";
import { Keyring } from "@polkadot/api";
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
import { setAssetInfo, signSendAndWaitToFinishTx } from "./txHandler";
import { User } from "./User";
import { getEnvironmentRequiredVars, stringToBN } from "./utils";

export const signTxDeprecated = async (
  tx: SubmittableExtrinsic<"promise">,
  address: AddressOrPair,
  nonce: BN
) => {
  await tx.signAndSend(address, { nonce }, () => {
    // handleTx(result, unsub)
  });
  //   setNonce(nonce + 1)
};

export async function calcuate_mint_liquidity_price_local(
  firstAssetId: BN,
  secondAssetId: BN,
  first_asset_amount: BN
) {
  const liquidity_asset_id = await getLiquidityAssetId(
    firstAssetId,
    secondAssetId
  );
  const total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  const [first_asset_reserve, second_asset_reserve] = await getBalanceOfPool(
    firstAssetId,
    secondAssetId
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
  liquidity_asset_amount: BN
) {
  const liquidity_asset_id = await getLiquidityAssetId(
    firstAssetId,
    secondAssetId
  );
  const total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  const [first_asset_reserve, second_asset_reserve] = await getBalanceOfPool(
    firstAssetId,
    secondAssetId
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
  sell_amount: BN
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
  sell_amount: BN
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
  buy_amount: BN
) {
  const numerator: BN = input_reserve.mul(buy_amount).mul(new BN(1000));
  const denominator: BN = output_reserve.sub(buy_amount).mul(new BN(997));
  const result: BN = numerator.div(denominator).add(new BN(1));
  return new BN(result.toString());
}

export function calculate_buy_price_local_no_fee(
  input_reserve: BN,
  output_reserve: BN,
  buy_amount: BN
) {
  const numerator: BN = input_reserve.mul(buy_amount).mul(new BN(1000));
  const denominator: BN = output_reserve.sub(buy_amount).mul(new BN(1000));
  const result: BN = numerator.div(denominator).add(new BN(1));
  return new BN(result.toString());
}

export async function getBurnAmount(
  firstAssetId: BN,
  secondAssetId: BN,
  liquidityAssetAmount: BN
) {
  const mangata = await getMangataInstance();
  const result = await mangata.getBurnAmount(
    firstAssetId.toString(),
    secondAssetId.toString(),
    liquidityAssetAmount
  );
  testLog.getLog().info(result.firstAssetAmount);
  return result;
}

export async function calculate_sell_price_rpc(
  input_reserve: BN,
  output_reserve: BN,
  sell_amount: BN
): Promise<BN> {
  const mangata = await getMangataInstance();
  const result = await mangata.calculateSellPrice(
    input_reserve,
    output_reserve,
    sell_amount
  );
  return result;
}

export async function calculate_buy_price_rpc(
  inputReserve: BN,
  outputReserve: BN,
  buyAmount: BN
) {
  const mangata = await getMangataInstance();
  const result = await mangata.calculateBuyPrice(
    inputReserve,
    outputReserve,
    buyAmount
  );
  return result;
}

export async function calculate_buy_price_id_rpc(
  soldTokenId: BN,
  boughtTokenId: BN,
  buyAmount: BN
) {
  const mangata = await getMangataInstance();
  const result = await mangata.calculateBuyPriceId(
    soldTokenId.toString(),
    boughtTokenId.toString(),
    buyAmount
  );
  return result;
}

export async function calculate_sell_price_id_rpc(
  soldTokenId: BN,
  boughtTokenId: BN,
  sellAmount: BN
) {
  const mangata = await getMangataInstance();
  const result = await mangata.calculateSellPriceId(
    soldTokenId.toString(),
    boughtTokenId.toString(),
    sellAmount
  );
  return result;
}

export async function getCurrentNonce(account?: string) {
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  const sudo = new User(new Keyring({ type: "sr25519" }), sudoUserName);
  // lets check if sudo -> calculate manually nonce.
  if (account === sudo.keyRingPair.address) {
    const nonce = new BN(await SudoDB.getInstance().getSudoNonce(account));

    return nonce;
  } else if (account) {
    return getChainNonce(account);
  }
  return new BN(-1);
}

export async function getChainNonce(address: string) {
  const mangata = await getMangataInstance();
  const nonce = await mangata.getNonce(address);
  return nonce;
}

export async function getUserAssets(account: any, assets: BN[]) {
  const user_asset_balances: TokenBalance[] = [];

  for (const asset of assets) {
    const user_asset_balance = await getBalanceOfAsset(asset, account);
    user_asset_balances.push(user_asset_balance);
  }
  return user_asset_balances;
}

export async function getBalanceOfAsset(assetId: BN, account: any) {
  const mangata = await getMangataInstance();
  const balance = await mangata.getTokenBalance(assetId.toString(), account);
  return balance;
}

export async function getBalanceOfPool(
  assetId1: BN,
  assetId2: BN
): Promise<BN[]> {
  let reversed = false;
  const emptyPool = "0,0";
  const mangata = await getMangataInstance();
  const balance1 = await mangata.getAmountOfTokenIdInPool(
    assetId1.toString(),
    assetId2.toString()
  );
  const balance2 = await mangata.getAmountOfTokenIdInPool(
    assetId2.toString(),
    assetId1.toString()
  );

  //  const balance1 = await api.query.xyk.pools([assetId1, assetId2]);
  //  const balance2 = await api.query.xyk.pools([assetId2, assetId1]);
  let balanceWithData = balance1;
  if (balance2.toString() !== emptyPool) {
    balanceWithData = balance2;
    reversed = true;
  }
  //  const assetValue1 = JSON.parse(balanceWithData.toString())[0];
  //  const assetValue2 = JSON.parse(balanceWithData.toString())[1];
  //  const a = hexToBn(assetValue1);
  const a = balanceWithData[0];
  //  const b = hexToBn(assetValue2);
  const b = balanceWithData[1];
  if (reversed) {
    return [b, a];
  } else {
    return [a, b];
  }
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
  const poolBalance = await getBalanceOfPool(pool[0], pool[1]);
  return poolBalance;
}

export async function getLiquidityPool(liquidityAssetId: BN) {
  const api = getApi();

  const liqPool = await api.query.xyk.liquidityPools(liquidityAssetId);
  const poolAssetIds = liqPool.toHuman() as Number[];
  if (!poolAssetIds) return [new BN(-1), new BN(-1)];

  const result = poolAssetIds.map((num) => new BN(num.toString()));
  return result;
}

export async function getAssetSupply(assetId1: BN) {
  const api = getApi();

  const asset_supply = await api.query.tokens.totalIssuance(
    assetId1.toString()
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
  amount: number
) => {
  const api = getApi();

  const txResult = await signTx(
    api,
    api.tx.balances.transfer(target, amount),
    account,
    { nonce: await getCurrentNonce(account.address) }
  );
  return txResult;
};

export const transferAsset = async (
  account: KeyringPair,
  tokenId: BN,
  targetAddress: string,
  amount: BN
) => {
  const mangata = await getMangataInstance();
  const nonce = await getCurrentNonce(account.address);
  const result = await mangata.transferToken(
    account,
    tokenId.toString(),
    targetAddress,
    amount,
    { nonce: nonce }
  );
  return result;
};

export const transferAll = async (
  account: KeyringPair,
  tokenId: BN,
  target: any
) => {
  const mangata = await getMangataInstance();
  const nonce = await getCurrentNonce(account.address);
  const result = await mangata.transferTokenAll(
    account,
    tokenId.toString(),
    target,
    { nonce: nonce }
  );
  return result;
};

export const mintAsset = async (
  account: any,
  asset_id: BN,
  target: any,
  amount: BN,
  sudoNonce: BN = new BN(-1)
) => {
  const api = getApi();
  let nonce;
  if (sudoNonce.lte(new BN(-1))) {
    nonce = new BN(await SudoDB.getInstance().getSudoNonce(account.address));
  } else {
    nonce = sudoNonce;
  }

  testLog.getLog().info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);
  const txResult = await signTx(
    api,
    api.tx.sudo.sudo(api.tx.tokens.mint(asset_id, target, amount)),
    account,
    { nonce: new BN(nonce) }
  ).catch((reason) => {
    // eslint-disable-next-line no-console
    console.error("OhOh sth went wrong. " + reason.toString());
    testLog.getLog().error(`W[${env.JEST_WORKER_ID}] - ${reason.toString()}`);
  });
  return txResult as MangataGenericEvent[];
};

export const createPool = async (
  account: KeyringPair,
  firstAssetId: BN,
  firstAssetAmount: BN,
  secondAssetId: BN,
  secondAssetAmount: BN
) => {
  const nonce = await getCurrentNonce(account.address);
  testLog
    .getLog()
    .info(
      `Creating pool:${firstAssetId},${firstAssetAmount},${secondAssetId},${secondAssetAmount}`
    );
  const mangata = await getMangataInstance();
  const result = await mangata.createPool(
    account,
    firstAssetId.toString(),
    firstAssetAmount,
    secondAssetId.toString(),
    secondAssetAmount,
    { nonce: nonce }
  );
  return result;
};

// for alignment purposes lets keep it backward comaptible
// so every pool will have same weight
export const promotePool = async (
  sudoAccount: KeyringPair,
  liqAssetId: BN,
  weight: number = 100
) => {
  testLog.getLog().info(`Promoting pool :${liqAssetId}`);
  const mangata = await getMangataInstance();
  const api = await mangata.getApi();
  const result = await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.proofOfStake.updatePoolPromotion(liqAssetId, weight)
    ),
    sudoAccount,
    { nonce: await getCurrentNonce(sudoAccount.address) }
  );
  return result;
};

export const sellAsset = async (
  account: KeyringPair,
  soldAssetId: BN,
  boughtAssetId: BN,
  amount: BN,
  minAmountOut: BN,
  options = {}
) => {
  const mangata = await getMangataInstance();
  const result = await mangata.sellAsset(
    account,
    soldAssetId.toString(),
    boughtAssetId.toString(),
    amount,
    minAmountOut,
    options
  );
  return result;
};
export const delegate = async (
  account: KeyringPair,
  liqToken: BN,
  amount: BN,
  from: "availablebalance"
) => {
  const mangata = await getMangataInstance();
  const api = await mangata.getApi();
  const candidates = JSON.parse(
    JSON.stringify(await api?.query.parachainStaking.candidatePool())
  );
  const collator = candidates.filter(
    (candidate: { liquidityToken: string | null | undefined }) =>
      Number(candidate.liquidityToken!.toString()) === liqToken.toNumber()
  )[0].owner;

  const delegatorIdx = JSON.parse(
    JSON.stringify(await api?.query.parachainStaking.delegatorState(collator))
  );
  const delCount = delegatorIdx === null ? 0 : delegatorIdx.length;
  const result = await signSendAndWaitToFinishTx(
    api?.tx.parachainStaking.delegate(
      collator,
      new BN(amount),
      from,
      new BN(delCount),
      new BN(delCount)
    ),
    account
  );
  return result;
};
export const joinCandidate = async (
  account: KeyringPair,
  liqToken: BN,
  amount: BN,
  from = "availablebalance",
  stricSuccess = true
) => {
  const mangata = await getMangataInstance();
  const api = await mangata.getApi();
  const candidates = JSON.parse(
    JSON.stringify(await api?.query.parachainStaking.candidatePool())
  );
  const liqTokens = await api?.query.parachainStaking.stakingLiquidityTokens();
  const liqTokenCount = Object.keys(JSON.parse(liqTokens as any)).length;

  const result = await signSendAndWaitToFinishTx(
    api?.tx.parachainStaking.joinCandidates(
      new BN(amount),
      new BN(liqToken),
      from,
      // @ts-ignore - Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
      new BN(candidates.length),
      new BN(liqTokenCount)
    ),
    account,
    stricSuccess
  );
  return result;
};
export const activateLiquidity = async (
  account: KeyringPair,
  liqToken: BN,
  amount: BN,
  from = "availablebalance",
  strictsuccess = false
) => {
  const mangata = await getMangataInstance();
  const api = await mangata.getApi();
  const result = await signSendAndWaitToFinishTx(
    api?.tx.proofOfStake.activateLiquidity(
      new BN(liqToken),
      new BN(amount),
      from
    ),
    account,
    strictsuccess
  );
  return result;
};
export const deactivateLiquidity = async (
  account: KeyringPair,
  liqToken: BN,
  amount: BN
) => {
  const mangata = await getMangataInstance();
  const api = await mangata.getApi();

  const result = await signSendAndWaitToFinishTx(
    api?.tx.proofOfStake.deactivateLiquidity(new BN(liqToken), new BN(amount)),
    account
  );
  return result;
};
export const reserveVestingLiquidityTokens = async (
  keyRingPair: KeyringPair,
  liqToken: BN,
  amount: BN,
  strictSuccess = true
) => {
  const mangata = await getMangataInstance();
  const api = await mangata.getApi();

  const result = await signSendAndWaitToFinishTx(
    api?.tx.multiPurposeLiquidity.reserveVestingLiquidityTokens(
      new BN(liqToken),
      new BN(amount)
    ),
    keyRingPair,
    strictSuccess
  );
  return result;
};
export const buyAsset = async (
  account: any,
  soldAssetId: BN,
  boughtAssetId: BN,
  amount: BN,
  maxAmountIn: BN,
  options = {}
) => {
  const mangata = await getMangataInstance();
  const result = await mangata.buyAsset(
    account,
    soldAssetId.toString(),
    boughtAssetId.toString(),
    amount,
    maxAmountIn,
    options
  );
  return result;
};

export const mintLiquidity = async (
  account: KeyringPair,
  firstAssetId: BN,
  secondAssetId: BN,
  firstAssetAmount: BN,
  expectedSecondAssetAmount: BN = new BN(Number.MAX_SAFE_INTEGER)
) => {
  const mangata = await getMangataInstance();
  const result = await mangata.mintLiquidity(
    account,
    firstAssetId.toString(),
    secondAssetId.toString(),
    firstAssetAmount,
    expectedSecondAssetAmount
  );
  return result;
};
export const mintLiquidityUsingVestingNativeTokens = async (
  user: KeyringPair,
  vestingTokensAmount: BN,
  secondAssetId: BN,
  expectedSecondAssetAmount: BN = new BN(Number.MAX_SAFE_INTEGER)
) => {
  const mangata = await getMangataInstance();
  const api = await mangata.getApi();
  const result = await signTx(
    api,
    api.tx.xyk.mintLiquidityUsingVestingNativeTokens(
      vestingTokensAmount,
      secondAssetId.toString(),
      expectedSecondAssetAmount
    ),
    user
  );
  return result;
};

export const burnLiquidity = async (
  account: KeyringPair,
  firstAssetId: BN,
  secondAssetId: BN,
  liquidityAssetAmount: BN
) => {
  const mangata = await getMangataInstance();
  const nonce = await getCurrentNonce(account.address);
  const result = await mangata.burnLiquidity(
    account,
    firstAssetId.toString(),
    secondAssetId.toString(),
    liquidityAssetAmount,
    { nonce: nonce }
  );
  return result;
};

export async function getTokensAccountInfo(account: string, assetId: BN) {
  const api = getApi();
  const data = await api.query.tokens.accounts(account, assetId);
  return JSON.parse(data.toString());
}

export async function getTreasury(tokenId: BN): Promise<BN> {
  const { treasuryPalletAddress } = getEnvironmentRequiredVars();
  const treasuryBalance = await getBalanceOfAsset(
    tokenId,
    treasuryPalletAddress
  );
  const treasuryBalanceBN = new BN(treasuryBalance.free.toString());
  return treasuryBalanceBN;
}

export async function getTreasuryBurn(tokenId: BN): Promise<BN> {
  const { treasuryBurnPalletAddress } = getEnvironmentRequiredVars();
  const treasuryBalance = await getBalanceOfAsset(
    tokenId,
    treasuryBurnPalletAddress
  );
  const treasuryBalanceBN = new BN(treasuryBalance.free.toString());
  return treasuryBalanceBN;
}

export async function getAssetId(assetName: string): Promise<any> {
  const api = getApi();
  const assetRegistryInfo = await api.query.assetRegistry.metadata.entries();
  const assetFiltered = assetRegistryInfo.filter((el) =>
    JSON.stringify(el[1].toHuman()).includes(assetName)
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
  const decodedlocks = JSON.parse(JSON.stringify(locksResponse.toHuman()));
  return decodedlocks;
}

export async function getAllAssets(accountAddress: string) {
  const api = getApi();
  const availableAssets = await api.query.tokens.accounts.entries();
  // Example of the returned object:
  // availableAssets[0][0].toHuman() -> ['5ERGFUfA5mhYGvgNQ1bkkeoW5gwEeggdVrrnKUsHuBGNLxL4', '5']
  // first entry is a StorageKey with contains the addres and the assetId, so we filter by it and get the id
  const userOnes = availableAssets
    .filter(
      (asset) =>
        (((asset as any[])[0] as StorageKey).toHuman() as any[])[0] ===
        accountAddress
    )
    .map((tuple) => new BN((tuple[0].toHuman() as any[])[1]));

  return userOnes;
}

export async function lockAsset(user: User, amount: BN) {
  const api = getApi();

  await signSendAndWaitToFinishTx(
    api?.tx.staking.bond(
      user.keyRingPair.address,
      amount,
      "Staked",
      //@ts-ignore: Mangata bond operation has 4 params, somehow is inheriting the bond operation from polkadot :S
      MGA_DEFAULT_LIQ_TOKEN
    ),
    user.keyRingPair
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

  const assetsInfo = availableAssetsInfo.map((asset) =>
    JSON.parse(JSON.stringify(((asset as any[])[1] as StorageKey).toHuman()))
  );

  return assetsInfo;
}

export async function calculateTxCost(
  transactionExtrinsic: string
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
    descriptor: TypedPropertyDescriptor<(...params: any[]) => Promise<any>>
  ) => {
    // eslint-disable-next-line no-console
    // console.log("first(): called");
    const oldFunc = descriptor.value;
    descriptor.value = async function () {
      if (Fees.swapFeesEnabled) {
        const mgas = await getTokensAccountInfo(
          arguments[0].address,
          new BN(0)
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
  promoted = false
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
            new BN(amountInPool)
          )
        )
      )
      .withFn(
        sudo.node.api!.tx.sudo.sudo(
          sudo.node.api!.tx.tokens.mint(
            seccondAssetId,
            sudo.keyRingPair.address,
            new BN(amountInPool)
          )
        )
      )
      .withFn(
        sudo.node.api!.tx.sudo.sudo(
          sudo.node.api!.tx.tokens.mint(
            MGA_ASSET_ID,
            sudo.keyRingPair.address,
            new BN(Math.pow(10, 20).toString())
          )
        )
      )
      .withFn(
        sudo.node.api!.tx.xyk.createPool(
          firstAssetId,
          poolValue,
          seccondAssetId,
          poolValue
        )
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
      new BN(12)
    );
    return nextAssetId;
  } else {
    testLog
      .getLog()
      .info(
        `createAssetIfMissing: Asset ${assetName} already exists, skipping...`
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
  perBlock = new BN(100)
) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.vesting.forceVestedTransfer(
        tokenID,
        source.keyRingPair.address,
        target.keyRingPair.address,
        {
          locked,
          perBlock,
          startingBlock,
        }
      )
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    }
  );
  return result;
}

export async function unlockVestedToken(User: User, tokenID: BN) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.vesting.vest(tokenID),
    User.keyRingPair
  );
  return result;
}

export class FeeTxs {
  @requireFees()
  async sellAsset(
    account: KeyringPair,
    soldAssetId: BN,
    boughtAssetId: BN,
    amount: BN,
    minAmountOut: BN
  ) {
    return sellAsset(account, soldAssetId, boughtAssetId, amount, minAmountOut);
  }

  @requireFees()
  async buyAsset(
    account: KeyringPair,
    soldAssetId: BN,
    boughtAssetId: BN,
    amount: BN,
    maxAmountIn: BN
  ) {
    return buyAsset(account, soldAssetId, boughtAssetId, amount, maxAmountIn);
  }
}

export async function registerAsset(
  sudoUser: User,
  assetId: BN,
  addressLocation: any,
  locMarker: BN,
  additional: any
) {
  const api = getApi();
  const result = await signTx(
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
        assetId
      )
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    }
  );
  return result;
}

export async function updateAsset(
  sudoUser: User,
  assetId: any,
  location: any,
  additional: any
) {
  const api = getApi();
  const result = await signTx(
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
        additional
      )
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    }
  );
  return result;
}

export async function compoundRewards(
  User: User,
  liquidityAssetId: BN,
  amountPermille: number = 1000000
) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.xyk.compoundRewards(liquidityAssetId, amountPermille),
    User.keyRingPair
  );
  return result;
}

export async function multiSwapBuy(
  testUser1: User,
  tokenIds: BN[],
  buyAmount: BN,
  maxAmountIn: BN = MAX_BALANCE
) {
  const api = getApi();
  const numbers = tokenIds.flatMap((x) => x.toNumber());
  const result = await signTx(
    api,
    api.tx.xyk.multiswapBuyAsset(numbers, buyAmount, maxAmountIn),
    testUser1.keyRingPair
  );
  return result;
}
export async function multiSwapSell(
  testUser1: User,
  tokenIds: BN[],
  soldAmount: BN,
  minAmountOut: BN = BN_ONE
) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.xyk.multiswapSellAsset(tokenIds, soldAmount, minAmountOut),
    testUser1.keyRingPair
  );
  return result;
}

export async function updateFeeLockMetadata(
  sudoUser: User,
  periodLength: any,
  timeoutAmount: any,
  swapValueThresholds: any,
  shouldBeWhitelisted: any
) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.feeLock.updateFeeLockMetadata(
        periodLength,
        timeoutAmount,
        swapValueThresholds,
        shouldBeWhitelisted
      )
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    }
  );
  return result;
}

export async function unlockFee(User: User) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.feeLock.unlockFee(),
    User.keyRingPair
  );
  return result;
}

export async function getStakingLiquidityTokens(liquidityAssetId: BN) {
  const api = await getApi();
  const stakingLiq = JSON.parse(
    JSON.stringify(await api.query.parachainStaking.stakingLiquidityTokens())
  ) as any[];
  return stakingLiq[liquidityAssetId.toNumber()];
}
export async function getRewardsInfo(
  address: string,
  liqId: BN
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
  const toReturn = {
    activatedAmount: stringToBN(valueAsJson.activatedAmount),
    rewardsNotYetClaimed: stringToBN(valueAsJson.rewardsNotYetClaimed),
    rewardsAlreadyClaimed: stringToBN(valueAsJson.rewardsAlreadyClaimed),
    lastCheckpoint: stringToBN(valueAsJson.lastCheckpoint),
    poolRatioAtLastCheckpoint: stringToBN(
      valueAsJson.poolRatioAtLastCheckpoint
    ),
    missingAtLastCheckpoint: stringToBN(valueAsJson.missingAtLastCheckpoint),
  };
  return toReturn;
}

export async function claimRewardsAll(user: User, liquidityTokenId: BN) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.proofOfStake.claimRewardsAll(liquidityTokenId),
    user.keyRingPair
  );
  return result;
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
    user.keyRingPair
  );
}
export async function addUserIdentitySub(
  testUser: User,
  userToSub: User,
  newSubName: string
) {
  const api = await getApi();
  const destAddress = userToSub.keyRingPair.publicKey;

  await signTx(
    api,
    api.tx.identity.setSubs([[destAddress, { Raw: newSubName }]]),
    testUser.keyRingPair
  );
}
export async function clearUserIdentity(user: User) {
  const api = await getApi();
  await signTx(api, api.tx.identity.clearIdentity(), user.keyRingPair);
}
