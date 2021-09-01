import { AddressOrPair, SubmittableExtrinsic } from "@polkadot/api/types";
import { StorageKey } from "@polkadot/types";
import { getApi } from "./api";
import BN from "bn.js";
import { env } from "process";
import { SudoDB } from "./SudoDB";
import { AccountData } from "@polkadot/types/interfaces/balances";
import { signAndWaitTx, signSendAndWaitToFinishTx } from "./txHandler";
import { getEnvironmentRequiredVars, MGA_DEFAULT_LIQ_TOKEN } from "./utils";
import { Keyring } from "@polkadot/api";
import { User } from "./User";
import { testLog } from "./Logger";
import { KeyringPair } from "@polkadot/keyring/types";

export const signTx = async (
  tx: SubmittableExtrinsic<"promise">,
  address: AddressOrPair,
  nonce: BN
) => {
  await tx.signAndSend(address, { nonce }, (result: any) => {
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

export async function get_burn_amount(
  firstAssetId: BN,
  secondAssetId: BN,
  liquidity_asset_amount: BN
) {
  const api = getApi();
  //I could not find a way to get and inject the xyk interface in the api builder.
  const result = await (api.rpc as any).xyk.get_burn_amount(
    firstAssetId,
    secondAssetId,
    liquidity_asset_amount
  );
  return result.toHuman();
}

export async function calculate_sell_price_rpc(
  input_reserve: BN,
  output_reserve: BN,
  sell_amount: BN
) {
  const api = getApi();
  const result = await (api.rpc as any).xyk.calculate_sell_price(
    input_reserve,
    output_reserve,
    sell_amount
  );
  return new BN(result.price.toString());
}

export async function calculate_buy_price_rpc(
  input_reserve: BN,
  output_reserve: BN,
  buy_amount: BN
) {
  const api = getApi();
  //I could not find a way to get and inject the xyk interface in the api builder.
  const result = await (api.rpc as any).xyk.calculate_buy_price(
    input_reserve,
    output_reserve,
    buy_amount
  );
  return new BN(result.price.toString());
}

export async function calculate_buy_price_id_rpc(
  soldTokenId: BN,
  boughtTokenId: BN,
  buy_amount: BN
) {
  const api = getApi();
  const result = await (api.rpc as any).xyk.calculate_buy_price_id(
    soldTokenId,
    boughtTokenId,
    buy_amount
  );
  return new BN(result.price.toString());
}

export async function calculate_sell_price_id_rpc(
  soldTokenId: BN,
  boughtTokenId: BN,
  sell_amount: BN
) {
  const api = getApi();
  const result = await (api.rpc as any).xyk.calculate_sell_price_id(
    soldTokenId,
    boughtTokenId,
    sell_amount
  );
  return new BN(result.price.toString());
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
  const api = getApi();
  const { nonce } = await api.query.system.account(address);

  return new BN(nonce.toString());
}

export async function getUserAssets(account: any, assets: BN[]) {
  const user_asset_balances = [];
  for (const asset of assets) {
    const user_asset_balance = await getBalanceOfAsset(asset, account);
    user_asset_balances.push(user_asset_balance);
  }
  return user_asset_balances;
}

export async function getBalanceOfAsset(assetId: BN, account: any) {
  const api = getApi();

  const balance = await api.query.tokens.accounts(account, assetId);
  const accountData = balance as AccountData;
  return new BN(accountData.free.toBigInt().toString());
}

export async function getBalanceOfPool(assetId1: BN, assetId2: BN) {
  const api = getApi();

  const balance1 = await api.query.xyk.pools([assetId1, assetId2]);
  const balance2 = await api.query.xyk.pools([assetId2, assetId1]);

  return [new BN(balance1.toString()), new BN(balance2.toString())];
}

export async function getLiquidityAssetId(assetId1: BN, assetId2: BN) {
  const api = getApi();

  const liquidity_asset_id = await api.query.xyk.liquidityAssets([
    assetId1,
    assetId2,
  ]);
  if (liquidity_asset_id.isEmpty) {
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

export async function getAvailableCurrencies() {
  const api = getApi();
  const curerncies = await api.query.tokens.totalIssuance();
  return curerncies;
}

export async function getSudoKey() {
  const api = getApi();

  const sudoKey = await api.query.sudo.key();

  return sudoKey;
}

export const balanceTransfer = async (
  account: any,
  target: any,
  amount: number
) => {
  const api = getApi();

  const txResult = await signAndWaitTx(
    api.tx.balances.transfer(target, amount),
    account,
    await (await getCurrentNonce(account.address)).toNumber()
  );
  return txResult;
};

export const sudoIssueAsset = async (
  account: any,
  total_balance: BN,
  target: any
) => {
  const api = getApi();
  const nonce = await SudoDB.getInstance().getSudoNonce(account.address);
  testLog.getLog().info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);

  const txResult = await signAndWaitTx(
    api.tx.sudo.sudo(api.tx.tokens.create(target, total_balance)),
    account,
    nonce
  );
  testLog.getLog().info(txResult);
  return txResult;
};

export const transferAsset = async (
  account: any,
  asset_id: BN,
  targetAddress: string,
  amount: BN
) => {
  const api = getApi();
  const nonce = await (await getCurrentNonce(account.address)).toString();
  const txResult = signAndWaitTx(
    api.tx.tokens.transfer(targetAddress, asset_id, amount),
    account,
    parseInt(nonce)
  );
  return txResult;
};

export const transferAll = async (
  account: KeyringPair,
  asset_id: BN,
  target: any
) => {
  const api = getApi();

  const txResult = await signAndWaitTx(
    api.tx.tokens.transferAll(target, asset_id),
    account,
    await (await getCurrentNonce(account.address)).toNumber()
  );
  return txResult;
};

export const mintAsset = async (
  account: any,
  asset_id: BN,
  target: any,
  amount: BN
) => {
  const api = getApi();
  const nonce = await SudoDB.getInstance().getSudoNonce(account.address);
  testLog.getLog().info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);
  const txResult = await signAndWaitTx(
    api.tx.sudo.sudo(api.tx.tokens.mint(asset_id, target, amount)),
    account,
    nonce
  );
  return txResult;
};

export const createPool = async (
  account: KeyringPair,
  firstAssetId: BN,
  firstAssetAmount: BN,
  secondAssetId: BN,
  secondAssetAmount: BN
) => {
  const api = getApi();
  const nonce = await getCurrentNonce(account.address);
  testLog
    .getLog()
    .info(
      `Creating pool:${firstAssetId},${firstAssetAmount},${secondAssetId},${secondAssetAmount}`
    );
  const txResult = await signAndWaitTx(
    api.tx.xyk.createPool(
      firstAssetId,
      firstAssetAmount,
      secondAssetId,
      secondAssetAmount
    ),
    account,
    nonce.toNumber()
  );
  return txResult;
};

export const sellAsset = async (
  account: any,
  soldAssetId: BN,
  boughtAssetId: BN,
  amount: BN,
  minAmountOut: BN
) => {
  const api = getApi();
  const nonce = await getCurrentNonce(account.address);
  const txResult = await signAndWaitTx(
    api.tx.xyk.sellAsset(soldAssetId, boughtAssetId, amount, minAmountOut),
    account,
    nonce.toNumber()
  );
  return txResult;
};

export const buyAsset = async (
  account: any,
  soldAssetId: BN,
  boughtAssetId: BN,
  amount: BN,
  maxAmountIn: BN
) => {
  const api = getApi();
  const nonce = await getCurrentNonce(account.address);
  const txResult = await signAndWaitTx(
    api.tx.xyk.buyAsset(soldAssetId, boughtAssetId, amount, maxAmountIn),
    account,
    nonce.toNumber()
  );
  return txResult;
};

export const mintLiquidity = async (
  account: KeyringPair,
  firstAssetId: BN,
  secondAssetId: BN,
  firstAssetAmount: BN,
  expectedSecondAssetAmount: BN = new BN(Number.MAX_SAFE_INTEGER)
) => {
  const api = getApi();
  const nonce = await (await getCurrentNonce(account.address)).toNumber();
  const txResult = await signAndWaitTx(
    api.tx.xyk.mintLiquidity(
      firstAssetId,
      secondAssetId,
      firstAssetAmount,
      expectedSecondAssetAmount
    ),
    account,
    nonce
  );
  return txResult;
};

export const burnLiquidity = async (
  account: KeyringPair,
  firstAssetId: BN,
  secondAssetId: BN,
  liquidityAssetAmount: BN
) => {
  const api = getApi();
  const nonce = await getCurrentNonce(account.address);
  const txResult = await signAndWaitTx(
    api.tx.xyk.burnLiquidity(firstAssetId, secondAssetId, liquidityAssetAmount),
    account,
    nonce.toNumber()
  );
  return txResult;
};

export async function getAccountInfo(account?: string) {
  const api = getApi();
  if (account) {
    const { data } = await api.query.system.account(account);

    return JSON.parse(data.toString());
  }
  return -1;
}

export async function getTreasury(currencyId: BN): Promise<BN> {
  const api = getApi();
  const treasuryBalance = await api.query.xyk.treasury(currencyId);
  const treasuryBalanceBN = new BN(treasuryBalance.toString());
  return treasuryBalanceBN;
}

export async function getTreasuryBurn(currencyId: BN): Promise<BN> {
  const api = getApi();
  const treasuryBalance = await api.query.xyk.treasuryBurn(currencyId);
  const treasuryBalanceBN = new BN(treasuryBalance.toString());
  return treasuryBalanceBN;
}

export async function getAssetId(assetName: string): Promise<any> {
  const api = getApi();
  const assetsInfo = await api.query.assetsInfo.assetsInfo.entries();
  const assetFiltered = assetsInfo.filter((el) =>
    JSON.stringify(el[1].toHuman()).includes(assetName)
  )[0];
  const assetId = JSON.stringify(assetFiltered[0].toHuman());
  return new BN(parseInt(JSON.parse(assetId)[0]));
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

export async function lockAsset(user: User, assetId: BN, amount: BN) {
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
  const availableAssetsInfo = await api.query.assetsInfo.assetsInfo.entries();
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

export async function calculateTxCost(transactionExtrinsic : string){
	const api = getApi();
  const queryInfoResult = await api.rpc.payment.queryInfo(transactionExtrinsic);
  return queryInfoResult.toHuman();
}
