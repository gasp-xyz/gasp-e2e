/*
 *
 * @group L1RolldownUpdates
 */

import {
  ChainName,
  SequencerStaking,
} from "../../utils/rollDown/SequencerStaking";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { AssetWallet, User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";

import { expectMGAExtrinsicSuDidSuccess } from "../../utils/eventListeners";
import { BN_ONE, BN_ZERO, signTx } from "gasp-sdk";
import {
  createAnUpdateAndCancelIt,
  L2Update,
  Rolldown,
} from "../../utils/rollDown/Rolldown";
import { BN_TWO } from "@polkadot/util";
import BN from "bn.js";

const chain: ChainName = "Ethereum";
let testUser: User;
let testUser2: User;
let testUser3: User;
let testUser4: User;
beforeAll(async () => {
  await initApi();
  await setupApi();
});

beforeEach(async () => {
  [testUser, testUser2, testUser3, testUser4] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4),
  );
  testUser.addAsset(GASP_ASSET_ID);
  testUser2.addAsset(GASP_ASSET_ID);
  testUser3.addAsset(GASP_ASSET_ID);
  testUser4.addAsset(GASP_ASSET_ID);
  await SequencerStaking.removeAllSequencers();
});

async function setup3sequencers(
  newStakeValue: BN,
  amounts: BN[] = [BN_ONE, BN_ZERO, BN_ONE.neg()],
) {
  const activeSequencersBefore = await SequencerStaking.activeSequencers();

  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      newStakeValue.add(amounts[0]),
      chain,
      true,
    ),
    testUser.keyRingPair,
  );
  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      newStakeValue.add(amounts[1]),
      chain,
      true,
    ),
    testUser2.keyRingPair,
  );
  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      newStakeValue.add(amounts[2]),
      chain,
      true,
    ),
    testUser3.keyRingPair,
  );
  await testUser.refreshAmounts();
  await testUser2.refreshAmounts();
  await testUser3.refreshAmounts();

  const activeSequencersAfter = await SequencerStaking.activeSequencers();
  const readRights1Before = await Rolldown.sequencerRights(
    chain,
    testUser.keyRingPair.address,
  );
  const readRights2Before = await Rolldown.sequencerRights(
    chain,
    testUser2.keyRingPair.address,
  );
  const readRights3Before = await Rolldown.sequencerRights(
    chain,
    testUser3.keyRingPair.address,
  );
  expect(readRights1Before).toEqual(readRights2Before);
  expect(readRights1Before).toEqual(readRights3Before);
  expect(readRights1Before.readRights.toString()).toEqual("1");
  expect(readRights1Before.cancelRights.toString()).toEqual("2");
  expect(activeSequencersBefore.toHuman().Ethereum).toHaveLength(0);
  expect(activeSequencersAfter.toHuman().Ethereum).toHaveLength(3);
}

