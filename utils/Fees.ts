import { Balance } from "@polkadot/types/interfaces";
import { BN } from "@polkadot/util";
import { getEnvironmentRequiredVars } from "./utils";
export class Fees {
  static swapFeesEnabled: boolean = getEnvironmentRequiredVars().fees;
  static getSwapFees(feeValue: Balance): BN {
    if (Fees.swapFeesEnabled) {
      return feeValue;
    } else {
      return new BN(0);
    }
  }
}
