import { api } from "./setup";
import BN from "bn.js";
import { Sudo } from "./sudo";

export class FeeLock {
  static updateTokenValueThreshold(firstCurrency: BN, swappingAmount: BN) {
    return api.tx.feeLock.updateTokenValueThreshold([
      [firstCurrency, swappingAmount],
    ]);
  }
  static updateTokenValueThresholdMulti(ids: BN[], swappingAmount: BN) {
    return ids.map((x) =>
      Sudo.sudo(FeeLock.updateTokenValueThreshold(x, swappingAmount)),
    );
  }
}
