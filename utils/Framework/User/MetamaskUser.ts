import { BN } from "@polkadot/util";
import { BaseUser } from "./BaseUser";
import { Keyring } from "@polkadot/api";
import { Node } from "../Node/Node";
import { getEnvironmentRequiredVars } from "../../utils";
import { erc20User, mMNGAdrress } from "../../../utils/erc20Utils";
import { ethUser } from "../../../utils/ethUtils";
const Web3 = require("web3");
const HDWalletProvider = require("@truffle/hdwallet-provider");

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
    const ethUserAddress = provider.addresses[0];
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
