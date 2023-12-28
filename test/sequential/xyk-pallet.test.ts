// todo remove test once v2 is passing on CI for some time
import { getApi, initApi } from "../../utils/api";
import { jest } from "@jest/globals";
import {
  calcuate_mint_liquidity_price_local,
  calcuate_burn_liquidity_price_local,
  calculate_sell_price_local,
  calculate_buy_price_local,
  calculate_sell_price_rpc,
  calculate_buy_price_rpc,
  getUserAssets,
  getBalanceOfPool,
  getNextAssetId,
  getLiquidityAssetId,
  getAssetSupply,
  getSudoKey,
  transferAsset,
  createPool,
  sellAsset,
  buyAsset,
  mintLiquidity,
  burnLiquidity,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";

import {
  calculateFees,
  calculateLiqAssetAmount,
  getEnvironmentRequiredVars,
  xykErrors,
} from "../../utils/utils";
import {
  getEventResultFromMangataTx,
  sudoIssueAsset,
} from "../../utils/txHandler";
import { testLog } from "../../utils/Logger";
import { TokenBalance } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { xykPalletAddress, sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

test("xyk-pallet: Happy case scenario", async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  const keyring = new Keyring({ type: "sr25519" });
  const alice = keyring.addFromUri("//Alice");
  const bob = keyring.addFromUri("//Bob");
  keyring.addFromUri(sudoUserName);

  let pool_balance_before;
  let total_liquidity_assets_before;

  // Assuming the pallet's AccountId
  const pallet_address = xykPalletAddress;

  const nextAssetId = await getNextAssetId();
  const firstAssetId = new BN(nextAssetId.toString());
  const secondAssetId = firstAssetId.add(new BN(1));

  const sudoKey = await getSudoKey();
  const sudoPair = keyring.getPair(sudoKey.toString());

  testLog.getLog().info("Sudo: issuing asset " + firstAssetId + " to Alice");

  await sudoIssueAsset(sudoPair, new BN(220000), alice.address).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "tokens",
        "Created",
        alice.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  let alice_assets = await getUserAssets(alice.address, [firstAssetId]);
  expect(alice_assets.map((asset) => asset.free)).collectionBnEqual([
    new BN(220000),
  ]);

  testLog.getLog().info("Sudo: issuing asset " + secondAssetId + " to Alice");

  await sudoIssueAsset(sudoPair, new BN(120000), alice.address).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "tokens",
        "Created",
        alice.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  alice_assets = await getUserAssets(alice.address, [secondAssetId]);
  expect(alice_assets.map((asset) => asset.free)).collectionBnEqual([
    new BN(120000),
  ]);

  let alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
  ]);
  alice_assets_before.push({ free: new BN(0) } as TokenBalance);
  testLog.getLog().debug(alice_assets_before.toString());
  let bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
  ]);
  bob_assets_before.push({ free: new BN(0) } as TokenBalance);
  testLog.getLog().debug(bob_assets_before.toString());
  let pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());

  //  alice_assets_before.push(new BN(0));
  //  bob_assets_before.push(new BN(0));
  pool_balance_before = [new BN(0), new BN(0)];
  total_liquidity_assets_before = new BN(0);

  let user = alice;
  let first_asset_amount = new BN(50000);
  let second_asset_amount = new BN(50000);

  testLog
    .getLog()
    .info("Alice: creating pool " + firstAssetId + " - " + secondAssetId);
  await createPool(
    user,
    firstAssetId,
    first_asset_amount,
    secondAssetId,
    second_asset_amount,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "PoolCreated",
      user.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const liquidity_asset_id = await getLiquidityAssetId(
    firstAssetId,
    secondAssetId,
  );
  let liquidity_assets_minted = calculateLiqAssetAmount(
    first_asset_amount,
    second_asset_amount,
  );
  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    alice_assets_before[0].free.sub(first_asset_amount),
    alice_assets_before[1].free.sub(second_asset_amount),
    alice_assets_before[2].free.add(liquidity_assets_minted),
  ]).collectionBnEqual(alice_assets.map((asset) => asset.free));
  testLog.getLog().debug(alice_assets.toString());
  let bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  let pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    pallet_assets_before[0].free.add(first_asset_amount),
    pallet_assets_before[1].free.add(second_asset_amount),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  let pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect([
    pool_balance_before[0].add(first_asset_amount),
    pool_balance_before[1].add(second_asset_amount),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  let total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before.add(liquidity_assets_minted)).bnEqual(
    total_liquidity_assets,
  );
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = alice;
  first_asset_amount = new BN(30000);
  [second_asset_amount, liquidity_assets_minted] =
    await calcuate_mint_liquidity_price_local(
      firstAssetId,
      secondAssetId,
      first_asset_amount,
    );

  testLog
    .getLog()
    .info("Alice: minting liquidity " + firstAssetId + " - " + secondAssetId);

  await mintLiquidity(
    user,
    firstAssetId,
    secondAssetId,
    first_asset_amount,
    second_asset_amount,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "LiquidityMinted",
      user.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  testLog.getLog().debug(second_asset_amount.toString());
  testLog.getLog().debug(liquidity_assets_minted.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    alice_assets_before[0].free.sub(first_asset_amount),
    alice_assets_before[1].free.sub(second_asset_amount),
    alice_assets_before[2].free.add(liquidity_assets_minted),
  ]).collectionBnEqual(alice_assets.map((asset) => asset.free));
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    pallet_assets_before[0].free.add(first_asset_amount),
    pallet_assets_before[1].free.add(second_asset_amount),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect([
    pool_balance_before[0].add(first_asset_amount),
    pool_balance_before[1].add(second_asset_amount),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before.add(liquidity_assets_minted)).bnEqual(
    total_liquidity_assets,
  );
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = alice;
  let amount = new BN(100000);

  testLog.getLog().info("Alice: transfering asset " + firstAssetId + " to Bob");

  await transferAsset(user, firstAssetId, bob.address, amount).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "tokens",
        "Transfer",
        user.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    alice_assets_before[0].free.sub(amount),
    alice_assets_before[1].free,
    alice_assets_before[2].free,
  ]).collectionBnEqual(alice_assets.map((asset) => asset.free));
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    bob_assets_before[0].free.add(amount),
    bob_assets_before[1].free,
    bob_assets_before[2].free,
  ]).collectionBnEqual(bob_assets.map((asset) => asset.free));
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect(pallet_assets_before).toEqual(pallet_assets);
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect(pool_balance_before).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  amount = new BN(30000);
  let sell_price_local = calculate_sell_price_local(
    pool_balance_before[0],
    pool_balance_before[1],
    amount,
  );
  let sell_price_rpc = await calculate_sell_price_rpc(
    pool_balance_before[0],
    pool_balance_before[1],
    amount,
  );

  expect(sell_price_local).bnEqual(sell_price_rpc);

  testLog
    .getLog()
    .info(
      "Bob: selling asset " + firstAssetId + ", buying asset " + secondAssetId,
    );
  let soldAssetId = firstAssetId;
  let boughtAssetId = secondAssetId;

  await sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0)).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        user.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  testLog.getLog().debug(sell_price_local.toString());
  testLog.getLog().debug(sell_price_rpc.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    bob_assets_before[0].free.sub(amount),
    bob_assets_before[1].free.add(sell_price_local),
    bob_assets_before[2].free,
  ]).collectionBnEqual(bob_assets.map((asset) => asset.free));
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);

  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  let { treasury, treasuryBurn } = calculateFees(amount);
  expect([
    pool_balance_before[0].add(amount).sub(treasury.add(treasuryBurn)),
    pool_balance_before[1].sub(sell_price_local),
  ]).collectionBnEqual(pool_balance);
  expect([
    pallet_assets_before[0].free.add(amount).sub(treasury.add(treasuryBurn)),
    pallet_assets_before[1].free.sub(sell_price_local),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));

  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  amount = new BN(20000);
  sell_price_local = calculate_sell_price_local(
    pool_balance_before[1],
    pool_balance_before[0],
    amount,
  );
  sell_price_rpc = await calculate_sell_price_rpc(
    pool_balance_before[1],
    pool_balance_before[0],
    amount,
  );

  expect(sell_price_local).bnEqual(sell_price_rpc);

  testLog
    .getLog()
    .info(
      "Bob: selling asset " + secondAssetId + ", buying asset " + firstAssetId,
    );
  soldAssetId = secondAssetId;
  boughtAssetId = firstAssetId;

  await sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0)).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        user.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  testLog.getLog().debug(sell_price_local.toString());
  testLog.getLog().debug(sell_price_rpc.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    bob_assets_before[0].free.add(sell_price_local),
    bob_assets_before[1].free.sub(amount),
    bob_assets_before[2].free,
  ]).collectionBnEqual(bob_assets.map((asset) => asset.free));
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  treasury = calculateFees(amount).treasury;
  treasuryBurn = calculateFees(amount).treasuryBurn;
  expect([
    pallet_assets_before[0].free.sub(sell_price_local),
    pallet_assets_before[1].free.add(amount).sub(treasury.add(treasuryBurn)),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);

  expect([
    pool_balance_before[0].sub(sell_price_local),
    pool_balance_before[1].add(amount).sub(treasury.add(treasuryBurn)),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  amount = new BN(10000);
  let buy_price_local = calculate_buy_price_local(
    pool_balance_before[0],
    pool_balance_before[1],
    amount,
  );
  let buy_price_rpc = await calculate_buy_price_rpc(
    pool_balance_before[0],
    pool_balance_before[1],
    amount,
  );

  expect(buy_price_local).bnEqual(buy_price_rpc);

  testLog
    .getLog()
    .info(
      "Bob: buying asset " + secondAssetId + ", selling asset " + firstAssetId,
    );
  soldAssetId = firstAssetId;
  boughtAssetId = secondAssetId;

  await buyAsset(
    user,
    soldAssetId,
    boughtAssetId,
    amount,
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "AssetsSwapped",
      user.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  testLog.getLog().debug(buy_price_local.toString());
  testLog.getLog().debug(buy_price_rpc.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    bob_assets_before[0].free.sub(buy_price_local),
    bob_assets_before[1].free.add(amount),
    bob_assets_before[2].free,
  ]).collectionBnEqual(bob_assets.map((asset) => asset.free));
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);

  treasury = calculateFees(buy_price_local).treasury;
  treasuryBurn = calculateFees(buy_price_local).treasuryBurn;

  expect([
    pallet_assets_before[0].free
      .add(buy_price_local)
      .sub(treasury.add(treasuryBurn)),
    pallet_assets_before[1].free.sub(amount),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);

  expect([
    pool_balance_before[0].add(buy_price_local).sub(treasury.add(treasuryBurn)),
    pool_balance_before[1].sub(amount),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  amount = new BN(10000);
  buy_price_local = calculate_buy_price_local(
    pool_balance_before[1],
    pool_balance_before[0],
    amount,
  );
  buy_price_rpc = await calculate_buy_price_rpc(
    pool_balance_before[1],
    pool_balance_before[0],
    amount,
  );

  expect(buy_price_local).bnEqual(buy_price_rpc);

  testLog
    .getLog()
    .info(
      "Bob: buying asset " + firstAssetId + ", selling asset " + secondAssetId,
    );
  soldAssetId = secondAssetId;
  boughtAssetId = firstAssetId;

  await buyAsset(
    user,
    soldAssetId,
    boughtAssetId,
    amount,
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "AssetsSwapped",
      user.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  testLog.getLog().debug(buy_price_local.toString());
  testLog.getLog().debug(buy_price_rpc.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    bob_assets_before[0].free.add(amount),
    bob_assets_before[1].free.sub(buy_price_local),
    bob_assets_before[2].free,
  ]).collectionBnEqual(bob_assets.map((asset) => asset.free));
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  treasury = calculateFees(buy_price_local).treasury;
  treasuryBurn = calculateFees(buy_price_local).treasuryBurn;
  expect([
    pallet_assets_before[0].free.sub(amount),
    pallet_assets_before[1].free
      .add(buy_price_local)
      .sub(treasury.add(treasuryBurn)),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);

  expect([
    pool_balance_before[0].sub(amount),
    pool_balance_before[1].add(buy_price_local).sub(treasury.add(treasuryBurn)),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = alice;
  const liquidity_assets_burned = new BN(20000);
  [first_asset_amount, second_asset_amount] =
    await calcuate_burn_liquidity_price_local(
      firstAssetId,
      secondAssetId,
      liquidity_assets_burned,
    );

  testLog
    .getLog()
    .info(
      "Alice: burning liquidity " +
        liquidity_assets_burned +
        "of pool " +
        firstAssetId +
        " - " +
        secondAssetId,
    );

  await burnLiquidity(
    user,
    firstAssetId,
    secondAssetId,
    liquidity_assets_burned,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "LiquidityBurned",
      user.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  testLog.getLog().debug(first_asset_amount.toString());
  testLog.getLog().debug(second_asset_amount.toString());
  testLog.getLog().debug(liquidity_assets_burned.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    alice_assets_before[0].free.add(first_asset_amount),
    alice_assets_before[1].free.add(second_asset_amount),
    alice_assets_before[2].free.sub(liquidity_assets_burned),
  ]).collectionBnEqual(alice_assets.map((asset) => asset.free));
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    pallet_assets_before[0].free.sub(first_asset_amount),
    pallet_assets_before[1].free.sub(second_asset_amount),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect([
    pool_balance_before[0].sub(first_asset_amount),
    pool_balance_before[1].sub(second_asset_amount),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before.sub(liquidity_assets_burned)).bnEqual(
    total_liquidity_assets,
  );
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = alice;
  [first_asset_amount, second_asset_amount] =
    await calcuate_burn_liquidity_price_local(
      firstAssetId,
      secondAssetId,
      liquidity_assets_burned,
    );

  testLog
    .getLog()
    .info(
      "Alice: burning all liquidity " + firstAssetId + " - " + secondAssetId,
    );
  await burnLiquidity(
    user,
    firstAssetId,
    secondAssetId,
    liquidity_assets_burned,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "LiquidityBurned",
      user.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  testLog.getLog().debug(first_asset_amount.toString());
  testLog.getLog().debug(second_asset_amount.toString());
  testLog.getLog().debug(liquidity_assets_burned.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    alice_assets_before[0].free.add(first_asset_amount),
    alice_assets_before[1].free.add(second_asset_amount),
    alice_assets_before[2].free.sub(liquidity_assets_burned),
  ]).collectionBnEqual(alice_assets.map((asset) => asset.free));
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    pallet_assets_before[0].free.sub(first_asset_amount),
    pallet_assets_before[1].free.sub(second_asset_amount),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect([
    pool_balance_before[0].sub(first_asset_amount),
    pool_balance_before[1].sub(second_asset_amount),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before.sub(liquidity_assets_burned)).bnEqual(
    total_liquidity_assets,
  );
  testLog.getLog().debug(total_liquidity_assets.toString());
});

test("xyk-pallet: Liquidity sufficiency scenario", async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  const pallet_address = xykPalletAddress;

  const keyring = new Keyring({ type: "sr25519" });
  const alice = keyring.addFromUri("//Alice");
  const bob = keyring.addFromUri("//Bob");
  keyring.addFromUri(sudoUserName);

  const nextAssetId = await getNextAssetId();
  const firstAssetId = new BN(nextAssetId.toString());
  const secondAssetId = firstAssetId.add(new BN(1));

  const sudoKey = await getSudoKey();
  const sudoPair = keyring.getPair(sudoKey.toString());

  testLog.getLog().info("Sudo: issuing asset " + firstAssetId + " to Alice");
  await sudoIssueAsset(sudoPair, new BN(200000), alice.address).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "tokens",
        "Created",
        alice.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  let alice_assets = await getUserAssets(alice.address, [firstAssetId]);
  expect(alice_assets.map((asset) => asset.free)).collectionBnEqual([
    new BN(200000),
  ]);

  testLog.getLog().info("Sudo: issuing asset " + secondAssetId + " to Alice");

  await sudoIssueAsset(sudoPair, new BN(200000), alice.address).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "tokens",
        "Created",
        alice.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  alice_assets = await getUserAssets(alice.address, [secondAssetId]);
  expect(alice_assets[0].free).bnEqual(new BN(200000));

  let alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  let bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());

  let user = alice;
  let amount = new BN(100000);

  testLog.getLog().info("Alice: transfering asset " + firstAssetId + " to Bob");

  await transferAsset(user, firstAssetId, bob.address, amount).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "tokens",
        "Transfer",
        user.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    alice_assets_before[0].free.sub(amount),
    alice_assets_before[1].free,
  ]).collectionBnEqual(alice_assets.map((asset) => asset.free));
  testLog.getLog().debug(alice_assets.toString());
  let bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    bob_assets_before[0].free.add(amount),
    bob_assets_before[1].free,
  ]).collectionBnEqual(bob_assets.map((asset) => asset.free));
  testLog.getLog().debug(bob_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());

  user = alice;
  amount = new BN(100000);

  testLog
    .getLog()
    .info("Alice: transfering asset " + secondAssetId + " to Bob");

  await transferAsset(user, secondAssetId, bob.address, amount).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "tokens",
        "Transfer",
        user.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    alice_assets_before[0].free,
    alice_assets_before[1].free.sub(amount),
  ]).collectionBnEqual(alice_assets.map((asset) => asset.free));
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
  expect([
    bob_assets_before[0].free,
    bob_assets_before[1].free.add(amount),
  ]).collectionBnEqual(bob_assets.map((asset) => asset.free));
  testLog.getLog().debug(bob_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  let pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  let pool_balance_before, total_liquidity_assets_before;
  alice_assets_before.push({ free: new BN(0) } as TokenBalance);
  bob_assets_before.push({ free: new BN(0) } as TokenBalance);
  pool_balance_before = [new BN(0), new BN(0)];
  total_liquidity_assets_before = new BN(0);

  user = alice;
  let first_asset_amount = new BN(60000);
  let second_asset_amount = new BN(60000);

  testLog
    .getLog()
    .info("Alice: creating pool " + firstAssetId + " - " + secondAssetId);

  await createPool(
    user,
    firstAssetId,
    first_asset_amount,
    secondAssetId,
    second_asset_amount,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "PoolCreated",
      user.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const liquidity_asset_id = await getLiquidityAssetId(
    firstAssetId,
    secondAssetId,
  );
  let liquidity_assets_minted = calculateLiqAssetAmount(
    first_asset_amount,
    second_asset_amount,
  );
  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    alice_assets_before[0].free.sub(first_asset_amount),
    alice_assets_before[1].free.sub(second_asset_amount),
    alice_assets_before[2].free.add(liquidity_assets_minted),
  ]).collectionBnEqual(alice_assets.map((asset) => asset.free));
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  let pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    pallet_assets_before[0].free.add(first_asset_amount),
    pallet_assets_before[1].free.add(second_asset_amount),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  let pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect([
    pool_balance_before[0].add(first_asset_amount),
    pool_balance_before[1].add(second_asset_amount),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  let total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before.add(liquidity_assets_minted)).bnEqual(
    total_liquidity_assets,
  );
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = alice;
  first_asset_amount = new BN(20000);
  [second_asset_amount, liquidity_assets_minted] =
    await calcuate_mint_liquidity_price_local(
      firstAssetId,
      secondAssetId,
      first_asset_amount,
    );

  testLog
    .getLog()
    .info("Alice: minting liquidity " + firstAssetId + " - " + secondAssetId);
  await mintLiquidity(
    user,
    firstAssetId,
    secondAssetId,
    first_asset_amount,
    second_asset_amount,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "LiquidityMinted",
      user.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  testLog.getLog().debug(second_asset_amount.toString());
  testLog.getLog().debug(liquidity_assets_minted.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    alice_assets_before[0].free.sub(first_asset_amount),
    alice_assets_before[1].free.sub(second_asset_amount),
    alice_assets_before[2].free.add(liquidity_assets_minted),
  ]).collectionBnEqual(alice_assets.map((asset) => asset.free));
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    pallet_assets_before[0].free.add(first_asset_amount),
    pallet_assets_before[1].free.add(second_asset_amount),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect([
    pool_balance_before[0].add(first_asset_amount),
    pool_balance_before[1].add(second_asset_amount),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before.add(liquidity_assets_minted)).bnEqual(
    total_liquidity_assets,
  );
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  first_asset_amount = new BN(80000);
  [second_asset_amount, liquidity_assets_minted] =
    await calcuate_mint_liquidity_price_local(
      firstAssetId,
      secondAssetId,
      first_asset_amount,
    );

  testLog
    .getLog()
    .info("Bob: minting liquidity " + firstAssetId + " - " + secondAssetId);

  await mintLiquidity(
    user,
    firstAssetId,
    secondAssetId,
    first_asset_amount,
    second_asset_amount,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "LiquidityMinted",
      user.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  testLog.getLog().debug(second_asset_amount.toString());
  testLog.getLog().debug(liquidity_assets_minted.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    bob_assets_before[0].free.sub(first_asset_amount),
    bob_assets_before[1].free.sub(second_asset_amount),
    bob_assets_before[2].free.add(liquidity_assets_minted),
  ]).collectionBnEqual(bob_assets.map((asset) => asset.free));
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    pallet_assets_before[0].free.add(first_asset_amount),
    pallet_assets_before[1].free.add(second_asset_amount),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect([
    pool_balance_before[0].add(first_asset_amount),
    pool_balance_before[1].add(second_asset_amount),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before.add(liquidity_assets_minted)).bnEqual(
    total_liquidity_assets,
  );
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = alice;
  let liquidity_assets_burned = alice_assets_before[2];
  [first_asset_amount, second_asset_amount] =
    await calcuate_burn_liquidity_price_local(
      firstAssetId,
      secondAssetId,
      first_asset_amount,
    );
  let liquidity_assets_burned_excess = liquidity_assets_burned.free
    .mul(new BN(105))
    .div(new BN(100));

  testLog
    .getLog()
    .info(
      "Alice: attempting to burn more liquidity than they have " +
        firstAssetId +
        " - " +
        secondAssetId,
    );
  await burnLiquidity(
    user,
    firstAssetId,
    secondAssetId,
    liquidity_assets_burned_excess,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(xykErrors.NotEnoughAssets);
  });

  testLog.getLog().debug(first_asset_amount.toString());
  testLog.getLog().debug(second_asset_amount.toString());
  testLog.getLog().debug(liquidity_assets_burned.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect(pallet_assets_before).toEqual(pallet_assets);
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect(pool_balance_before).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  let liquidity_asset_amount: BN = bob_assets_before[2].free;
  [first_asset_amount, second_asset_amount] =
    await calcuate_burn_liquidity_price_local(
      firstAssetId,
      secondAssetId,
      liquidity_asset_amount,
    );
  const liquidity_asset_amount_excess = liquidity_asset_amount
    .mul(new BN(105))
    .div(new BN(100));

  testLog
    .getLog()
    .info(
      "Bob: attempting to burn more liquidity than they have " +
        liquidity_asset_amount_excess +
        " from pool " +
        firstAssetId +
        " - " +
        secondAssetId,
    );

  await burnLiquidity(
    user,
    firstAssetId,
    secondAssetId,
    liquidity_asset_amount_excess,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(xykErrors.NotEnoughAssets);
  });

  testLog.getLog().debug(first_asset_amount.toString());
  testLog.getLog().debug(second_asset_amount.toString());
  testLog.getLog().debug(liquidity_assets_burned.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect(pallet_assets_before).toEqual(pallet_assets);
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect(pool_balance_before).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = alice;
  liquidity_assets_burned = alice_assets_before[2];
  [first_asset_amount, second_asset_amount] =
    await calcuate_burn_liquidity_price_local(
      firstAssetId,
      secondAssetId,
      liquidity_assets_burned.free,
    );

  testLog
    .getLog()
    .info(
      "Alice: burning all liquidity " + firstAssetId + " - " + secondAssetId,
    );

  await burnLiquidity(
    user,
    firstAssetId,
    secondAssetId,
    liquidity_assets_burned.free,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "LiquidityBurned",
      user.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  testLog.getLog().debug(first_asset_amount.toString());
  testLog.getLog().debug(second_asset_amount.toString());
  testLog.getLog().debug(liquidity_assets_burned.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    alice_assets_before[0].free.add(first_asset_amount),
    alice_assets_before[1].free.add(second_asset_amount),
    alice_assets_before[2].free.sub(liquidity_assets_burned.free),
  ]).collectionBnEqual(alice_assets.map((asset) => asset.free));
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    pallet_assets_before[0].free.sub(first_asset_amount),
    pallet_assets_before[1].free.sub(second_asset_amount),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect([
    pool_balance_before[0].sub(first_asset_amount),
    pool_balance_before[1].sub(second_asset_amount),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(
    total_liquidity_assets_before.sub(liquidity_assets_burned.free),
  ).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  liquidity_assets_burned = bob_assets_before[2];
  [first_asset_amount, second_asset_amount] =
    await calcuate_burn_liquidity_price_local(
      firstAssetId,
      secondAssetId,
      liquidity_assets_burned.free,
    );
  liquidity_assets_burned_excess = liquidity_assets_burned.free
    .mul(new BN(105))
    .div(new BN(100));

  testLog
    .getLog()
    .info(
      "Bob: owning 100% of the pool, attempting to burn more liquidity than then pool has " +
        firstAssetId +
        " - " +
        secondAssetId,
    );

  await burnLiquidity(
    user,
    firstAssetId,
    secondAssetId,
    liquidity_assets_burned_excess,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(xykErrors.NotEnoughAssets);
  });

  testLog.getLog().debug(first_asset_amount.toString());
  testLog.getLog().debug(second_asset_amount.toString());
  testLog.getLog().debug(liquidity_assets_burned.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect(pallet_assets_before).toEqual(pallet_assets);
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect(pool_balance_before).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  liquidity_assets_burned = bob_assets_before[2];
  [first_asset_amount, second_asset_amount] =
    await calcuate_burn_liquidity_price_local(
      firstAssetId,
      secondAssetId,
      liquidity_assets_burned.free,
    );

  testLog
    .getLog()
    .info("Bob: burning all liquidity " + firstAssetId + " - " + secondAssetId);

  await burnLiquidity(
    user,
    firstAssetId,
    secondAssetId,
    liquidity_assets_burned.free,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "LiquidityBurned",
      user.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  testLog.getLog().debug(first_asset_amount.toString());
  testLog.getLog().debug(second_asset_amount.toString());
  testLog.getLog().debug(liquidity_assets_burned.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect([
    bob_assets_before[0].free.add(first_asset_amount),
    bob_assets_before[1].free.add(second_asset_amount),
    bob_assets_before[2].free.sub(liquidity_assets_burned.free),
  ]).collectionBnEqual(bob_assets.map((asset) => asset.free));
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect([
    pallet_assets_before[0].free.sub(first_asset_amount),
    pallet_assets_before[1].free.sub(second_asset_amount),
  ]).collectionBnEqual(pallet_assets.map((asset) => asset.free));
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect([
    pool_balance_before[0].sub(first_asset_amount),
    pool_balance_before[1].sub(second_asset_amount),
  ]).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(
    total_liquidity_assets_before.sub(liquidity_assets_burned.free),
  ).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  liquidity_asset_amount = new BN(10000);

  testLog
    .getLog()
    .info(
      "Bob: attempting to burn liquidity from 0 liquidity pool " +
        firstAssetId +
        " - " +
        secondAssetId,
    );

  await burnLiquidity(
    user,
    firstAssetId,
    secondAssetId,
    liquidity_asset_amount,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
  });

  testLog.getLog().debug(first_asset_amount.toString());
  testLog.getLog().debug(second_asset_amount.toString());
  testLog.getLog().debug(liquidity_assets_burned.toString());

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect(pallet_assets_before).toEqual(pallet_assets);
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect(pool_balance_before).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  amount = new BN(30000);

  testLog
    .getLog()
    .info(
      "Bob: attempting to sell asset from 0 liquidity pool " +
        firstAssetId +
        ", buying asset " +
        secondAssetId,
    );
  let soldAssetId = firstAssetId;
  let boughtAssetId = secondAssetId;

  await sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0)).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
    },
  );

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect(pallet_assets_before).toEqual(pallet_assets);
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect(pool_balance_before).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  amount = new BN(20000);
  testLog
    .getLog()
    .info(
      "Bob: attempting to sell asset from 0 liquidity pool " +
        secondAssetId +
        ", buying asset " +
        firstAssetId,
    );
  soldAssetId = secondAssetId;
  boughtAssetId = firstAssetId;

  await sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0)).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
    },
  );

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect(pallet_assets_before).toEqual(pallet_assets);
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect(pool_balance_before).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  amount = new BN(10000);

  testLog
    .getLog()
    .info(
      "Bob: attempting to buy asset from 0 liquidity pool " +
        secondAssetId +
        ", selling asset " +
        firstAssetId,
    );
  soldAssetId = firstAssetId;
  boughtAssetId = secondAssetId;

  await buyAsset(
    user,
    soldAssetId,
    boughtAssetId,
    amount,
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
  });

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect(pallet_assets_before).toEqual(pallet_assets);
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect(pool_balance_before).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());

  alice_assets_before = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(alice_assets_before.toString());
  bob_assets_before = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  testLog.getLog().debug(bob_assets_before.toString());
  pallet_assets_before = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  testLog.getLog().debug(pallet_assets_before.toString());
  pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
  testLog.getLog().debug(pool_balance_before.toString());
  total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
  testLog.getLog().debug(total_liquidity_assets_before.toString());

  user = bob;
  amount = new BN(20000);

  testLog
    .getLog()
    .info(
      "Bob: attempting to buy asset from 0 liquidity pool " +
        firstAssetId +
        ", selling asset " +
        secondAssetId,
    );
  soldAssetId = secondAssetId;
  boughtAssetId = firstAssetId;

  await buyAsset(
    user,
    soldAssetId,
    boughtAssetId,
    amount,
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
  });

  alice_assets = await getUserAssets(alice.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(alice_assets_before.map((asset) => asset.free)).collectionBnEqual(
    alice_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(alice_assets.toString());
  bob_assets = await getUserAssets(bob.address, [
    firstAssetId,
    secondAssetId,
    liquidity_asset_id,
  ]);
  expect(bob_assets_before.map((asset) => asset.free)).collectionBnEqual(
    bob_assets.map((asset) => asset.free),
  );
  testLog.getLog().debug(bob_assets.toString());
  pallet_assets = await getUserAssets(pallet_address, [
    firstAssetId,
    secondAssetId,
  ]);
  expect(pallet_assets_before).toEqual(pallet_assets);
  testLog.getLog().debug(pallet_assets.toString());
  pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
  expect(pool_balance_before).collectionBnEqual(pool_balance);
  testLog.getLog().debug(pool_balance.toString());
  total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before).bnEqual(total_liquidity_assets);
  testLog.getLog().debug(total_liquidity_assets.toString());
});
