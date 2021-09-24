import { formatBalance } from "@polkadot/util/format";
import BN from "bn.js";
import { getApi, getMangataInstance } from "./api";

import { Assets } from "./Assets";
import { User } from "./User";
import Keyring from "@polkadot/keyring";
import { getAccountJSON } from "./frontend/utils/Helper";
import { ETH_ASSET_ID, MGA_ASSET_ID } from "./Constants";
import { getBalanceOfPool } from "./tx";
import { waitNewBlock } from "./eventListeners";

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function fromBNToUnitString(value: BN) {
  const api = getApi();
  const decimals = api?.registry.chainDecimals;
  const valueFormatted = formatBalance(value, { decimals: decimals });
  return valueFormatted;
}

export function getEnvironmentRequiredVars() {
  const palletAddress = process.env.TEST_PALLET_ADDRESS
    ? process.env.TEST_PALLET_ADDRESS
    : "";
  const xykPalletAddress = process.env.E2E_XYK_PALLET_ADDRESS
    ? process.env.E2E_XYK_PALLET_ADDRESS
    : "";
  const treasuryPalletAddress = process.env.E2E_TREASURY_PALLET_ADDRESS
    ? process.env.E2E_TREASURY_PALLET_ADDRESS
    : "";
  const sudoUserName = process.env.TEST_SUDO_NAME
    ? process.env.TEST_SUDO_NAME
    : "";
  const testUserName = process.env.TEST_USER_NAME
    ? process.env.TEST_USER_NAME
    : "//Alice";
  // if (
  //   (palletAddress.length === 0 && xykPalletAddress.length === 0) ||
  //   sudoUserName.length === 0 ||
  //   treasuryPalletAddress.length === 0
  // ) {
  //   throw new Error("PALLET ADDRESS OR SUDO USERNAME NOT FOUND AS GLOBAL ENV");
  // }

  const logLevel = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : "info";
  const uri = process.env.API_URL ? process.env.API_URL : "ws://127.0.0.1:9944";
  const userPassword = process.env.UI_USR_PWD
    ? process.env.UI_USR_PWD
    : "mangata123";
  const uiUri = process.env.UI_URL
    ? process.env.UI_URL
    : "https://staging.mangata.finance/";
  const mnemonicMetaMask = process.env.MNEMONIC_META
    ? process.env.MNEMONIC_META
    : " oh oh";
  const mnemonicPolkadot = process.env.MNEMONIC_POLK
    ? process.env.MNEMONIC_POLK
    : " oh oh";

  const clusterNodeA = process.env.CLUSTER_NODE_A
    ? process.env.CLUSTER_NODE_A
    : "ws://node_alice:9944";
  const clusterNodeB = process.env.CLUSTER_NODE_B
    ? process.env.CLUSTER_NODE_B
    : "ws://node_bob:9944";
  const clusterNodeC = process.env.CLUSTER_NODE_C
    ? process.env.CLUSTER_NODE_C
    : "ws://node_charlie:9944";
  const clusterNodeD = process.env.CLUSTER_NODE_D
    ? process.env.CLUSTER_NODE_D
    : "ws://node_dave:9944";
  const clusterNodeE = process.env.CLUSTER_NODE_E
    ? process.env.CLUSTER_NODE_E
    : "ws://node_eve:9944";
  const clusterNodeF = process.env.CLUSTER_NODE_F
    ? process.env.CLUSTER_NODE_F
    : "ws://node_ferdie:9944";

  return {
    pallet: palletAddress,
    sudo: sudoUserName,
    chainUri: uri,
    alice: testUserName,
    uiUserPassword: userPassword,
    uiUri: uiUri,
    mnemonicMetaMask: mnemonicMetaMask,
    mnemonicPolkadot: mnemonicPolkadot,
    logLevel: logLevel,
    xykPalletAddress: xykPalletAddress,
    treasuryPalletAddress: treasuryPalletAddress,
    clusterNodeA: clusterNodeA,
    clusterNodeB: clusterNodeB,
    clusterNodeC: clusterNodeC,
    clusterNodeD: clusterNodeD,
    clusterNodeE: clusterNodeE,
    clusterNodeF: clusterNodeF,
  };
}

