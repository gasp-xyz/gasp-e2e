import { BN } from "@polkadot/util";
import { getAllAcountEntries } from "../../tx";
import { User } from "../../User";
import { hexToBn } from "@polkadot/util";
export class BaseUser extends User {
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
      (value[0].toHuman() as string[]).includes(userAddress)
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
            JSON.parse(userEntries[0][1].toString()).feeFrozen
          ),
          miscFrozen: hexToBn(
            JSON.parse(userEntries[0][1].toString()).miscFrozen
          ),
        }
      );
    });
    return tokenValues;
  }
}
