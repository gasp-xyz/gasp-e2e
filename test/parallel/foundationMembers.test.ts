/*
 *
 * @group governance
 */

import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { User } from "../../utils/User";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import {
  ExtrinsicResult,
  filterAndStringifyFirstEvent,
} from "../../utils/eventListeners";
import { BN_HUNDRED, BN_THOUSAND } from "gasp-sdk";
import { Council } from "../../utils/Council";
import { FoundationMembers } from "../../utils/FoundationMembers";

let testUser: User;
let foundationAddress: any;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await setupApi();
});

beforeEach(async () => {
  [testUser] = setupUsers();
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
  foundationAddress = (await FoundationMembers.getFoundationMembers())[0];
});

test("A founder can update his own foundation address", async () => {
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAddress,
      FoundationMembers.changeKey(testUser.keyRingPair.address),
    ),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  const foundationMembers = await FoundationMembers.getFoundationMembers();
  expect(foundationMembers).toContain(testUser.keyRingPair.address);
});

test("Council can not execute this extrinsic", async () => {
  const api = getApi();
  const councilUsers = await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(
      councilUsers[0],
      BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
    ),
    Assets.mintNative(
      councilUsers[1],
      BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
    ),
    Assets.mintNative(
      councilUsers[2],
      BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
    ),
    Assets.mintNative(
      councilUsers[3],
      BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
    ),
    Sudo.sudo(Council.setMembers(councilUsers)),
  );
  const propEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAs(
      councilUsers[0],
      Sudo.batch(
        Council.propose(
          councilUsers.length,
          api.tx.sudo.sudoAs(
            foundationAddress,
            FoundationMembers.changeKey(testUser.keyRingPair.address),
          ),
          44,
        ),
      ),
    ),
  );
  const hash = propEvents
    .filter((x) => x.event.method === "Proposed")
    .flatMap((x) => x.eventData[2].data.toString());
  await Council.voteProposal(hash[0], councilUsers);
  const propIndex = JSON.parse(
    JSON.stringify(await Council.getVotes(hash[0])),
  ).index;
  const closingEvent = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAddress,
      api.tx.council.close(
        hash[0],
        propIndex,
        { refTime: "100000000000", proofSize: "1000000" },
        10000,
      ),
    ),
  );
  const filteredEvent = await filterAndStringifyFirstEvent(
    closingEvent,
    "Executed",
  );
  expect(filteredEvent.result.Err).toEqual("BadOrigin");
});

test("Extrinsic must fail if sudo request any foundation modification", async () => {
  await Sudo.batchAsSudoFinalized(
    FoundationMembers.changeKey(testUser.keyRingPair.address),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(res.data).toEqual("NotMember");
  });
});
