import { formatBalance } from "@polkadot/util/format";
import { BN, hexToBn, hexToU8a, isHex } from "@polkadot/util";
import { getApi, getMangataInstance, initApi, mangata } from "./api";
import { Assets } from "./Assets";
import { User } from "./User";
import { getAccountJSON } from "./frontend/utils/Helper";
import { waitNewBlock } from "./eventListeners";
import { logEvent, testLog } from "./Logger";
import { AnyNumber } from "@polkadot/types/types";
import { ApiPromise } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { getStakingLiquidityTokens, sellAsset } from "./tx";
import { Sudo } from "./sudo";
import { setupApi, setupUsers } from "./setup";
import { Xyk } from "./xyk";
import { MGA_ASSET_ID } from "./Constants";
import {
  BN_HUNDRED,
  BN_ONE,
  BN_ZERO,
  MangataGenericEvent,
} from "@mangata-finance/sdk";
import Keyring from "@polkadot/keyring";
import jsonpath from "jsonpath";
import _ from "lodash";

export type Tokens = { free: BN; reserved: BN; frozen: BN };
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
  return fromBNToUnitString(valueBN);
}

export function getMangataApiUrlPort() {
  const { chainUri } = getEnvironmentRequiredVars();
  const port = chainUri.substring(chainUri.lastIndexOf(":") + 1);
  return Number.parseInt(port);
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

  const localAddress = process.env.LOCAL_ADDRESS
    ? process.env.LOCAL_ADDRESS
    : "localhost";

  const stashServiceAddress = process.env.STASH_URL
    ? process.env.STASH_URL
    : "https://mangata-stash-prod-dot-direct-pixel-353917.oa.r.appspot.com";

  const mnemonicMetaMask = process.env.MNEMONIC_META
    ? process.env.MNEMONIC_META
    : " oh oh";

  const mnemonicPolkadot = process.env.MNEMONIC_POLK
    ? process.env.MNEMONIC_POLK
    : "oh oh";

  const mnemonicPolkadotEd25519 = process.env.MNEMONIC_POLK_ED25519
    ? process.env.MNEMONIC_POLK_ED25519
    : "oh oh";

  const mnemonicPolkadotEcdsa = process.env.MNEMONIC_POLK_ECDSA
    ? process.env.MNEMONIC_POLK_ECDSA
    : "oh oh";

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
    localAddress: localAddress,
    stashServiceAddress: stashServiceAddress,
    mnemonicMetaMask: mnemonicMetaMask,
    mnemonicPolkadot: mnemonicPolkadot,
    mnemonicPolkadotEd25519: mnemonicPolkadotEd25519,
    mnemonicPolkadotEcdsa: mnemonicPolkadotEcdsa,
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

export async function UserCreatesAPoolAndMintLiquidity(
  testUser1: User,
  sudo: User,
  userAmount: BN,
  poolAmount: BN = new BN(userAmount).div(new BN(2)),
  mintAmount: BN = new BN(userAmount).div(new BN(4)),
) {
  const [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [userAmount, userAmount],
    sudo,
  );
  await testUser1.addMGATokens(sudo);
  await (
    await getMangataInstance()
  ).xyk.createPool({
    account: testUser1.keyRingPair,
    firstTokenAmount: poolAmount,
    firstTokenId: firstCurrency.toString(),
    secondTokenId: secondCurrency.toString(),
    secondTokenAmount: poolAmount,
  });

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
  secondAssetAmount: BN,
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
  maxWaitingPeriod: number,
) {
  let currentBlock = await getBlockNumber();
  let waitingperiodCounter: number;

  waitingperiodCounter = 0;
  testLog.getLog().info("Waiting block number " + blockNumber);
  while (
    currentBlock < Number(blockNumber) &&
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
    (await api!.consts.parachainStaking.blocksPerRound!).toString(),
  );
  const blockNumber = BigInt(
    await (await api!.query.system.number()).toString(),
  );
  if (
    (blockNumber % sessionDuration) + BigInt(numberOfBlocks) >
    sessionDuration
  ) {
    testLog
      .getLog()
      .info(`Session will end soon, waiting for ${numberOfBlocks}`);
    await waitForNBlocks(numberOfBlocks);
  } else {
    testLog
      .getLog()
      .info(
        `No need to wait ${blockNumber} :: ${
          (blockNumber % sessionDuration) + BigInt(numberOfBlocks)
        }`,
      );
  }
}
export async function getThirdPartyRewards(
  userAddress: string,
  liquidityAssetId: BN,
  rewardToken: BN,
) {
  const api = getApi();
  return await api.rpc.pos.calculate_3rdparty_rewards_amount(
    userAddress,
    liquidityAssetId.toString(),
    rewardToken.toString(),
  );
}
export async function waitNewStakingRound(maxBlocks: number = 0) {
  let currentSessionNumber: number;
  let currentBlockNumber: number;
  const api = getApi();
  const parachainStakingRoundInfo = await api?.query.parachainStaking.round();
  const sessionLength = parachainStakingRoundInfo.length.toNumber();
  currentBlockNumber = await getBlockNumber();
  const initialBlockNumber = currentBlockNumber;
  currentSessionNumber = (await api.query.session.currentIndex()).toNumber();
  const initialSessionNumber = currentSessionNumber;
  const awaitedSessionNumber = initialSessionNumber + 1;
  if (maxBlocks <= 0) {
    maxBlocks = sessionLength + 2;
  }
  const awaitedBlockNumber = initialBlockNumber + maxBlocks;
  while (
    awaitedBlockNumber > currentBlockNumber &&
    currentSessionNumber <= initialSessionNumber
  ) {
    currentBlockNumber = await getBlockNumber();
    currentSessionNumber = (await api.query.session.currentIndex()).toNumber();
    testLog
      .getLog()
      .info(
        "Awaited session number: " +
          awaitedSessionNumber +
          ", current session number: " +
          currentSessionNumber,
      );
    await waitNewBlock();
  }
  if (currentSessionNumber < awaitedSessionNumber) {
    testLog.getLog().warn("Expected session number was not received");
  }
}

export async function waitUntilCollatorProducesBlocks(
  maxBlocks: number = 0,
  userAddress: string,
) {
  let currentBlockNumber = await getBlockNumber();
  const initialBlockNumber = currentBlockNumber;
  const awaitedBlockNumber = initialBlockNumber + maxBlocks;
  let found = false;
  while (awaitedBlockNumber > currentBlockNumber && !found) {
    currentBlockNumber = await getBlockNumber();
    const api = await mangata?.api()!;
    const blockHashSignedByUser =
      await api.rpc.chain.getBlockHash(currentBlockNumber);
    const header = await api.derive.chain.getHeader(blockHashSignedByUser);
    const author = header!.author!.toHuman();

    testLog
      .getLog()
      .info("Waiting for : " + userAddress + ", to produce a block: " + author);
    await waitNewBlock();
    found = author === userAddress;
  }
}
export async function waitUntilUserCollatorRewarded(
  user: User,
  maxBlocks = 100,
  distributeRewardsEvent = "parachainStaking.Rewarded",
) {
  return new Promise(async (resolve, reject) => {
    const method = distributeRewardsEvent;
    const api = await getApi();
    const unsub = await api.rpc.chain.subscribeFinalizedHeads(async (head) => {
      const events = await (await api.at(head.hash)).query.system.events();
      maxBlocks--;
      testLog
        .getLog()
        .info(
          `→ find on ${api.runtimeChain} for '${method}' event, attempt ${maxBlocks}, head ${head.hash}`,
        );
      events.forEach((e) => logEvent(api.runtimeChain, e));

      const filtered = _.filter(
        events,
        ({ event }) => `${event.section}.${event.method}` === method,
      );
      if (filtered.length > 0) {
        const destUser = filtered.filter((e) =>
          JSON.parse(JSON.stringify(e.toHuman())).event.data.includes(
            user.keyRingPair.address,
          ),
        );
        if (destUser.length > 0) {
          resolve(destUser);
          unsub();
        }
      }
      if (maxBlocks < 0) {
        reject(`method ${method} not found within blocks limit`);
      }
    });
  });
}

export async function getTokensDiffForBlockAuthor(blockNumber: AnyNumber) {
  const api = await mangata?.api()!;
  const blockHashSignedByUser = await api.rpc.chain.getBlockHash(blockNumber);
  const header = await api.derive.chain.getHeader(blockHashSignedByUser);
  const author = header!.author!.toHuman();
  const data = await api.query.tokens.accounts.at(
    blockHashSignedByUser,
    author,
    0,
  );
  const freeAfter = hexToBn(JSON.parse(data.toString()).free);
  const blockHashBefore = await api.rpc.chain.getBlockHash(
    Number(blockNumber) - 1,
  );
  const dataBefore = await api.query.tokens.accounts.at(
    blockHashBefore,
    author,
    0,
  );
  const freeBefore = hexToBn(JSON.parse(dataBefore.toString()).free);
  return freeAfter.sub(freeBefore);
}

export async function getUserBalanceOfToken(tokenId: BN, account: User) {
  const api = getApi();
  return await api.query.tokens.accounts(account.keyRingPair.address, tokenId);
}

export async function getBlockNumber(): Promise<number> {
  const blockNumber = stringToBN(await mangata!.query.getBlockNumber());
  return blockNumber.toNumber();
}
export async function getMultiPurposeLiquidityStatus(
  address: string,
  tokenId: BN,
) {
  const api = await mangata?.api()!;
  return (await api.query.multiPurposeLiquidity.reserveStatus(
    address,
    tokenId,
  )) as any;
}
export async function getMultiPurposeLiquidityReLockStatus(
  address: string,
  tokenId: BN,
) {
  const api = await mangata?.api()!;
  return (await api.query.multiPurposeLiquidity.relockStatus(
    address,
    tokenId,
  )) as any;
}
export async function getVestingStatus(address: string, tokenId: BN) {
  const api = await mangata?.api()!;
  return (await api.query.vesting.vesting(address, tokenId)) as any;
}
export async function findBlockWithExtrinsicSigned(
  blocks = [0, 1],
  userAddress: string,
) {
  const api = await mangata?.api()!;
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
      (ext) => ext.isSigned && ext.signer.Id === userAddress,
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
  PoolIsEmpty = "PoolIsEmpty",
}

export enum feeLockErrors {
  FeeLockingFail = "1010: Invalid Transaction: Fee lock processing has failed either due to not enough funds to reserve or an unexpected error",
  FeeUnlockingFail = "1010: Invalid Transaction: Unlock fee has failed either due to no fee locks or fee lock cant be unlocked yet or an unexpected error",
  SwapApprovalFail = "1010: Invalid Transaction: The swap prevalidation has failed",
}

export async function getFeeLockMetadata(api: ApiPromise) {
  const lockMetadata = JSON.parse(
    JSON.stringify(await api?.query.feeLock.feeLockMetadata()),
  );
  const periodLength = stringToBN(lockMetadata.periodLength.toString());
  const feeLockAmount = stringToBN(lockMetadata.feeLockAmount.toString());
  const threshold = lockMetadata.swapValueThreshold;
  return {
    periodLength: periodLength,
    feeLockAmount: feeLockAmount,
    swapValueThreshold: threshold,
  };
}

export function stringToBN(value: string): BN {
  const strValue = value.toString();
  return isHex(value) ? hexToBn(value) : new BN(strValue.replaceAll(",", ""));
}
export async function findErrorMetadata(errorStr: string, index: string) {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  const api = await getApi();
  const errorHex = hexToU8a(errorStr);
  // eslint-disable-next-line no-console
  console.info(" ::" + errorStr + "::" + index + "::");
  const err = api?.registry.findMetaError({
    error: errorHex,
    index: new BN(index),
  });
  // eslint-disable-next-line no-console
  console.info(err);
  return err;
}
export async function printCandidatePowers() {
  await initApi();
  const api = getApi();
  const info = (await api.query.parachainStaking.candidateState.entries())
    .filter((candidateState) => candidateState !== null)
    .map((state) => {
      if (
        state !== null &&
        JSON.parse(JSON.stringify(state[1])).totalCounted !== null
      ) {
        return [
          JSON.parse(JSON.stringify(state[1].toHuman())).id,
          stringToBN(
            JSON.parse(JSON.stringify(state[1].toHuman())).liquidityToken,
          ),
          stringToBN(
            JSON.parse(JSON.stringify(state[1])).totalCounted,
          ).toString(),
        ];
      } else {
        return [];
      }
    });

  for (let index = 0; index < info.length; index++) {
    const stakingInfo = info[index];
    const poolStatus = await getStakingLiquidityTokens(stakingInfo[1]);
    if (poolStatus) {
      const power = stringToBN(stakingInfo[2])
        .mul(stringToBN(poolStatus[0]))
        .div(stringToBN(poolStatus[1]));
      info[index].push(power.toString());
    } else {
      info[index].push(new BN(info[index][2]).divn(2));
    }
  }

  const sorted = info.sort((a, b) =>
    stringToBN(a[3]).sub(stringToBN(b[3])).isNeg() ? 1 : -1,
  );
  sorted.forEach((x, index) =>
    // eslint-disable-next-line no-console
    console.log(
      x[0] +
        " - " +
        x[3] +
        " - " +
        index +
        "< -- > liq" +
        info[index][1].toString() +
        " -- " +
        info[index][2].toString(),
    ),
  );
  //console.log(JSON.stringify(sorted));
}

export async function swapEachNBlocks(period: number) {
  await setupApi();
  await setupUsers();
  const keyring = new Keyring({ type: "sr25519" });
  const testUser4 = new User(keyring, "//Eve");
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const token2 = await Assets.issueAssetToUser(
    sudo,
    Assets.DEFAULT_AMOUNT,
    sudo,
    true,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token2, testUser4, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser4, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser4, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser4),
    Assets.mintNative(testUser4),
    Assets.mintNative(testUser4),
    Assets.mintNative(testUser4),
    Sudo.sudoAs(
      testUser4,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );
  // noinspection InfiniteLoopJS
  while (true) {
    await sellAsset(
      testUser4.keyRingPair,
      token2,
      MGA_ASSET_ID,
      BN_HUNDRED,
      BN_ONE,
    );
    await waitForNBlocks(period);
  }
}
export async function getUserIdentity(user: User) {
  const api = getApi();
  const identity = await api.query.identity.identityOf(
    user.keyRingPair.address,
  );
  return JSON.parse(JSON.stringify(identity.toHuman()));
}
export async function getUserSubIdentity(user: User) {
  const api = getApi();
  const identity = await api.query.identity.superOf(user.keyRingPair.address);
  return JSON.parse(JSON.stringify(identity.toHuman()));
}

export function isBadOriginError(events: MangataGenericEvent[]) {
  // Define the JSONPath expression to search for the key
  const key = "badOrigin";
  testLog
    .getLog()
    .info(`Looking for badOrigin here: ${JSON.stringify(events)}`);
  const matches = jsonpath.query(
    JSON.parse(JSON.stringify(events)),
    `$..${key}`,
  );
  return matches.length > 0;
}
export async function waitForBalanceChange(
  userAddress: string,
  maxBlocks: number,
  assetId: BN = BN_ZERO,
) {
  let blocks = maxBlocks;
  const api = getApi();
  const balanceBefore =
    assetId !== BN_ZERO
      ? await api.query.tokens.accounts.entries(userAddress)
      : await api.query.tokens.accounts(userAddress, assetId);

  return new Promise(async (resolve, reject) => {
    const api = await getApi();
    const unsub = await api.rpc.chain.subscribeFinalizedHeads(async () => {
      if (blocks < 0) {
        unsub();
        reject("Timeout waiting for balance change");
      }
      blocks--;
      const blockNo = await getBlockNumber();
      testLog.getLog().info("["+ blockNo + "] Waiting for balance change - count: " + blocks);
      const balance =
        assetId !== BN_ZERO
          ? await api.query.tokens.accounts.entries(userAddress)
          : await api.query.tokens.accounts(userAddress, assetId);

      const eq = _.isEqual(balance, balanceBefore);
      if (!eq) {
        unsub();
        resolve(true);
      }
    });
  });
}
