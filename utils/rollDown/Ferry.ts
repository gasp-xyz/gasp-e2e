/*
 *
 * @group ferry
 */

import { getL1, L1Type } from "../rollup/l1s";
import { setupUsers, sudo } from "../setup";
import { registerL1Asset } from "../tx";
import { Sudo } from "../sudo";
import { Assets } from "../Assets";
import { getAssetIdFromErc20 } from "../rollup/ethUtils";
import { signTx } from "gasp-sdk";
import { getApi } from "../api";
import { User } from "../User";
import { Rolldown } from "./Rolldown";
import { PalletRolldownMessagesDeposit } from "@polkadot/types/lookup";

export class Ferry {
  static async setupFerrier(
    l1: L1Type,
    tokenAddress = getL1(l1)?.contracts.dummyErc20.address,
  ) {
    const [ferrier] = setupUsers();
    let id = await getAssetIdFromErc20(tokenAddress, l1);
    if (id.isZero()) {
      await registerL1Asset(sudo, null, getL1(l1)?.gaspName, tokenAddress);
      id = await getAssetIdFromErc20(tokenAddress, l1);
    }
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(ferrier),
      Assets.mintToken(id, ferrier),
    );
    return ferrier;
  }

  static async ferryThisDeposit(
    ferrier: User,
    deposit: PalletRolldownMessagesDeposit,
    l1: L1Type,
  ) {
    return await signTx(
      getApi(),
      Rolldown.depositFerryUnsafe(deposit, l1),
      ferrier.keyRingPair,
    );
  }
}
