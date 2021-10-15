import BN from "bn.js";
import { ERC20ABI } from "../utils/abi/ERC20ABI";

//CCC
export const mUSDCAdrress = "0x7abd0fe503c9fcb6b1344f5284c42e6ae48b76b7";
//YYY
export const mBTCAdrress = "0xea29c120d90ccd09e04c16108341941e510f01f3";
//XXX
export const mDOTAdrress = "0x2a35ed00731625ad1b48151ecc2e57d2b0fd9fff";
//MNG
export const mMNGAdrress = "0xC7e3Bda797D2cEb740308eC40142ae235e08144A";

export class erc20User {
  private web3: any;
  private userAddress: string;

  constructor(
    userAddress: string,
    uri = "",
    web3: any | undefined = undefined
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
      tokenAddress
    );
  }

  static async getBalance(
    web3: any,
    userAddress: string,
    tokenAddress: string
  ) {
    const contract = new web3.eth.Contract(ERC20ABI as any, tokenAddress);
    const balance = await contract.methods.balanceOf(userAddress).call();
    return new BN(balance.toString());
  }
}