it("Given a set of sequencers, WHEN min increased, then those below will be kicked", async () => {
  //SETUP: setup 3 sequencers
  const newStakeValue = (await SequencerStaking.minimalStakeAmount()).addn(
    1000,
  );
  await setup3sequencers(newStakeValue);

  //ACT: increase the minimum
  const events = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      await SequencerStaking.setSequencerConfiguration(
        chain,
        newStakeValue,
        newStakeValue,
      ),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(events);

  //ASSERT: the user is not in the active set
  const activeSequencersAfterMinIncreased =
    await SequencerStaking.activeSequencers();
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toHaveLength(2);
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toContain(
    testUser.keyRingPair.address,
  );
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toContain(
    testUser2.keyRingPair.address,
  );
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).not.toContain(
    testUser3.keyRingPair.address,
  );

  //ASSERT: tokens are still staked
  await testUser3.refreshAmounts(AssetWallet.AFTER);
  expect(testUser3.getWalletDifferences()).toHaveLength(0);

  //ASSET: CheckReadRights
  const readRights1After = await Rolldown.sequencerRights(
    chain,
    testUser.keyRingPair.address,
  );
  const readRights2After = await Rolldown.sequencerRights(
    chain,
    testUser2.keyRingPair.address,
  );
  const readRights3After = await Rolldown.sequencerRights(
    chain,
    testUser3.keyRingPair.address,
  );
  expect(readRights1After).toEqual(readRights2After);
  expect(readRights1After.readRights.toString()).toEqual("1");
  expect(readRights1After.cancelRights.toString()).toEqual("1");
  expect(readRights3After.readRights.toString()).toEqual("0");
  expect(readRights3After.cancelRights.toString()).toEqual("0");
});
it("Given a set of sequencers, WHEN dispute AND min increased, then those below will be kicked", async () => {
  //SETUP: setup 3 sequencers
  const newStakeValue = (await SequencerStaking.minimalStakeAmount()).addn(
    1000,
  );
  await setup3sequencers(newStakeValue, [BN_TWO, BN_TWO, BN_ONE.neg()]);

  //ACT: dispute
  const { reqIdCanceled } = await createAnUpdateAndCancelIt(
    testUser,
    testUser2.keyRingPair.address,
    chain,
  );
  //ACT: increase the minimum
  const events = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      await SequencerStaking.setSequencerConfiguration(
        chain,
        newStakeValue,
        BN_ONE,
      ),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(events);
  //ACT: Submit resolution
  await Rolldown.waitForReadRights(testUser2.keyRingPair.address);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  const cancelResolutionEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser2.keyRingPair.address,
      new L2Update(await getApi())
        .withCancelResolution(txIndex, reqIdCanceled, true)
        .on(chain)
        .buildUnsafe(),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(cancelResolutionEvents);

  //ASSERT: the user is not in the active set
  const activeSequencersAfterMinIncreased =
    await SequencerStaking.activeSequencers();
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toHaveLength(2);
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toContain(
    testUser.keyRingPair.address,
  );
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toContain(
    testUser2.keyRingPair.address,
  );
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).not.toContain(
    testUser3.keyRingPair.address,
  );
  await Rolldown.waitForL2UpdateExecuted(new BN(txIndex));

  //ASSERT: tokens are still staked
  await testUser3.refreshAmounts(AssetWallet.AFTER);
  expect(testUser3.getWalletDifferences()).toHaveLength(0);

  //ASSET: CheckReadRights
  const readRights1After = await Rolldown.sequencerRights(
    chain,
    testUser.keyRingPair.address,
  );
  const readRights2After = await Rolldown.sequencerRights(
    chain,
    testUser2.keyRingPair.address,
  );
  const readRights3After = await Rolldown.sequencerRights(
    chain,
    testUser3.keyRingPair.address,
  );
  //NOW:
  //canceler (TestUser2) must be still in active set since he staked +2, slash = 1.
  //testUser1 must be in active set
  //testUser3 must be kicked because of the stake min amount.

  expect(readRights1After.readRights.toString()).toEqual("1");
  expect(readRights1After.cancelRights.toString()).toEqual("1");
  expect(readRights2After.readRights.toString()).toEqual("1");
  expect(readRights2After.cancelRights.toString()).toEqual("1");
  expect(readRights3After.readRights.toString()).toEqual("0");
  expect(readRights3After.cancelRights.toString()).toEqual("0");
});
it("Given a set of sequencers, WHEN dispute AND min increased + sm1 else joining, then reads and cancels are right", async () => {
  //SETUP: setup 3 sequencers
  const newStakeValue = (await SequencerStaking.minimalStakeAmount()).addn(
    1000,
  );
  await setup3sequencers(newStakeValue, [BN_TWO, BN_TWO, BN_ONE.neg()]);

  //ACT: dispute
  const { reqIdCanceled } = await createAnUpdateAndCancelIt(
    testUser,
    testUser2.keyRingPair.address,
    chain,
  );
  //ACT: increase the minimum
  const events = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      await SequencerStaking.setSequencerConfiguration(
        chain,
        newStakeValue,
        BN_ONE,
      ),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(events);

  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      newStakeValue.add(BN_ONE),
      chain,
      true,
    ),
    testUser4.keyRingPair,
  );

  //ACT: Submit resolution
  await Rolldown.waitForReadRights(testUser2.keyRingPair.address);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  const cancelResolutionEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser2.keyRingPair.address,
      new L2Update(await getApi())
        .withCancelResolution(txIndex, reqIdCanceled, true)
        .on(chain)
        .buildUnsafe(),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(cancelResolutionEvents);

  //ASSERT: the user is not in the active set
  const activeSequencersAfterMinIncreased =
    await SequencerStaking.activeSequencers();
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toHaveLength(3);
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toContain(
    testUser.keyRingPair.address,
  );
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toContain(
    testUser2.keyRingPair.address,
  );
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).toContain(
    testUser4.keyRingPair.address,
  );
  expect(activeSequencersAfterMinIncreased.toHuman().Ethereum).not.toContain(
    testUser3.keyRingPair.address,
  );
  await Rolldown.waitForL2UpdateExecuted(new BN(txIndex));

  //ASSERT: tokens are still staked
  await testUser3.refreshAmounts(AssetWallet.AFTER);
  expect(testUser3.getWalletDifferences()).toHaveLength(0);

  //ASSET: CheckReadRights
  const readRights1After = await Rolldown.sequencerRights(
    chain,
    testUser.keyRingPair.address,
  );
  const readRights2After = await Rolldown.sequencerRights(
    chain,
    testUser2.keyRingPair.address,
  );
  const readRights3After = await Rolldown.sequencerRights(
    chain,
    testUser3.keyRingPair.address,
  );
  const readRights4After = await Rolldown.sequencerRights(
    chain,
    testUser4.keyRingPair.address,
  );
  //NOW:
  //canceler (TestUser2) must be still in active set since he staked +2, slash = 1.
  //testUser1 must be in active set
  //testUser3 must be kicked because of the stake min amount.

  expect(readRights1After.readRights.toString()).toEqual("1");
  expect(readRights1After.cancelRights.toString()).toEqual("2");
  expect(readRights2After.readRights.toString()).toEqual("1");
  expect(readRights2After.cancelRights.toString()).toEqual("2");
  expect(readRights3After.readRights.toString()).toEqual("0");
  expect(readRights3After.cancelRights.toString()).toEqual("0");
  expect(readRights4After.readRights.toString()).toEqual("1");
  expect(readRights4After.cancelRights.toString()).toEqual("2");
});

afterAll(async () => {
  const minStake = (await SequencerStaking.minimalStakeAmount()).addn(1000);
  const events = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      await SequencerStaking.setSequencerConfiguration(
        chain,
        minStake,
        minStake.subn(1000),
      ),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(events);
});
