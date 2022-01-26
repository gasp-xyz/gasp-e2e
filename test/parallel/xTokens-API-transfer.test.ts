/*
 * @group parallel
 */

import BN from "bn.js";
import { GovernanceUser } from "../../utils/Framework/User/GovernanceUser";
import { Keyring } from "@polkadot/api";
import { Node } from "../../utils/Framework/Node/Node";
import { RelyChainNode } from "../../utils/Framework/Node/RelyChainNode";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";
import { User } from "../../utils/User";
import { signSendAndWaitToFinishTx } from "../../utils/txHandler";

const { chainUri, relyUri } = getEnvironmentRequiredVars();

let parachainNode: Node;
let relayNode: Node;
let keyring: Keyring;

let destUser: GovernanceUser;

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

beforeAll(async () => {
  await cryptoWaitReady(); // Wait for Polkadots WASM backend

  parachainNode = new Node(chainUri);
  relayNode = new RelyChainNode(relyUri);
  await parachainNode.connect();
  await relayNode.connect();

  keyring = new Keyring({ type: "sr25519" });
});

beforeEach(async () => {
  // Initialize actors
  destUser = UserFactory.createUser(
    Users.GovernanceUser,
    keyring,
    parachainNode
  ) as GovernanceUser;
  keyring.addPair(destUser.keyRingPair);
  // Subscribe to events
  destUser.node.subscribeToUserBalanceChanges(destUser);
});

describe("xToken -> Transfer -> MGA <-> rely", () => {
  test("Users can send tokens from rely chain to MGA", async () => {
    //send tokens from rely.
    const amount = new BN(1000000000);
    await sendTokensFromRelayToParachain(
      relayNode,
      new User(keyring, "//Alice"),
      new User(keyring, "//Alice"),
      amount
    );
    //wait for balance changes.
    await waitForNBlocks(5);
    const blockNumber = await (
      await destUser.node.api!.query.system.number()
    ).toNumber();
    const balanceUpdated = destUser.node.userBalancesHistory
      .get(blockNumber - 1)!
      .get(4)!;

    expect(balanceUpdated.free).bnLt(amount);
    expect(balanceUpdated.free).bnGt(new BN(0));
  });
  test.skip("[TODO: fix me when https://github.com/paritytech/cumulus/issues/908]: Users can send tokens from MGA to Rely", async () => {
    //Notes from Shoeb:
    //They seem to have blocked off reserve transfers. I think they want it to be used with statemint...
    const amount = new BN(99360000);
    await sendTokensFromParachainToRely(
      parachainNode,
      new User(keyring, "//Alice"),
      new User(keyring, "//Alice"),
      amount
    );
    //wait for balance changes.
    await waitForNBlocks(5);
    const blockNumber = await (
      await destUser.node.api!.query.system.number()
    ).toNumber();
    const balanceUpdated = destUser.node.userBalancesHistory
      .get(blockNumber - 1)!
      .get(4)!;

    expect(balanceUpdated.free).bnLt(amount);
    expect(balanceUpdated.free).bnGt(new BN(0));
  });
});

async function sendTokensFromRelayToParachain(
  relyNode: Node,
  srcUser: User,
  dstParachainUser: User,
  amount: BN
) {
  await relyNode.api?.tx.xcmPallet
    .reserveTransferAssets(
      {
        V1: {
          parents: 0,
          interior: {
            X1: {
              Parachain: 2000,
            },
          },
        },
      },
      {
        V1: {
          parents: 0,
          interior: {
            X1: {
              AccountId32: {
                network: "Any",
                id: dstParachainUser.keyRingPair.publicKey,
              },
            },
          },
        },
      },
      {
        V1: [
          {
            id: {
              Concrete: {
                parents: 0,
                interior: "Here",
              },
            },
            fun: {
              Fungible: amount,
            },
          },
        ],
      },
      new BN("0")
    )
    .signAndSend(srcUser.keyRingPair);
}

async function sendTokensFromParachainToRely(
  parachainNode: Node,
  srcUser: User,
  dstRelyUser: User,
  amount: BN
) {
  await signSendAndWaitToFinishTx(
    parachainNode.api?.tx.polkadotXcm.reserveTransferAssets(
      {
        V1: {
          parents: 1,
          interior: "Here",
        },
      },
      {
        V1: {
          parents: 1,
          interior: {
            X1: {
              AccountId32: {
                network: "Any",
                id: dstRelyUser.keyRingPair.publicKey,
              },
            },
          },
        },
      },
      {
        V1: [
          {
            id: {
              Concrete: {
                parents: 1,
                interior: "Here",
              },
            },
            fun: {
              Fungible: amount,
            },
          },
        ],
      },
      new BN("0")
    ),
    srcUser.keyRingPair
  );
}
