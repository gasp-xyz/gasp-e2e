import { BN } from "@polkadot/util";
import { BaseUser } from "./BaseUser.js";
import { Keyring } from "@polkadot/api";
import { Node } from "../Node/Node.js";
import { getEnvironmentRequiredVars } from "../../utils.js";
import { erc20User, mMNGAdrress } from "../../../utils/erc20Utils.js";
import { ethUser } from "../../../utils/ethUtils.js";
import Web3 from "web3";
import HDWalletProvider from "@truffle/hdwallet-provider";

export class MetamaskUser extends BaseUser {
  node: Node;
  erc20MetaMaskWallet: erc20User;
  ethMetaMaskWallet: ethUser;

  constructor(keyring: Keyring, json: any, node: Node) {
    const {
      sudo: sudoName,
      ethereumHttpUrl,
      mnemonicMetaMask,
    } = getEnvironmentRequiredVars();

    super(keyring, sudoName, json);
    this.node = node;

    const uri = ethereumHttpUrl;
    const mnemonic = mnemonicMetaMask;
    const provider = new HDWalletProvider(mnemonic, uri);
    const ethUserAddress = provider.getAddresses()[0]; //.addresses[0];
    //@ts-ignore
    const web3 = new Web3(provider);
    this.erc20MetaMaskWallet = new erc20User(ethUserAddress, uri, web3);
    this.ethMetaMaskWallet = new ethUser(ethUserAddress, uri);
  }
  async getEthBalance(): Promise<BN> {
    const ethBalance = this.ethMetaMaskWallet.getBalance();
    return ethBalance;
  }
  async geterc20Balance(tokenAddress: string = mMNGAdrress) {
    return await this.erc20MetaMaskWallet.getBalance(tokenAddress);
  }
}
