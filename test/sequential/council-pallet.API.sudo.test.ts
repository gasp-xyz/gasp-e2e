import { jest } from "@jest/globals";
import { BN_HUNDRED, BN_THOUSAND, signTx } from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import { Council } from "../../utils/Council";
import { ApiPromise } from "@polkadot/api";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { FoundationMembers } from "../../utils/FoundationMembers";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { stringToBN } from "../../utils/utils";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let councilUsers: User[];
let sudo: User;
let api: ApiPromise;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await setupApi();

  sudo = getSudoUser();
  api = getApi();
  councilUsers = await setupUsers();

  councilUsers.push(sudo);
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
    Sudo.sudo(
      Council.setMembers([councilUsers[0], councilUsers[1], councilUsers[2]]),
    ),
  );
});

test("Founder can close voting without sudo account", async () => {
  const [testUser, newFounder] = await setupUsers();

  const propEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAs(
      councilUsers[0],
      Council.propose(
        3,
        api.tx.sudoOrigin.sudo(
          api.tx.tokens.mint(
            GASP_ASSET_ID,
            testUser.keyRingPair.address,
            BN_THOUSAND,
          ),
        ),
        44,
      ),
    ),
  );
  const hash = propEvents
    .filter((x) => x.event.method === "Proposed")
    .flatMap((x) => x.eventData[2].data.toString());
  await Council.voteProposal(hash[0], [
    councilUsers[0],
    councilUsers[1],
    councilUsers[2],
  ]);

  const propIndex = JSON.parse(
    JSON.stringify(await api.query.council.voting(hash[0])),
  ).index;

  const foundationMembers = await FoundationMembers.getFoundationMembers();
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationMembers[2],
      api.tx.foundationMembers.changeKey(newFounder.keyRingPair.address),
    ),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(
      newFounder,
      BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
    ),
    Sudo.sudo(api.tx.sudo.removeKey()),
  );

  await signTx(api, Council.close(hash[0], propIndex), newFounder.keyRingPair);

  const tokenAmount = stringToBN(
    (
      await api.query.tokens.accounts(
        testUser.keyRingPair.address,
        GASP_ASSET_ID,
      )
    ).free.toString(),
  );
  expect(tokenAmount).bnEqual(BN_THOUSAND);
});
