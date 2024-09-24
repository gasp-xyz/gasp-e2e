/*
 *
 */
import { getApi, initApi } from "../../utils/api";
import { Extrinsic, setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Withdraw } from "../../utils/rolldown";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { ApiPromise } from "@polkadot/api";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { Rolldown } from "../../utils/rollDown/Rolldown";

let user: User;
let api: ApiPromise;

beforeEach(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await setupApi();
  api = getApi();
  [user] = setupUsers();
  await Sudo.batchAsSudoFinalized(Assets.mintNative(user));
});

test("Given <32> withdrawals WHEN they run successfully THEN a batch is generated AUTOMATICALLY from that L1, from ranges of (n,n+31)", async () => {
  let number = 0;
  const extrinsicCall: Extrinsic[] = [];
  const gaspToL1Asset = JSON.parse(
    JSON.stringify(await api.query.assetRegistry.idToL1Asset(GASP_ASSET_ID)),
  );
  const nextRequestId = JSON.parse(
    JSON.stringify(await api.query.rolldown.l2OriginRequestId()),
  );
  const batchPeriod = Rolldown.merkleRootBatchPeriod();
  while (++number < 33) {
    const withdrawTx = await Withdraw(
      user,
      10,
      gaspToL1Asset.ethereum,
      "Ethereum",
    );
    extrinsicCall.push(withdrawTx);
  }
  await Sudo.batchAsSudoFinalized(...extrinsicCall);
  const event = await Rolldown.waitForNextBatchCreated("Ethereum", batchPeriod);
  const sequencersList = await SequencerStaking.activeSequencers();
  expect(sequencersList.toHuman().Ethereum).toContain(event.assignee);
  expect(event.source).toEqual("AutomaticSizeReached");
  expect(event.range.from.toNumber()).toEqual(nextRequestId.Ethereum);
  expect(event.range.to.toNumber()).toEqual(nextRequestId.Ethereum + 31);
});
