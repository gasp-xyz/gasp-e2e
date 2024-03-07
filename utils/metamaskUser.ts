import { BN } from "@polkadot/util";
import { ethers } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";

export class metamaskUser {
  private provider: JsonRpcProvider;
  private ethUserAddress: string;

  constructor(
    ethUserAddress: string,
    uri = "",
    provider: JsonRpcProvider | undefined = undefined,
  ) {
    if (provider) {
      this.provider = provider;
    } else if (uri) {
      this.provider = new ethers.providers.JsonRpcProvider(uri);
    } else {
      throw new Error("provider or URI is required");
    }
    this.ethUserAddress = ethUserAddress;
  }
  public async getBalance() {
    return await metamaskUser.getBalance(this.provider, this.ethUserAddress);
  }

  static async getBalance(provider: JsonRpcProvider, ethUserAddress: string) {
    const value = await provider.getBalance(ethUserAddress);
    return new BN(
      (
        parseFloat(ethers.utils.formatEther(value)) * Math.pow(10, 18)
      ).toString(),
    );
  }
}
