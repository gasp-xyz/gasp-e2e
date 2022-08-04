/*
 *
 * @group xyk
 * @group liquidity
 * @group parallel
 */
import { getLiquidityPool } from "../../utils/tx";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Node } from "../../utils/Framework/Node/Node";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let keyring: Keyring;

beforeEach(async () => {
  keyring = new Keyring({ type: "sr25519" });
  const node = new Node(getEnvironmentRequiredVars().chainUri);
  await node.connect();
  // setup users
  testUser1 = new User(keyring);
  const sudo = new SudoUser(keyring, undefined, node);
  const candidates = JSON.parse(
    JSON.stringify(await node.api?.query.parachainStaking.candidatePool())
  );
  const liqToken = candidates[0].liquidityToken;
  const tokens = await getLiquidityPool(liqToken);
  await sudo.mintTokens(tokens.concat([MGA_ASSET_ID]), [testUser1]);
});

test("A User with stacked tokens can activate liquidity", async () => {});
test("A User with activated liquidity can stake some tokens", async () => {});
