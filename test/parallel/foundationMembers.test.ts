/*
 *
 * @group governance
 */

import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { User } from "../../utils/User";
import {
  getEventErrorFromSudo,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
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
      FoundationMembers.changeKey(testUser),
    ),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  const foundationMembers = await FoundationMembers.getFoundationMembers();
  expect(foundationMembers).toContain(testUser.keyRingPair.address);
});

test("Council can not execute this extrinsic", async () => {
  const [councilUser] = await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(
      councilUser,
      BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
    ),
    Sudo.sudo(Council.setMembers([councilUser])),
  );
  const events = await Sudo.asSudoFinalized(
    Sudo.sudoAs(councilUser, FoundationMembers.changeKey(testUser)),
  );
  const error = await getEventErrorFromSudo(events);
  expect(error.data).toEqual("NotMember");
});

test("Extrinsic must fail if sudo request any foundation modification", async () => {
  await Sudo.batchAsSudoFinalized(FoundationMembers.changeKey(testUser)).then(
    (events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(res.data).toEqual("NotMember");
    },
  );
});
