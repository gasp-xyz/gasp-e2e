/*
 * @group rely-mga-acala
 */
import { jest } from "@jest/globals";
import { BN } from "@polkadot/util";
import { GovernanceUser } from "../../utils/Framework/User/GovernanceUser";
import { Keyring } from "@polkadot/api";
import { Node } from "../../utils/Framework/Node/Node";
import { RelyChainNode } from "../../utils/Framework/Node/RelyChainNode";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";
import { User } from "../../utils/User";
import { signSendAndWaitToFinishTx } from "../../utils/txHandler";
import { AcalaNode } from "../../utils/Framework/Node/AcalaNode";
import { hexToBn } from "@polkadot/util";

const { chainUri, relyUri, acalaUri } = getEnvironmentRequiredVars();
let mgaParachainNode: Node;
let acalaParachainNode: Node;
let relayNode: Node;
let keyring: Keyring;

let destUser: GovernanceUser;
let srcUser: GovernanceUser;

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
const amount = new BN("2000000000000");
describe.skip("xToken -> Transfer -> rely to Parachain", () => {
  beforeAll(async () => {
    await cryptoWaitReady(); // Wait for Polkadots WASM backend

    mgaParachainNode = new Node(chainUri);
    relayNode = new RelyChainNode(relyUri);
    acalaParachainNode = new AcalaNode(acalaUri);
    await mgaParachainNode.connect();
    await relayNode.connect();
    await acalaParachainNode.connect();

    keyring = new Keyring({ type: "sr25519" });
  });

  beforeEach(async () => {
    // Initialize actors
    destUser = UserFactory.createUser(
      Users.GovernanceUser,
      keyring,
      mgaParachainNode,
    ) as GovernanceUser;
    keyring.addPair(destUser.keyRingPair);
    // Subscribe to events
    destUser.node.subscribeToUserBalanceChanges(destUser);
  });

  test("Users can send tokens from rely chain to MGA", async () => {
    //send tokens from rely.
    await sendTokensFromRelayToParachain(
      relayNode,
      new User(keyring, "//Alice"),
      destUser,
      amount,
    );
    //wait for balance changes.
    await waitForNBlocks(5);
    const blockNumber = (
      (await destUser.node.api!.query.system.number()) as any
    ).toNumber();
    const balanceUpdated = destUser.node.userBalancesHistory
      .get(blockNumber - 1)!
      .get(4)!;

    expect(balanceUpdated.free).bnLt(amount);
    expect(balanceUpdated.free).bnGt(new BN(0));
  });
  test("Users can send tokens from rely chain to Acala", async () => {
    //send tokens from rely.
    const user = new User(keyring, "//Alice");
    const acalaAccountBefore = await getAcalaBalance(user);
    await sendTokensFromRelayToParachain(relayNode, user, user, amount, 2001);
    //wait for balance changes.
    await waitForNBlocks(5);
    const acalaAccountAfter = await getAcalaBalance(user);
    const amountBeforeAsBN = hexToBn(
      JSON.parse(acalaAccountBefore![0][1].toString()).free,
    );
    const amountAfterAsBN = hexToBn(
      JSON.parse(acalaAccountAfter![0][1].toString()).free,
    );
    expect(amountBeforeAsBN).bnLt(amountAfterAsBN);
  });
  test.skip("[TODO: fix me when https://github.com/paritytech/cumulus/issues/908]: Users can send tokens from MGA to Rely", async () => {
    //Notes from Shoeb:
    //They seem to have blocked off reserve transfers. I think they want it to be used with statemint...
    const amount = new BN(99360000);
    await sendTokensFromParachainToRely(
      mgaParachainNode,
      new User(keyring, "//Alice"),
      new User(keyring, "//Alice"),
      amount,
    );
    //wait for balance changes.
    await waitForNBlocks(5);
    const blockNumber = (
      (await destUser.node.api!.query.system.number()) as any
    ).toNumber();
    const balanceUpdated = destUser.node.userBalancesHistory
      .get(blockNumber - 1)!
      .get(4)!;

    expect(balanceUpdated.free).bnLt(amount);
    expect(balanceUpdated.free).bnGt(new BN(0));
  });
});

