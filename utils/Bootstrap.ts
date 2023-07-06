import { getApi } from "./api";
import { ExtrinsicResult } from "./eventListeners";
import { User } from "./User";
import { getEventResultFromMangataTx, sudoIssueAsset } from "./txHandler";
import { getCurrentNonce } from "./tx";
import { getBlockNumber } from "./utils";
import { toBN, signTx } from "@mangata-finance/sdk";
import { Assets } from "./Assets";
import { setupApi } from "./setup";
import { Sudo } from "./sudo";
import { testLog } from "./Logger";
import { waitNewBlock } from "./eventListeners";
import { BN } from "@polkadot/util";

export async function waitForBootstrapStatus(
  bootstrapStatus: string,
  maxNumberBlocks: number
) {
  const lastBlock = (await getBlockNumber()) + maxNumberBlocks;
  let currentBlock = await getBlockNumber();
  const api = await getApi();
  let bootstrapPhase = await api.query.bootstrap.phase();
  testLog.getLog().info("Waiting for bootstrap to be " + bootstrapStatus);
  while (lastBlock > currentBlock && bootstrapPhase.type !== bootstrapStatus) {
    await waitNewBlock();
    bootstrapPhase = await api.query.bootstrap.phase();
    currentBlock = await getBlockNumber();
  }
  testLog.getLog().info("... Done waiting " + bootstrapStatus);
  if (bootstrapPhase.type !== bootstrapStatus) {
    testLog.getLog().warn("TIMEDOUT waiting for the new boostrap phase");
  }
}

export async function checkLastBootstrapFinalized(sudoUser: User) {
  const api = getApi();
  await setupApi();

  let bootstrapPhase: any;

  // check that system is ready to bootstrap
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Finished") {
    const bootstrapFinalize = await finalizeBootstrap(sudoUser);
    const eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  }

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");
}

export async function createNewBootstrapCurrency(sudoUser: User) {
  const creatingBootstrapToken = await sudoIssueAsset(
    sudoUser.keyRingPair,
    toBN("1", 20),
    sudoUser.keyRingPair.address
  );
  const creatingBootstrapTokenResult = await getEventResultFromMangataTx(
    creatingBootstrapToken,
    ["tokens", "Issued", sudoUser.keyRingPair.address]
  );

  const bootstrapCurrencyId = new BN(
    creatingBootstrapTokenResult.data[0].split(",").join("")
  );

  return bootstrapCurrencyId;
}

export async function setupBootstrapTokensBalance(
  bootstrapTokenId: BN,
  sudoUser: User,
  testUser: User[]
) {
  const extrinsicCall = [
    Assets.mintNative(sudoUser),
    Assets.mintToken(bootstrapTokenId, sudoUser),
  ];
  testUser.forEach(async (userId) =>
    extrinsicCall.push(Assets.mintToken(bootstrapTokenId, userId))
  );
  testUser.forEach(async (userId) =>
    extrinsicCall.push(Assets.mintNative(userId))
  );
  await Sudo.batchAsSudoFinalized(...extrinsicCall);
}

export async function getPromotionBootstrapPoolState() {
  const api = getApi();
  const currentPromotingState = await (
    await api.query.bootstrap.promoteBootstrapPool()
  ).toHuman();
  return currentPromotingState;
}

export async function scheduleBootstrap(
  sudoUser: User,
  mainCurrency: BN,
  bootstrapCurrency: BN,
  waitingPeriod: number,
  bootstrapPeriod: number,
  whitelistPeriod = 1,
  provisionBootstrap = false
) {
  const api = getApi();
  const bootstrapBlockNumber = (await getBlockNumber()) + waitingPeriod;
  const result = await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.bootstrap.scheduleBootstrap(
        mainCurrency,
        bootstrapCurrency,
        bootstrapBlockNumber,
        new BN(whitelistPeriod),
        new BN(bootstrapPeriod),
        [100, 1],
        // @ts-ignore
        provisionBootstrap
      )
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    }
  );
  return result;
}

export async function provisionBootstrap(
  user: User,
  bootstrapCurrency: BN,
  bootstrapAmount: BN
) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.bootstrap.provision(bootstrapCurrency, bootstrapAmount),
    user.keyRingPair
  );
  return result;
}

export async function provisionVestedBootstrap(
  user: User,
  bootstrapCurrency: BN,
  bootstrapAmount: BN
) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.bootstrap.provisionVested(bootstrapCurrency, bootstrapAmount),
    user.keyRingPair
  );
  return result;
}

export async function claimRewardsBootstrap(user: User) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.bootstrap.claimLiquidityTokens(),
    user.keyRingPair
  );
  return result;
}

export async function claimAndActivateBootstrap(user: User) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.bootstrap.claimAndActivateLiquidityTokens(),
    user.keyRingPair
  );
  return result;
}

export async function finalizeBootstrap(sudoUser: User) {
  const api = getApi();
  await signTx(
    api,
    api.tx.sudo.sudoAs(
      sudoUser.keyRingPair.address,
      api.tx.bootstrap.preFinalize()
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    }
  );
  const result = await signTx(
    api,
    api.tx.sudo.sudoAs(
      sudoUser.keyRingPair.address,
      api.tx.bootstrap.finalize()
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    }
  );
  return result;
}

export async function cancelRunningBootstrap(sudoUser: User) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.sudo.sudo(api.tx.bootstrap.cancelBootstrap()),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    }
  );
  return result;
}

export async function updatePromoteBootstrapPool(
  sudoUser: User,
  promoteBootstrapPoolFlag: boolean
) {
  const api = getApi();
  const result = await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.bootstrap.updatePromoteBootstrapPool(promoteBootstrapPoolFlag)
    ),
    sudoUser.keyRingPair,
    {
      nonce: await getCurrentNonce(sudoUser.keyRingPair.address),
    }
  );
  return result;
}
