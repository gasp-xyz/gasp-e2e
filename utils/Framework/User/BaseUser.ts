import BN from "bn.js";
import { getAllAcountEntries } from "../../tx";
import { User } from "../../User";
import { hexToBn } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { Node } from "../Node/Node";
export class BaseUser extends User {
  /**
   *
   */
  constructor(keyring: Keyring, name: string, node: Node, json?: any) {
    super(keyring, name, json);
    this._userBalancesHistory = new Map();
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

  private _userBalancesHistory: Map<
    number,
    Map<number, { free: BN; reserved: BN; miscFrozen: BN; feeFrozen: BN }>
  > = new Map();

  public get userBalancesHistory(): Map<
    number,
    Map<number, { free: BN; reserved: BN; miscFrozen: BN; feeFrozen: BN }>
  > {
    return this._userBalancesHistory;
  }
  public set userBalancesHistory(
    value: Map<
      number,
      Map<number, { free: BN; reserved: BN; miscFrozen: BN; feeFrozen: BN }>
    >
  ) {
    this._userBalancesHistory = value;
  }

  async getAllUserTokens() {
    const userAddress = this.keyRingPair.address;
    const allEntries = await getAllAcountEntries();
    // first filter by user address.
    // this can not be done directly, because the key is a [address , tokenId] pair.
    const userEntries = allEntries.filter((value) =>
      (value[0].toHuman() as string[]).includes(userAddress)
    );
    //now, from the filtered list we get all the amounts from the second entry.
    const tokenValues: Map<
      number,
      { free: BN; reserved: BN; miscFrozen: BN; feeFrozen: BN }
    > = new Map();
    // Its an object like [ assetId, {free, reserved,feeFrozen,miscFrozen}]
    userEntries.forEach((value) => {
      tokenValues.set(
        parseInt((value[0].toHuman() as string[])[1].toString()),
        {
          free: hexToBn(JSON.parse(value[1].toString()).free),
          reserved: hexToBn(JSON.parse(value[1].toString()).reserved),
          feeFrozen: hexToBn(JSON.parse(value[1].toString()).feeFrozen),
          miscFrozen: hexToBn(JSON.parse(value[1].toString()).miscFrozen),
        }
      );
    });
    return tokenValues;
  }
}
