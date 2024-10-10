import { ApiPromise } from "@polkadot/api";
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

let api: ApiPromise;
let testUser: User;
let foundationAddress: any;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  api = getApi();
  await setupApi();
});

beforeEach(async () => {
  [testUser] = setupUsers();
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
  foundationAddress = JSON.parse(
    JSON.stringify(await api.query.foundationMembers.members()),
  )[0];
});

test("A founder can update his own foundation address", async () => {
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAddress,
      api.tx.foundationMembers.changeKey(testUser.keyRingPair.address),
    ),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  const foundationMembers = JSON.parse(
    JSON.stringify(await api.query.foundationMembers.members()),
  );
  expect(foundationMembers).toContain(testUser.keyRingPair.address);
});

test("Council can not execute this extrinsic ( but with sudo.sudoAs )", async () => {
  const [councilUser] = await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(
      councilUser,
      BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
    ),
    Sudo.sudo(Council.setMembers([councilUser])),
  );
  const events = await Sudo.asSudoFinalized(
    Sudo.sudoAs(
      councilUser,
      api.tx.foundationMembers.changeKey(testUser.keyRingPair.address),
    ),
  );
  const error = await getEventErrorFromSudo(events);
  expect(error.data).toEqual("NotMember");
});
