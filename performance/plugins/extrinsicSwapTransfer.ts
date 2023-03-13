/* eslint-disable no-console */
import { BN } from "@polkadot/util";
import { Mangata } from "@mangata-finance/sdk";
import { TestParams } from "../testParams";
import { KeyringPair } from "@polkadot/keyring/types";
import { runTransactions } from "./testRunner";
import { MAX_BALANCE } from "../../utils/Constants";
import { ExtrinsicSwap } from "./extrinsicSwap";
import { initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { Node } from "../../utils/Framework/Node/Node";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { Keyring } from "@polkadot/api";

let tokens: number[] = [];
export class ExtrinsicSwapTransfer extends ExtrinsicSwap {
  isBuy: boolean;

  constructor(isBuy: boolean) {
    super(isBuy);
    this.isBuy = isBuy;
  }

  tokens: number[] = [];
  async arrange(testParams: TestParams): Promise<boolean> {
    await super.arrange(testParams);
    //create tokens for testing.
    const mgaNode = new Node(testParams.nodes[0]);
    await mgaNode.connect();
    const keyring = new Keyring({ type: "sr25519" });
    const sudo = UserFactory.createUser(Users.SudoUser, keyring, mgaNode);

    await initApi(testParams.nodes[0]);
    this.tokens = await Assets.setupUserWithCurrencies(
      sudo,
      [
        new BN("1000000000000000000000000000"),
        new BN("1000000000000000000000000000"),
      ],
      sudo
    ).then((values) => {
      return values.map((val) => val.toNumber());
    });
    //create the pool
    await this.createPoolIfMissing(
      new BN(this.tokens[0]),
      new BN(this.tokens[1]),
      testParams.nodes
    );
    await this.mintTokensToUsers(testParams.threads, testParams.nodes);
    await this.mintERC20TokensToUsers(this.tokens, this.mgaNodeandUsers);
    console.info(`Setup Done!`);
    tokens = this.tokens;
    return true;
  }
  async act(testParams: TestParams): Promise<boolean> {
    super.act(testParams);
    const generator = (
      sdk: Mangata,
      users: { nonce: BN; keyPair: KeyringPair }[],
      thread: number,
      offset: BN
    ) => {
      return createAndSignSwapsTransfers(
        this.isBuy,
        sdk,
        users,
        thread,
        offset
      );
    };
    await runTransactions(this.mgaNodeandUsers, testParams, generator);
    console.info(`.... Done Sending Txs`);
    return true;
  }
}

async function createAndSignSwapsTransfers(
  isBuy: boolean,
  mgaSdk: Mangata,
  users: { nonce: BN; keyPair: KeyringPair }[],
  threadId: number,
  nonceOffset: BN = new BN(0)
) {
  const srcUser = users[threadId % users.length];
  const api = await mgaSdk.getApi();
  const nonce = srcUser.nonce.add(nonceOffset);

  let assets = [tokens[0], tokens[1]];
  if (srcUser!.nonce.toNumber() % 2 === 0) {
    assets = [tokens[1], tokens[0]];
  }
  let tx;
  if (nonce.ltn(1)) {
    if (isBuy) {
      tx = api!.tx.xyk.buyAsset(assets[0], assets[1], new BN(100), MAX_BALANCE);
    } else {
      tx = api!.tx.xyk.sellAsset(assets[0], assets[1], new BN(100), new BN(3));
    }
  } else {
    const destUser = users[(threadId + 1) % users.length];
    tx = api!.tx.tokens.transfer(
      destUser.keyPair.address,
      assets[0],
      new BN(1)
    );
  }

  await tx.signAsync(
    srcUser!.keyPair,
    //@ts-ignore
    {
      nonce,
    }
  );
  return tx;
}
