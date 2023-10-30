import { BN } from "@polkadot/util";
import { ERC20ABI } from "./abi/ERC20ABI";

//CCC
export const mUSDCAdrress = "0x7abd0fe503c9fcb6b1344f5284c42e6ae48b76b7";
//YYY
export const mBTCAdrress = "0xea29c120d90ccd09e04c16108341941e510f01f3";
//XXX
export const mDOTAdrress = "0x20a9b8313e040e52b6176c8cfd46dea0e3c62763";
//MNG
export const mMNGAdrress = "0x388d1B653468B4247817d24a6a980A9BE5057BD5";

export class erc20User {
  private web3: any;
  private userAddress: string;

  constructor(
    userAddress: string,
    uri = "",
    web3: any | undefined = undefined,
  ) {
    if (web3) {
      this.web3 = web3;
    } else if (uri) {
      this.web3 = new web3.eth.Contract(ERC20ABI as any);
    } else {
      throw new Error("provider or URI is required");
    }
    this.userAddress = userAddress;
  }
  public async getBalance(tokenAddress: string) {
    return await erc20User.getBalance(
      this.web3,
      this.userAddress,
      tokenAddress,
    );
  }

  static async getBalance(
    web3: any,
    userAddress: string,
    tokenAddress: string,
  ) {
    const contract = new web3.eth.Contract(ERC20ABI as any, tokenAddress);
    const balance = await contract.methods.balanceOf(userAddress).call();
    return new BN(balance.toString());
  }
}
