import { setupApi } from "./setup";
import { getApi } from "./api";
import { Sudo } from "./sudo";

export class Issuance {
  static async setIssuanceConfig(
    liquidityMiningSplit: number,
    stakingSplit: number,
    sequencersSplit: number,
  ) {
    await setupApi();
    const api = await getApi();
    return Sudo.sudo(
      api.tx.issuance.setIssuanceConfig(
        null,
        null,
        liquidityMiningSplit * 10000000,
        stakingSplit * 10000000,
        sequencersSplit * 10000000,
      ),
    );
  }

  static async getIssuanceConfig() {
    const api = await getApi();
    const issuanceConfig = JSON.parse(
      JSON.stringify(await api.query.issuance.issuanceConfigStore()),
    );
    return issuanceConfig;
  }
}
