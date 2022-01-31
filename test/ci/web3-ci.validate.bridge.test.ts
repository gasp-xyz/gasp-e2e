/*
 *
 * @group ci
 * @group bridge
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
import { ERC20AppABI } from "../../utils/abi/ERC20AppABI";

import { ETH_ASSET_ID, MGA_ASSET_ID } from "../../utils/Constants";
import { signSendAndWaitToFinishTx } from "../../utils/txHandler";
import { testLog } from "../../utils/Logger";
import { ethUser } from "../../utils/ethUtils";
import { getAssetId, getUserAssets } from "../../utils/tx";
import { erc20User, mDOTAdrress, mMNGAdrress } from "../../utils/erc20Utils";
import { ERC20ABI } from "../../utils/abi/ERC20ABI";
const Web3 = require("web3");
const HDWalletProvider = require("truffle-hdwallet-provider");

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

describe("Test Withdraw - Deposit", () => {
  let testUser1: User;
  let ethMetaMaskUser: ethUser;
  let erc20MetaMaskUser: erc20User;
  let ethApp: any;
  let api: any;
  let ethUserAddress: string;
  let uri: string;
  let erc20App: any;
  let web3: any;
  let mDOTAssetId: BN;

  const {
    mnemonicMetaMask,
    ethereumHttpUrl,
    ethAppAddress,
    sudo: sudoUserName,
    erc20AppAddress,
  } = getEnvironmentRequiredVars();

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await waitNewBlock();
    const keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring, "//Alice");
    const sudo = new User(keyring, sudoUserName);
    await testUser1.addMGATokens(sudo);
    mDOTAssetId = await getAssetId("mDOT");
    await sudo.mint(
      mDOTAssetId,
      testUser1,
      new BN(Math.pow(10, 18).toString())
    );
    testUser1.addAsset(MGA_ASSET_ID.toString());
    testUser1.addAsset(mDOTAssetId.toString());

    api = await getApi();
    // setup eth user and web3
    uri = ethereumHttpUrl;
    const mnemonic = mnemonicMetaMask;
    const provider = new HDWalletProvider(mnemonic, uri);
    ethUserAddress = provider.addresses[0];

    web3 = new Web3(provider);
    ethApp = new web3.eth.Contract(ethAppABI, ethAppAddress);
    erc20App = new web3.eth.Contract(ERC20AppABI, erc20AppAddress);
    erc20MetaMaskUser = new erc20User(ethUserAddress, uri, web3);
    ethMetaMaskUser = new ethUser(ethUserAddress, uri);
  });
  test("that Eth arrive to User TokenId 1 in Mangata and can be sent back", async () => {
    testUser1.addAsset(ETH_ASSET_ID);
    await testUser1.refreshAmounts();
    const userAddressInMGA = testUser1.keyRingPair.address;
    const decodedAddress = ss58toHexUnchecked(userAddressInMGA);
    const amountNumber = Math.pow(10, 18) * 0.001;
    const amountBN = new BN(amountNumber.toString());

    const ethBalanceBefore = await ethMetaMaskUser.getBalance();

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
      testUser1.getAsset(ETH_ASSET_ID)?.amountBefore.free!,
      getUserTokensBalance
    );

    const ethBalanceAfter = await ethMetaMaskUser.getBalance();
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const receivedAmountInMGA = testUser1
      .getAsset(ETH_ASSET_ID)
      ?.amountAfter.free!.sub(
        testUser1.getAsset(ETH_ASSET_ID)?.amountBefore.free!
      );
    testLog
      .getLog()
      .info(` received Amount : ${receivedAmountInMGA!.toString()} `);

    //send the money back!

    await signSendAndWaitToFinishTx(
      api.tx.eth.burn(
        ethUserAddress,
        testUser1.getAsset(ETH_ASSET_ID)?.amountAfter!.free
      ),
      testUser1.keyRingPair
    );
    await User.waitUntilBNChanged(
      testUser1.getAsset(ETH_ASSET_ID)?.amountAfter.free!,
      getUserTokensBalance
    );
    await User.waitUntilBNChanged(ethBalanceAfter, getEthBalance);

    const ethBalanceAfterBackAgain = await ethMetaMaskUser.getBalance();
    expect(ethBalanceBefore.sub(amountBN).gte(ethBalanceAfter)).toBeTruthy();
    expect(ethBalanceAfterBackAgain.gte(ethBalanceAfter)).toBeTruthy();
    expect(receivedAmountInMGA).bnEqual(amountBN);

    async function getEthBalance(): Promise<BN> {
      const ethBalance = ethMetaMaskUser.getBalance();
      return ethBalance;
    }
    async function getUserTokensBalance(): Promise<BN> {
      const assetsValue = await (
        await getUserAssets(testUser1.keyRingPair.address, [ETH_ASSET_ID])
      )[0];
      return assetsValue.free;
    }
  });

  test.each([
    [mDOTAdrress, "mDOT"],
    [mMNGAdrress, "MGA"],
  ])(
    "that %s - %s can be sent to MetaMask wallet and can be deposited",
    async (assetAddress: string, assetName: string) => {
      const assetId = (await getAssetId(assetName)).toString();
      await testUser1.refreshAmounts();
      const userAddressInMGA = testUser1.keyRingPair.address;
      const amountNumber = Math.pow(10, 18) * 0.001;
      const amountBN = new BN(amountNumber.toString());
      const assetBalanceBefore = await erc20MetaMaskUser.getBalance(
        assetAddress
      );
      const decodedAddress = ss58toHexUnchecked(userAddressInMGA);

      const tokenContract = new web3.eth.Contract(ERC20ABI, assetAddress);

      //send some tokens from MGA to MetaMAsk wallet. 0.010
      await signSendAndWaitToFinishTx(
        api.tx.erc20.burn(
          assetAddress,
          ethUserAddress,
          amountBN.mul(new BN(10))
        ),
        testUser1.keyRingPair
      );
      await User.waitUntilBNChanged(assetBalanceBefore, getAssetBalance);
      await testUser1.refreshAmounts(AssetWallet.AFTER);
      const amountAfterwithdraw = (
        testUser1.getAsset(assetId)?.amountBefore!.free.toBn() as BN
      ).sub(testUser1.getAsset(assetId)?.amountAfter!.free.toBn() as BN)!;

      const assetBalanceAfterWithdraw = await erc20MetaMaskUser.getBalance(
        assetAddress
      );
      //send some tokens from MetaMask  to MGA 0.001
      await tokenContract.methods.approve(erc20AppAddress, amountBN).send({
        from: ethUserAddress,
        gas: new BN(50000),
        gasPrice: new BN(20000000000),
        value: 0,
      });

      const send = await erc20App.methods
        .sendERC20(decodedAddress, assetAddress, amountBN)
        .send({
          from: ethUserAddress,
          gas: new BN(200000),
          gasPrice: new BN(20000000000),
          value: 0,
        });
      testLog
        .getLog()
        .info(
          ` Send ${assetName} to Mangata Hash - ${send.transactionHash} in ${uri}`
        );

      await User.waitUntilBNChanged(assetBalanceAfterWithdraw, getAssetBalance);

      const assetBalanceAfterDeposit = await erc20MetaMaskUser.getBalance(
        assetAddress
      );

      expect(
        assetBalanceAfterWithdraw.sub(amountBN).gte(assetBalanceAfterDeposit)
      ).toBeTruthy();
      expect(amountAfterwithdraw!.gte(amountBN.mul(new BN(10)))).toBeTruthy();

      async function getAssetBalance(): Promise<BN> {
        const balance = erc20MetaMaskUser.getBalance(assetAddress);
        return balance;
      }
    }
  );
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
