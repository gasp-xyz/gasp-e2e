import { BN } from "@polkadot/util";

export class Token {
  private _id: BN;
  private _supply: BN;

  public get id(): BN {
    return this._id;
  }

  public get supply(): BN {
    return this._supply;
  }

  constructor(id: BN, supply: BN) {
    this._id = id;
    this._supply = supply;
  }
}
