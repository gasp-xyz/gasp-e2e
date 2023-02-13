import { formatBalance } from "@polkadot/util/format";
import { BN } from "@polkadot/util";
import { getApi, getMangataInstance, mangata } from "./api";
import { hexToBn } from "@polkadot/util";
import { Assets } from "./Assets";
import { User } from "./User";
import { getAccountJSON } from "./frontend/utils/Helper";
import { waitNewBlock } from "./eventListeners";
import { testLog } from "./Logger";
import { AnyNumber } from "@polkadot/types/types";
import { Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function fromBNToUnitString(value: BN) {
  const api = getApi();
  const decimals = api?.registry.chainDecimals;
  const valueFormatted = formatBalance(value, { decimals: decimals[0] });
  return valueFormatted.toUpperCase();
}

export function fromStringToUnitString(value: string) {
  const stringWithoutCommas = value.split(",").join("");
  const valueBN = new BN(stringWithoutCommas);
  const unitString = fromBNToUnitString(valueBN);
  return unitString;
}

export function getEnvironmentRequiredVars() {
  const xykPalletAddress = process.env.E2E_XYK_PALLET_ADDRESS
    ? process.env.E2E_XYK_PALLET_ADDRESS
    : "";
  const treasuryPalletAddress = process.env.E2E_TREASURY_PALLET_ADDRESS
    ? process.env.E2E_TREASURY_PALLET_ADDRESS
    : "";
  const treasuryBurnPalletAddress = process.env.E2E_TREASURY_BURN_PALLET_ADDRESS
    ? process.env.E2E_TREASURY_BURN_PALLET_ADDRESS
    : "";
  const sudoUserName = process.env.TEST_SUDO_NAME
    ? process.env.TEST_SUDO_NAME
    : "//Alice";
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

  const uri = process.env.API_URL ? process.env.API_URL : "ws://127.0.0.1:9946";
  const relyUri = process.env.RELY_API_URL
    ? process.env.RELY_API_URL
    : "ws://127.0.0.1:9944";
  const acalaUri = process.env.ACALA_API_URL
    ? process.env.ACALA_API_URL
    : "ws://127.0.0.1:7654";

  const userPassword = process.env.UI_USR_PWD
    ? process.env.UI_USR_PWD
    : "mangata123";

  const uiUri = process.env.UI_URL
    ? process.env.UI_URL
    : "https://develop.mangata.finance/";

  const mnemonicMetaMask = process.env.MNEMONIC_META
    ? process.env.MNEMONIC_META
    : " oh oh";

  const mnemonicPolkadot = process.env.MNEMONIC_POLK
    ? process.env.MNEMONIC_POLK
    : " oh oh";

  const ethereumHTTPUrl = process.env.ETH_HTTP_URL
    ? process.env.ETH_HTTP_URL
    : "https://kovan.infura.io/v3/3592e9c20d9b4169a394a608a310c85f";

  const ethAppAddress = process.env.ETH_APP_ADDRESS
    ? process.env.ETH_APP_ADDRESS
    : " oh oh";

  const erc20AppAddress = process.env.ETH_20_APP_ADDRESS
    ? process.env.ETH_20_APP_ADDRESS
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
  const fees = process.env.FEES_ENABLED
    ? process.env.FEES_ENABLED === "true"
    : true;

  const oakUri = process.env.OAK_URL
    ? process.env.OAK_URL
    : "ws://127.0.0.1:9949";

  return {
    sudo: sudoUserName,
    chainUri: uri,
    relyUri: relyUri,
    acalaUri: acalaUri,
    alice: testUserName,
    uiUserPassword: userPassword,
    uiUri: uiUri,
    mnemonicMetaMask: mnemonicMetaMask,
    mnemonicPolkadot: mnemonicPolkadot,
    logLevel: logLevel,
    xykPalletAddress: xykPalletAddress,
    treasuryPalletAddress: treasuryPalletAddress,
    treasuryBurnPalletAddress: treasuryBurnPalletAddress,
    ethereumHttpUrl: ethereumHTTPUrl,
    ethAppAddress: ethAppAddress,
    erc20AppAddress: erc20AppAddress,
    clusterNodeA: clusterNodeA,
    clusterNodeB: clusterNodeB,
    clusterNodeC: clusterNodeC,
    clusterNodeD: clusterNodeD,
    clusterNodeE: clusterNodeE,
    clusterNodeF: clusterNodeF,
    fees: fees,
    oakUri: oakUri,
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

export async function calculateMGAFees(tx: any, account: KeyringPair) {
  const result = await tx.paymentInfo(account);
  return new BN(result.partialFee);
}

export function calculateCompleteFees(soldAmount: BN) {
  const { treasury, treasuryBurn } = calculateFees(soldAmount);
  let threePercent = treasury.add(treasuryBurn).mul(new BN(3));
  threePercent = threePercent.add(new BN(1));
  //We remove those two added by treasury_treasury_burn.
  threePercent = threePercent.sub(new BN(2));
  return { completeFee: threePercent };
}

export const waitForNBlocks = async (n: number) => {
  if (n > 0) {
    await waitNewBlock();
    await waitForNBlocks(n - 1);
  }
};

export async function waitBlockNumber(
  blockNumber: string,
  maxWaitingPeriod: number
) {
  let currentBlock = await getBlockNumber();
  let waitingperiodCounter: number;

  waitingperiodCounter = 0;
  testLog.getLog().info("Waiting block number " + blockNumber);
  while (
    currentBlock < blockNumber &&
    waitingperiodCounter < maxWaitingPeriod
  ) {
    await waitNewBlock();
    currentBlock = await getBlockNumber();
    waitingperiodCounter = waitingperiodCounter + 1;
  }
  testLog.getLog().info("... Done waiting block number" + blockNumber);
  if (
    waitingperiodCounter === maxWaitingPeriod ||
    waitingperiodCounter > maxWaitingPeriod
  ) {
    testLog.getLog().warn("TIMEDOUT waiting for the specific block number");
  }
}

export async function waitIfSessionWillChangeInNblocks(numberOfBlocks: number) {
  const api = await getApi();
  const sessionDuration = BigInt(
    (await api!.consts.parachainStaking.blocksPerRound!).toString()
  );
  const blockNumber = BigInt(
    await (await api!.query.system.number()).toString()
  );
  if (
    (blockNumber % sessionDuration) + BigInt(numberOfBlocks) >
    sessionDuration
  ) {
    testLog
      .getLog()
      .info(`Session will end soon, waiting for ${numberOfBlocks}`);
    await waitForNBlocks(numberOfBlocks);
  }
}
export async function getTokensDiffForBlockAuthor(blockNumber: AnyNumber) {
  const api = await mangata?.getApi()!;
  const blockHashSignedByUser = await api.rpc.chain.getBlockHash(blockNumber);
  const header = await api.derive.chain.getHeader(blockHashSignedByUser);
  const author = header!.author!.toHuman();
  const data = await api.query.tokens.accounts.at(
    blockHashSignedByUser,
    author,
    0
  );
  const freeAfter = hexToBn(JSON.parse(data.toString()).free);
  const blockHashBefore = await api.rpc.chain.getBlockHash(
    Number(blockNumber) - 1
  );
  const dataBefore = await api.query.tokens.accounts.at(
    blockHashBefore,
    author,
    0
  );
  const freeBefore = hexToBn(JSON.parse(dataBefore.toString()).free);
  return freeAfter.sub(freeBefore);
}

export async function getUserBalanceOfToken(tokenId: BN, account: User) {
  const api = getApi();
  const tokenBalance = await api.query.tokens.accounts(
    account.keyRingPair.address,
    tokenId
  );
  return tokenBalance;
}

export async function getBlockNumber() {
  const api = await mangata?.getApi()!;
  return ((await api.query.system.number()) as any).toNumber();
}
export async function getMultiPurposeLiquidityStatus(
  address: string,
  tokenId: BN
) {
  const api = await mangata?.getApi()!;
  return (await api.query.multiPurposeLiquidity.reserveStatus(
    address,
    tokenId
  )) as any;
}
export async function findBlockWithExtrinsicSigned(
  blocks = [0, 1],
  userAddress: string
) {
  const api = await mangata?.getApi()!;
  if (blocks.length < 2) {
    throw new Error("two blocks are required.");
  }

  const first = blocks[0];
  const last = blocks[1];
  for (let index = last; index >= first; index--) {
    const blockNumber = index;
    const blockHashSignedByUser = await api.rpc.chain.getBlockHash(blockNumber);
    const block = await api.rpc.chain.getBlock(blockHashSignedByUser);
    const signedByUser = (block.block.extrinsics.toHuman() as any[]).some(
      (ext) => ext.isSigned && ext.signer.Id === userAddress
    );
    if (signedByUser) {
      return blockNumber;
    }
  }
  return 0;
}

export enum xykErrors {
  VaultAlreadySet = "VaultAlreadySet",
  PoolAlreadyExists = "PoolAlreadyExists",
  NotEnoughAssets = "NotEnoughAssets",
  NoSuchPool = "NoSuchPool",
  NoSuchLiquidityAsset = "NoSuchLiquidityAsset",
  NotEnoughReserve = "NotEnoughReserve",
  ZeroAmount = "ZeroAmount",
  InsufficientInputAmount = "InsufficientInputAmount",
  InsufficientOutputAmount = "InsufficientOutputAmount",
  SameAsset = "SameAsset",
  AssetAlreadyExists = "AssetAlreadyExists",
  AssetDoesNotExists = "AssetDoesNotExists",
  DivisionByZero = "DivisionByZero",
  UnexpectedFailure = "UnexpectedFailure",
  NotMangataLiquidityAsset = "NotMangataLiquidityAsset",
  SecondAssetAmountExceededExpectations = "SecondAssetAmountExceededExpectations",
  MathOverflow = "MathOverflow",
  LiquidityTokenCreationFailed = "LiquidityTokenCreationFailed",
  FunctionNotAvailableForThisToken = "FunctionNotAvailableForThisToken",
}

export enum feeLockErrors {
  FeeLockingFail = "1010: Invalid Transaction: Fee lock processing has failed either due to not enough funds to reserve or an unexpected error",
  FeeUnlockingFail = "1010: Invalid Transaction: Unlock fee has failed either due to no fee locks or fee lock cant be unlocked yet or an unexpected error",
  SwapApprovalFail = "1010: Invalid Transaction: The swap prevalidation has failed",
}
