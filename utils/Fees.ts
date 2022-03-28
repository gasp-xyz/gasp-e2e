import { Balance } from "@polkadot/types/interfaces";
import { BN } from "@polkadot/util";
export class Fees {
  static swapFeesEnabled: boolean = process.env.FEES_ENABLED
    ? process.env.FEES_ENABLED === "true"
    : true;
  static getSwapFees(feeValue: Balance): BN {
    if (Fees.swapFeesEnabled) {
      return feeValue;
    } else {
      return new BN(0);
    }
  }
}
