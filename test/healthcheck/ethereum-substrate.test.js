/* 
 * eslint-disable prettier/prettier 
 *
 * @group ci
 */

import BN from "bn.js";

import { EthClient } from "mangata-bridge/test/src/ethclient";
import { SubClient } from "mangata-bridge/test/src/subclient";

import { waitNewBlock } from "../../utils/eventListeners";
import { getEnvironmentRequiredVars } from "../../utils/utils";


describe("Healtcheck - Ethereum <-> Substrate", () => {

  const { 
    ethereumWsUrl, 
    substrateWsUrl, 
    ethAppAddress, 
    erc20AppAddress, 
    polkadotRecipient, 
    polkadotRecipientSS58 
  } = getEnvironmentRequiredVars();

  let ethClient;
  let subClient;

  const ETH_ASSET_ID = "0x01";

  beforeAll(async () => {
    ethClient = new EthClient(ethereumWsUrl, ethAppAddress, erc20AppAddress);
    subClient = new SubClient(substrateWsUrl);

    await subClient.connect();
    await ethClient.initialize();
  });

  test("Tx: Ethereum -> Substrate", async () => {
    const amount = BN("10000000000000000"); // 0.01 ETH

    const beforeEthBalance = await ethClient.getEthBalance(
      ethClient.accounts[1]
    );

    const beforeSubBalance = await subClient.queryAccountBalance(
      polkadotRecipientSS58,
      ETH_ASSET_ID
    );

    const { gasCost } = await ethClient.sendEth(
      ethClient.accounts[1],
      amount,
      polkadotRecipient
    );

    await waitNewBlock();

    const afterEthBalance = await ethClient.getEthBalance(
      ethClient.accounts[1]
    );
    const afterSubBalance = await subClient.queryAccountBalance(
      polkadotRecipientSS58,
      ETH_ASSET_ID
    );

    expect(beforeEthBalance.minus(afterEthBalance)).toBe(amount.plus(gasCost));
    expect(afterSubBalance.minus(beforeSubBalance)).toBe(amount);

    expect(beforeEthBalance.plus(beforeSubBalance)).toBe(
      afterEthBalance.plus(afterSubBalance).plus(gasCost)
    );
  });

  test("Tx: Substrate -> Ethereum", async () => {
    const amount = BN("10000000000000000"); // 0.01 ETH

    const beforeEthBalance = await ethClient.getEthBalance(
      ethClient.accounts[1]
    );

    const beforeSubBalance = await subClient.queryAccountBalance(
      polkadotRecipientSS58,
      ETH_ASSET_ID
    );

    await waitNewBlock();

    const afterEthBalance = await ethClient.getEthBalance(
      ethClient.accounts[1]
    );
    const afterSubBalance = await subClient.queryAccountBalance(
      polkadotRecipientSS58,
      ETH_ASSET_ID
    );

    expect(afterEthBalance.minus(beforeEthBalance)).toBe(amount);
    expect(beforeSubBalance.minus(afterSubBalance)).toBe(amount);

    expect(beforeEthBalance.plus(beforeSubBalance)).toBe(
      afterEthBalance.plus(afterSubBalance)
    );
  });
});
