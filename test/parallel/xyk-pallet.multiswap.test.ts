/*
 *
 * @group autocompound
 * @group story
 */
import { getApi, initApi } from "../../utils/api";
import { multiSwapBuy } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import {
  getEnvironmentRequiredVars,
  getUserBalanceOfToken,
} from "../../utils/utils";
import { setupUsers, setupApi, Extrinsic } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN_TEN_THOUSAND } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

const successMultiSwapEventName = "AssetsMultiBuySwapped";
describe("Multiswap", () => {
  let users: User[] = [];
  let tokenIds: BN[] = [];

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    ({ users, tokenIds } = await setupPoolsChain(users));
  });

  test("[gasless] Happy path - multi-swap", async () => {
    const testUser1 = users[0];
    const multiSwapOutput = await multiSwapBuy(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_TEN_THOUSAND
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successMultiSwapEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const boughtTokens = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1
    );
    expect(boughtTokens.free).bnEqual(new BN(1000));
  });
});

async function setupPoolsChain(users: User[]) {
  const [testUser1, testUser2, testUser3, testUser4] = await setupUsers();
  users = [testUser1, testUser2, testUser3, testUser4];
  const keyring = new Keyring({ type: "sr25519" });
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const events = await Sudo.batchAsSudoFinalized(
    Assets.issueToken(sudo),
    Assets.issueToken(sudo),
    Assets.issueToken(sudo),
    Assets.issueToken(sudo),
    Assets.issueToken(sudo)
  );
  const tokenIds: BN[] = events
    .filter((item) => item.method === "Issued" && item.section === "tokens")
    .map((x) => new BN(x.eventData[0].data.toString()));

  const poolCreationExtrinsics: Extrinsic[] = [];
  tokenIds.forEach((_, index, tokens) => {
    poolCreationExtrinsics.push(
      Xyk.createPool(
        tokenIds[index],
        Assets.DEFAULT_AMOUNT.divn(2),
        tokenIds[index + (1 % tokens.length)],
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    );
  });
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4),
    Assets.mintToken(tokenIds[0], testUser1),
    Assets.mintToken(tokenIds[0], testUser2),
    Assets.mintToken(tokenIds[0], testUser3),
    Assets.mintToken(tokenIds[0], testUser4),
    ...poolCreationExtrinsics
  );
  return { users, tokenIds };
}
