/*
 *
 * @group ci
 */

import BN from "bn.js";
//@ts-ignore
import bs58 from "bs58";
import { getApi, initApi } from "../../utils/api";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { waitNewBlock } from "../../utils/eventListeners";
import { getEnvironmentRequiredVars } from "../../utils/utils";

import { ethAppABI } from "../../utils/abi/EthAppABI";

import { ETH_ASSET_ID } from "../../utils/Constants";
import { signSendAndWaitToFinishTx } from "../../utils/txHandler";
import { testLog } from "../../utils/Logger";
import { ethUser } from "../../utils/ethUtils";
import { getUserAssets } from "../../utils/tx";
const Web3 = require("web3");
const HDWalletProvider = require("truffle-hdwallet-provider");

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

describe("test ether", () => {
  let testUser1: User;
  let metaMaskUser: ethUser;
  let ethApp: any;
  let api: any;
  let ethUserAddress: string;
  let uri: string;

  const {
    mnemonicMetaMask,
    ethereumHttpUrl,
    ethAppAddress,
    sudo: sudoUserName,
  } = getEnvironmentRequiredVars();

  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await waitNewBlock();
    const keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);
    const sudo = new User(keyring, sudoUserName);
    await testUser1.addMGATokens(sudo);
    api = await getApi();
    // setup eth user and web3
    uri = ethereumHttpUrl;
    const mnemonic = mnemonicMetaMask;
    const provider = new HDWalletProvider(mnemonic, uri);
    ethUserAddress = provider.addresses[0];
    metaMaskUser = new ethUser(ethUserAddress, uri);
    const web3 = new Web3(provider);
    ethApp = new web3.eth.Contract(
      JSON.parse(JSON.stringify(ethAppABI)),
      ethAppAddress
    );
  });
  test("that Eth arrive to User TokenId 1 in Mangata and can be sent back", async () => {
    testUser1.addAsset(ETH_ASSET_ID);
    await testUser1.refreshAmounts();
    const userAddressInMGA = testUser1.keyRingPair.address;
    const decodedAddress = ss58toHexUnchecked(userAddressInMGA);
    const amountNumber = Math.pow(10, 18) * 0.001;
    const amountBN = new BN(amountNumber.toString());

    const ethBalanceBefore = await metaMaskUser.getBalance();

    const send = await ethApp.methods.sendETH(decodedAddress).send({
      from: ethUserAddress,
      gas: new BN(50000),
      gasPrice: new BN(20000000000),
      value: amountBN,
    });
    testLog
      .getLog()
      .info(` Send ETH to MGA Hash - ${send.transactionHash} in ${uri}`);

    await User.waitUntilBNChanged(ethBalanceBefore, getEthBalance);
    await User.waitUntilBNChanged(
      testUser1.getAsset(ETH_ASSET_ID)?.amountBefore!,
      getUserTokensBalance
    );

    const ethBalanceAfter = await metaMaskUser.getBalance();
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const receivedAmountInMGA = testUser1
      .getAsset(ETH_ASSET_ID)
      ?.amountAfter!.sub(testUser1.getAsset(ETH_ASSET_ID)?.amountBefore!);
    testLog
      .getLog()
      .info(` received Amount : ${receivedAmountInMGA!.toString()} `);

    //send the money back!

    await signSendAndWaitToFinishTx(
      api.tx.eth.burn(
        ethUserAddress,
        testUser1.getAsset(ETH_ASSET_ID)?.amountAfter!
      ),
      testUser1.keyRingPair
    );
    await User.waitUntilBNChanged(
      testUser1.getAsset(ETH_ASSET_ID)?.amountAfter!,
      getUserTokensBalance
    );
    await User.waitUntilBNChanged(ethBalanceAfter, getEthBalance);

    const ethBalanceAfterBackAgain = await metaMaskUser.getBalance();
    expect(ethBalanceBefore.sub(amountBN).gte(ethBalanceAfter)).toBeTruthy();
    expect(ethBalanceAfterBackAgain.gte(ethBalanceAfter)).toBeTruthy();
    expect(receivedAmountInMGA).bnEqual(amountBN);

    async function getEthBalance(): Promise<BN> {
      const ethBalance = metaMaskUser.getBalance();
      return ethBalance;
    }
    async function getUserTokensBalance(): Promise<BN> {
      const assetsValue = await (
        await getUserAssets(testUser1.keyRingPair.address, [ETH_ASSET_ID])
      )[0];
      return assetsValue.free;
    }
  });
});

function ss58toHexUnchecked(ss58address: string) {
  let a;
  try {
    a = bs58.decode(ss58address);
  } catch (e) {
    return null;
  }
  const address = a.slice(0, 33);
  return address.slice(1);
}
