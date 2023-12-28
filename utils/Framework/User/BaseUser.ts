import { BN } from "@polkadot/util";
import { getAllAcountEntries } from "../../tx";
import { User } from "../../User";
import { hexToBn } from "@polkadot/util";
import { Node } from "../Node/Node";
import Keyring from "@polkadot/keyring";
import { SudoDB } from "../../SudoDB";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { env } from "process";
import { testLog } from "../../Logger";
import { SudoUser } from "./SudoUser";

export class BaseUser extends User {
  node: Node;
  batchedFucntions: any[] = [];

  constructor(keyring: Keyring, json: any, node: Node) {
    super(keyring, json);
    this.node = node;
  }

  protected userTokens: Map<
    BN,
    { free: BN; reserved: BN; miscFrozen: BN; feeFrozen: BN }
  > = new Map();

  public get UserTokens(): Map<
    BN,
    { free: BN; reserved: BN; miscFrozen: BN; feeFrozen: BN }
  > {
    return this.userTokens;
  }

  async getAllUserTokens() {
    const userAddress = this.keyRingPair.address;
    const allEntries = await getAllAcountEntries();
    // first filter by user address.
    // this can not be done directly, because the key is a [address , tokenId] pair.
    const userEntries = allEntries.filter((value) =>
      (value[0].toHuman() as string[]).includes(userAddress),
    );
    //now, from the filtered list we get all the amounts from the second entry.
    const tokenValues: Map<
      number,
      { free: BN; reserved: BN; miscFrozen: BN; feeFrozen: BN }
    > = new Map();

    userEntries.forEach((value) => {
      tokenValues.set(
        parseInt((value[0].toHuman() as string[])[1].toString()),
        {
          free: hexToBn(JSON.parse(userEntries[0][1].toString()).free),
          reserved: hexToBn(JSON.parse(userEntries[0][1].toString()).reserved),
          feeFrozen: hexToBn(
            JSON.parse(userEntries[0][1].toString()).feeFrozen,
          ),
          miscFrozen: hexToBn(
            JSON.parse(userEntries[0][1].toString()).miscFrozen,
          ),
        },
      );
    });
    return tokenValues;
  }
  withTokens(tokenIds: BN[], amount: BN = new BN(Math.pow(10, 20).toString())) {
    tokenIds.forEach((token) => {
      this.batchedFucntions.push(
        this.node?.api!.tx.sudo.sudo(
          this.node?.api!.tx.tokens.mint(
            token,
            this.keyRingPair.address,
            amount,
          ),
        ),
      );
    });
    return this;
  }
  withFn(fn: any) {
    this.batchedFucntions.push(fn);
    return this;
  }
  async sudoBatch(sudo: SudoUser) {
    const nonce = new BN(
      await SudoDB.getInstance().getSudoNonce(sudo.keyRingPair.address),
    );
    const txResult = await signTx(
      sudo.node?.api!,
      sudo.node?.api!.tx.utility.batch(this.batchedFucntions)!,
      sudo.keyRingPair,
      { nonce: new BN(nonce) },
    ).catch((reason) => {
      // eslint-disable-next-line no-console
      console.error("OhOh sth went wrong. " + reason.toString());
      testLog.getLog().error(`W[${env.JEST_WORKER_ID}] - ${reason.toString()}`);
    });
    return txResult as MangataGenericEvent[];
  }
  async batch() {
    const txResult = await signTx(
      this.node?.api!,
      this.node?.api!.tx.utility.batch(this.batchedFucntions)!,
      this.keyRingPair,
    ).catch((reason) => {
      // eslint-disable-next-line no-console
      console.error("OhOh sth went wrong. " + reason.toString());
      testLog.getLog().error(`W[${env.JEST_WORKER_ID}] - ${reason.toString()}`);
    });

    return txResult as MangataGenericEvent[];
  }
}