describe.skip("xToken -> Transfer -> MGA <-> Acala", () => {
  beforeAll(async () => {
    await cryptoWaitReady(); // Wait for Polkadots WASM backend
    mgaParachainNode = new Node(chainUri);
    acalaParachainNode = new AcalaNode(acalaUri);
    relayNode = new RelyChainNode(relyUri);
    await acalaParachainNode.connect();
    await relayNode.connect();
    await mgaParachainNode.connect();

    keyring = new Keyring({ type: "sr25519" });
  });
  beforeEach(async () => {
    // Initialize actors
    destUser = UserFactory.createUser(
      Users.GovernanceUser,
      keyring,
      mgaParachainNode,
    ) as GovernanceUser;
    srcUser = UserFactory.createUser(
      Users.GovernanceUser,
      keyring,
      acalaParachainNode,
      "//Alice",
    ) as GovernanceUser;

    keyring.addPair(destUser.keyRingPair);
    keyring.addPair(srcUser.keyRingPair);
    // Subscribe to events
    destUser.node.subscribeToUserBalanceChanges(destUser);
  });
  test("Users can send tokens from Acala to MGA", async () => {
    //send tokens from rely to the src user.
    await sendTokensFromRelayToParachain(
      relayNode,
      new User(keyring, "//Alice"),
      srcUser,
      amount,
      2001,
    );
    //wait for balance changes.
    await waitForNBlocks(5);

    destUser.node.subscribeToUserBalanceChanges(destUser);
    await sendTokensFromParachainToMGA(
      acalaParachainNode,
      srcUser,
      destUser,
      amount.div(new BN(2)),
    );
    //wait for balance changes.
    await waitForNBlocks(5);

    const blockNumber = (
      (await destUser.node.api!.query.system.number()) as any
    ).toNumber();
    const balanceUpdated = destUser.node.userBalancesHistory
      .get(blockNumber - 1)!
      .get(4)!;

    expect(balanceUpdated.free).bnLt(amount);
    expect(balanceUpdated.free).bnGt(new BN(0));
  });
  test("Users can send tokens from MGA to Acala", async () => {
    //send tokens from rely to the src user.
    await sendTokensFromRelayToParachain(
      relayNode,
      new User(keyring, "//Alice"),
      srcUser,
      amount,
      2000,
    );
    //wait for balance changes.
    await waitForNBlocks(5);

    await sendTokensFromMGAtoParachain(
      mgaParachainNode,
      srcUser,
      destUser,
      amount.div(new BN(2)),
    );
    //wait for balance changes.
    await waitForNBlocks(5);

    const acalaAccountAfter = await getAcalaBalance(destUser);
    const acalaAccountAfterBN = hexToBn(
      JSON.parse(acalaAccountAfter![0][1].toString()).free,
    );
    expect(new BN(0)).bnLt(acalaAccountAfterBN);
  });
});

async function getAcalaBalance(user: User) {
  return (
    await acalaParachainNode.api?.query.tokens.accounts.entries()
  )?.filter(
    (value) =>
      (value[0].toHuman() as any[])[0].toString() ===
        user.keyRingPair.address &&
      (value[0].toHuman() as any[])[1].Token?.toString() === "DOT",
  );
}

async function sendTokensFromRelayToParachain(
  relyNode: Node,
  srcUser: User,
  dstParachainUser: User,
  amount: BN,
  parachainId = 2000,
) {
  await relyNode.api?.tx.xcmPallet
    .reserveTransferAssets(
      {
        V1: {
          parents: 0,
          interior: {
            X1: {
              Parachain: parachainId,
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
      new BN("0"),
    )
    .signAndSend(srcUser.keyRingPair);
}

async function sendTokensFromParachainToRely(
  parachainNode: Node,
  srcUser: User,
  dstRelyUser: User,
  amount: BN,
) {
  await signSendAndWaitToFinishTx(
    parachainNode.api?.tx.polkadotXcm.reserveTransferAssets(
      {
        V2: {
          parents: 1,
          interior: "Here",
        },
      },
      {
        V2: {
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
        V2: [
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
      new BN("0"),
    ),
    srcUser.keyRingPair,
  );
}

async function sendTokensFromParachainToMGA(
  sourceNode: Node,
  srcUser: User,
  dstRelyUser: User,
  amount: BN,
) {
  await sourceNode.api?.tx.xTokens
    .transfer(
      4,
      amount,
      {
        V2: {
          parents: 1,
          interior: {
            X2: [
              {
                Parachain: 2000,
              },
              {
                AccountId32: {
                  network: "Any",
                  id: dstRelyUser.keyRingPair.publicKey,
                },
              },
            ],
          },
        },
      },
      { Limited: new BN("6000000000") },
    )
    .signAndSend(srcUser.keyRingPair);
}

async function sendTokensFromMGAtoParachain(
  sourceNode: Node,
  srcUser: User,
  dstRelyUser: User,
  amount: BN,
  parachainId = 2001,
) {
  await signSendAndWaitToFinishTx(
    sourceNode.api?.tx.xTokens.transfer(
      new BN(4),
      amount,
      {
        V2: {
          parents: 1,
          interior: {
            X2: [
              {
                Parachain: parachainId,
              },
              {
                AccountId32: {
                  network: "Any",
                  id: dstRelyUser.keyRingPair.publicKey,
                },
              },
            ],
          },
        },
      },
      { Limited: new BN("6000000000") },
    ),
    srcUser.keyRingPair,
  ).then();
}
// const acalaAccountBefore =
//       (await destUser.node.api?.query.tokens.accounts.entries())!.filter(
//         (value) =>
//           (value[0].toHuman() as any[])[0].toString() ===
//             destUser.keyRingPair.address &&
//           (value[0].toHuman() as any[])[1].Token?.toString() === "DOT"
//       );
//
