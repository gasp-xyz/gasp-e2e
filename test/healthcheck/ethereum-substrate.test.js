import BN from "bn.js";

import { EthClient } from "mangata-bridge/test/src/ethclient";
import { SubClient } from "mangata-bridge/test/src/subclient";

import { waitNewBlock } from "../../utils/eventListeners";

describe("Healtcheck - Ethereum <-> Substrate", () => {
  let ethClient;
  let subClient;

  const ethereumWsUrl = "ws://localhost:8545";
  const substrateWsUrl = "ws://localhost:9944";
  const ethAppAddress = "";
  const erc20AppAddress = "";

  const ETH_ASSET_ID = "0x01";

  // eslint-disable-next-line prettier/prettier
  const polkadotRecipient = "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";
  // eslint-disable-next-line prettier/prettier
  const polkadotRecipientSS58 = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

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