export async function UserCreatesAPoolAndMintliquidity(
  testUser1: User,
  sudo: User,
  userAmount: BN,
  poolAmount: BN = new BN(userAmount).div(new BN(2)),
  mintAmount: BN = new BN(userAmount).div(new BN(4))
) {
  const [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [userAmount, userAmount],
    sudo
  );
  await testUser1.addMGATokens(sudo);
  await (
    await getMangataInstance()
  ).createPool(
    testUser1.keyRingPair,
    firstCurrency.toString(),
    poolAmount,
    secondCurrency.toString(),
    poolAmount
  );

  await testUser1.mintLiquidity(firstCurrency, secondCurrency, mintAmount);
  return [firstCurrency, secondCurrency];
}

export enum XyzErrorCodes {
  VaultAlreadySet,
  PoolAlreadyExists,
  NotEnoughAssets,
  NoSuchPool,
  NoSuchLiquidityAsset,
  NotEnoughReserve,
  ZeroAmount,
  InsufficientInputAmount,
  InsufficientOutputAmount,
  SameAsset,
  AssetAlreadyExists,
  AssetDoesNotExists,
  DivisionByZero,
  UnexpectedFailure,
  NotMangataLiquidityAsset,
  SecondAssetAmountExceededExpectations,
  MathOverflow,
}
export enum TokensErrorCodes {
  /// The balance is too low
  BalanceTooLow,
  /// This operation will cause balance to overflow
  BalanceOverflow,
  /// This operation will cause total issuance to overflow
  TotalIssuanceOverflow,
  /// Cannot convert Amount into Balance type
  AmountIntoBalanceFailed,
  /// Failed because liquidity restrictions due to locking
  LiquidityRestrictions,
  /// Failed because token with given id does not exits
  TokenIdNotExists,
}
//Leaving this function that may be neccesary in the future.
export async function createUserFromJson(keyring: Keyring) {
  const userPassword = "mangata123";
  const json = await getAccountJSON();
  const testUser = new User(keyring, undefined, json);
  keyring.addPair(testUser.keyRingPair);
  keyring.pairs[0].decodePkcs8(userPassword);
  return testUser;
}

export function calculateLiqAssetAmount(
  firstAssetAmount: BN,
  secondAssetAmount: BN
) {
  return firstAssetAmount.add(secondAssetAmount).div(new BN(2));
}

export function calculateFees(soldAmount: BN) {
  const treasury = soldAmount.mul(new BN(5)).div(new BN(10000));
  const treasuryFee = treasury.add(new BN(1));
  return { treasury: treasuryFee, treasuryBurn: treasuryFee };
}
export function calculateCompleteFees(soldAmount: BN) {
  const { treasury, treasuryBurn } = calculateFees(soldAmount);
  let threePercent = treasury.add(treasuryBurn).mul(new BN(3));
  threePercent = threePercent.add(new BN(1));
  //We remove those two added by treasury_treasury_burn.
  threePercent = threePercent.sub(new BN(2));
  return { completeFee: threePercent };
}

export const repeatOverNBlocks = (n: number) => async (f: () => void) => {
  if (n > 0) {
    await waitNewBlock();
    f();
    await repeatOverNBlocks(n - 1)(f);
  }
};

export const waitForNBlocks = async (n: number) => {
  if (n > 0) {
    await waitNewBlock();
    await waitForNBlocks(n - 1);
  }
};
export async function createPoolIfMissing(
  sudo: User,
  amountInPool: string,
  firstAssetId = MGA_ASSET_ID,
  seccondAssetID = ETH_ASSET_ID
) {
  const balance = await getBalanceOfPool(firstAssetId, seccondAssetID);
  if (balance[0].isZero() || balance[1].isZero()) {
    await sudo.mint(firstAssetId, sudo, new BN(amountInPool));
    await sudo.mint(ETH_ASSET_ID, sudo, new BN(amountInPool));
    const poolValue = new BN(amountInPool).div(new BN(2));
    await sudo.createPoolToAsset(
      poolValue,
      poolValue,
      firstAssetId,
      seccondAssetID
    );
  }
}
