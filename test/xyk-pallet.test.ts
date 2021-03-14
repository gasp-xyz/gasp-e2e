import {getApi, initApi} from "../utils/api";
import { getCurrentNonce, signTx, calcuate_mint_liquidity_price_local, calcuate_burn_liquidity_price_local, calculate_sell_price_local, calculate_buy_price_local, calculate_sell_price_rpc, calculate_buy_price_rpc, getUserAssets, getBalanceOfAsset, getBalanceOfPool, getNextAssetId, getLiquidityAssetId, getAssetSupply, balanceTransfer, getSudoKey, sudoIssueAsset, transferAsset, createPool, sellAsset, buyAsset, mintLiquidity, burnLiquidity} from '../utils/tx'
import {waitNewBlock, expectEvent} from '../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {sleep} from "../utils/utils";

test('xyk-pallet: Happy case scenario', async () => {
	jest.setTimeout(600000);
  process.env.NODE_ENV = 'test';

	try {
    getApi();
  } catch(e) {
    await initApi();
  }

	const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  const bob = keyring.addFromUri('//Bob');
  const charlie = keyring.addFromUri('//Charlie');
	const maciatko = keyring.addFromUri('//Maciatko');

	// Assuming the pallet's AccountId
	const pallet_address = "5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2"

  const nextAssetId = await getNextAssetId();
  const firstAssetId = new BN(nextAssetId.toString());
  const secondAssetId = firstAssetId.add(new BN(1));

	var sudoKey = await getSudoKey();
	var sudoPair = keyring.getPair(sudoKey.toString());

	var eventPromise;
	var eventResponse;
	var error;

	await waitNewBlock();

	// Sudo requies alice as key.
	console.log("Sudo: issuing asset " + firstAssetId + " to Alice");
	eventPromise = expectEvent("assets","Issued", 12);
	sudoIssueAsset(sudoPair, new BN(220000), alice.address);
	[eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	var alice_assets = await getUserAssets(alice.address, [firstAssetId]);
	expect(alice_assets).toEqual([new BN(220000)]);


	await waitNewBlock();

  console.log("Sudo: issuing asset " + secondAssetId + " to Alice");
  eventPromise = expectEvent("assets","Issued", 12);
  sudoIssueAsset(sudoPair, new BN(120000), alice.address);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	var alice_assets = await getUserAssets(alice.address, [secondAssetId]);
	expect(alice_assets).toEqual([new BN(120000)]);


  await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());

	alice_assets_before.push(new BN(0));
	bob_assets_before.push(new BN(0));
	pool_balance_before = [new BN(0), new BN(0)];
	total_liquidity_assets_before = new BN(0);

	var user = alice;
	var first_asset_amount = new BN(50000);
	var second_asset_amount = new BN(50000);

  console.log("Alice: creating pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk","PoolCreated", 14);
  createPool(user, firstAssetId, first_asset_amount, secondAssetId, second_asset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	var liquidity_asset_id = await getLiquidityAssetId(firstAssetId, secondAssetId);
	var liquidity_assets_minted = first_asset_amount.add(second_asset_amount);
	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].sub(first_asset_amount),	alice_assets_before[1].sub(second_asset_amount),	alice_assets_before[2].add(liquidity_assets_minted)	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(first_asset_amount),	pallet_assets_before[1].add(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(first_asset_amount),	pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());

	var user = alice;
	var first_asset_amount = new BN(30000);
	var [second_asset_amount, liquidity_assets_minted] = await calcuate_mint_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);

  console.log("Alice: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityMinted", 14);
  mintLiquidity(user, firstAssetId, secondAssetId, first_asset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_minted.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].sub(first_asset_amount),	alice_assets_before[1].sub(second_asset_amount),	alice_assets_before[2].add(liquidity_assets_minted)	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(first_asset_amount),	pallet_assets_before[1].add(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(first_asset_amount),	pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

  await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());

	var user = alice;
	var amount = new BN(100000);

	console.log("Alice: transfering asset " + firstAssetId + " to Bob");
	eventPromise = expectEvent("assets", "Transferred", 12);
	transferAsset(user, firstAssetId, bob.address, amount);
	[eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].sub(amount),	alice_assets_before[1],	alice_assets_before[2]	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].add(amount),	bob_assets_before[1], bob_assets_before[2]])
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());

	var user = bob;
	var amount = new BN(30000);
	var sell_price_local = calculate_sell_price_local(pool_balance_before[0], pool_balance_before[1], amount);
	var sell_price_rpc = await calculate_sell_price_rpc(pool_balance_before[0], pool_balance_before[1], amount);

	console.log(sell_price_local);
	console.log(sell_price_rpc);
	console.log(sell_price_local.toString());
	console.log(sell_price_rpc.toString());

	expect(sell_price_local).toEqual(sell_price_rpc);

  console.log("Bob: selling asset " + firstAssetId + ", buying asset " + secondAssetId);
	var soldAssetId = firstAssetId;
	var boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(sell_price_local.toString());
	// console.log(sell_price_rpc.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].sub(amount),	bob_assets_before[1].add(sell_price_local), bob_assets_before[2]])
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(amount),	pallet_assets_before[1].sub(sell_price_local)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(amount),	pool_balance_before[1].sub(sell_price_local)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());

	var user = bob;
	var amount = new BN(20000);
	var sell_price_local = calculate_sell_price_local(pool_balance_before[1], pool_balance_before[0], amount);
	var sell_price_rpc = await calculate_sell_price_rpc(pool_balance_before[1], pool_balance_before[0], amount);

	expect(sell_price_local).toEqual(sell_price_rpc);

  console.log("Bob: selling asset " + secondAssetId + ", buying asset " + firstAssetId);
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(sell_price_local.toString());
	// console.log(sell_price_rpc.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].add(sell_price_local),	bob_assets_before[1].sub(amount), bob_assets_before[2]])
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(sell_price_local),	pallet_assets_before[1].add(amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(sell_price_local),	pool_balance_before[1].add(amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());

	var user = bob;
	var amount = new BN(10000);
	var buy_price_local = calculate_buy_price_local(pool_balance_before[0], pool_balance_before[1], amount);
	var buy_price_rpc = await calculate_buy_price_rpc(pool_balance_before[0], pool_balance_before[1], amount);

	expect(buy_price_local).toEqual(buy_price_rpc);

  console.log("Bob: buying asset " + secondAssetId + ", selling asset " + firstAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  buyAsset(user, soldAssetId, boughtAssetId, amount, new BN(1000000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(buy_price_local.toString());
	// console.log(buy_price_rpc.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].sub(buy_price_local),	bob_assets_before[1].add(amount), bob_assets_before[2]])
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(buy_price_local),	pallet_assets_before[1].sub(amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(buy_price_local),	pool_balance_before[1].sub(amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());

	var user = bob;
	var amount = new BN(10000);
	var buy_price_local = calculate_buy_price_local(pool_balance_before[1], pool_balance_before[0], amount);
	var buy_price_rpc = await calculate_buy_price_rpc(pool_balance_before[1], pool_balance_before[0], amount);

	expect(buy_price_local).toEqual(buy_price_rpc);

  console.log("Bob: buying asset " + firstAssetId + ", selling asset " + secondAssetId);
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  buyAsset(user, soldAssetId, boughtAssetId, amount, new BN(1000000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(buy_price_local.toString());
	// console.log(buy_price_rpc.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].add(amount),	bob_assets_before[1].sub(buy_price_local), bob_assets_before[2]])
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(amount),	pallet_assets_before[1].add(buy_price_local)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(amount),	pool_balance_before[1].add(buy_price_local)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = alice;
	var first_asset_amount = new BN(20000);
	var [second_asset_amount, liquidity_assets_burned] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);

  console.log("Alice: burning liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
  burnLiquidity(user, firstAssetId, secondAssetId, first_asset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(first_asset_amount.toString());
	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_burned.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].add(first_asset_amount),	alice_assets_before[1].add(second_asset_amount),	alice_assets_before[2].sub(liquidity_assets_burned)	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(first_asset_amount),	pallet_assets_before[1].sub(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(first_asset_amount),	pool_balance_before[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.sub(liquidity_assets_burned))
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());


	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = alice;
	var first_asset_amount = alice_assets_before[2].mul(pool_balance_before[0]).div(total_liquidity_assets_before);
	var [second_asset_amount, liquidity_assets_burned] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);

  console.log("Alice: burning all liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
  burnLiquidity(user, firstAssetId, secondAssetId, first_asset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(first_asset_amount.toString());
	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_burned.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].add(first_asset_amount),	alice_assets_before[1].add(second_asset_amount),	alice_assets_before[2].sub(liquidity_assets_burned)	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(first_asset_amount),	pallet_assets_before[1].sub(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(first_asset_amount),	pool_balance_before[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.sub(liquidity_assets_burned))
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

});


test('xyk-pallet: Liquidity sufficiency scenario', async () => {
	jest.setTimeout(600000);
  process.env.NODE_ENV = 'test';

	try {
    getApi();
  } catch(e) {
    await initApi();
  }

	const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  const bob = keyring.addFromUri('//Bob');
  const charlie = keyring.addFromUri('//Charlie');
	const maciatko = keyring.addFromUri('//Maciatko');

	// Assuming the pallet's AccountId
	const pallet_address = "5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2"

  const nextAssetId = await getNextAssetId();
  const firstAssetId = new BN(nextAssetId.toString());
  const secondAssetId = firstAssetId.add(new BN(1));

	var sudoKey = await getSudoKey();
	var sudoPair = keyring.getPair(sudoKey.toString());

	var eventPromise;
	var eventResponse;
	var error;

	await waitNewBlock();

	// Sudo requies alice as key.
	console.log("Sudo: issuing asset " + firstAssetId + " to Alice");
	eventPromise = expectEvent("assets","Issued", 12);
	sudoIssueAsset(sudoPair, new BN(200000), alice.address);
	[eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	var alice_assets = await getUserAssets(alice.address, [firstAssetId]);
	expect(alice_assets).toEqual([new BN(200000)]);


	await waitNewBlock();

  console.log("Sudo: issuing asset " + secondAssetId + " to Alice");
  eventPromise = expectEvent("assets","Issued", 12);
  sudoIssueAsset(sudoPair, new BN(200000), alice.address);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	var alice_assets = await getUserAssets(alice.address, [secondAssetId]);
	expect(alice_assets).toEqual([new BN(200000)]);

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	// console.log(bob_assets_before.toString());

	var user = alice;
	var amount = new BN(100000);

	console.log("Alice: transfering asset " + firstAssetId + " to Bob");
	eventPromise = expectEvent("assets", "Transferred", 12);
	transferAsset(user, firstAssetId, bob.address, amount);
	[eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	expect	([	alice_assets_before[0].sub(amount),	alice_assets_before[1]	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	expect	([	bob_assets_before[0].add(amount),	bob_assets_before[1]	])
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	// console.log(bob_assets_before.toString());

	var user = alice;
	var amount = new BN(100000);

	console.log("Alice: transfering asset " + secondAssetId + " to Bob");
	eventPromise = expectEvent("assets", "Transferred", 12);
	transferAsset(user, secondAssetId, bob.address, amount);
	[eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	expect	([	alice_assets_before[0],	alice_assets_before[1].sub(amount)	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	expect	([	bob_assets_before[0],	bob_assets_before[1].add(amount)	])
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());

  await waitNewBlock();

  var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());

	alice_assets_before.push(new BN(0));
	bob_assets_before.push(new BN(0));
	pool_balance_before = [new BN(0), new BN(0)];
	total_liquidity_assets_before = new BN(0);

	var user = alice;
	var first_asset_amount = new BN(60000);
	var second_asset_amount = new BN(60000);

  console.log("Alice: creating pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk","PoolCreated", 14);
  createPool(user, firstAssetId, first_asset_amount, secondAssetId, second_asset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	var liquidity_asset_id = await getLiquidityAssetId(firstAssetId, secondAssetId);
	var liquidity_assets_minted = first_asset_amount.add(second_asset_amount);
	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].sub(first_asset_amount),	alice_assets_before[1].sub(second_asset_amount),	alice_assets_before[2].add(liquidity_assets_minted)	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(first_asset_amount),	pallet_assets_before[1].add(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(first_asset_amount),	pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

  var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());

	var user = alice;
	var first_asset_amount = new BN(20000);
	var [second_asset_amount, liquidity_assets_minted] = await calcuate_mint_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);

  console.log("Alice: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityMinted", 14);
  mintLiquidity(user, firstAssetId, secondAssetId, first_asset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_minted.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].sub(first_asset_amount),	alice_assets_before[1].sub(second_asset_amount),	alice_assets_before[2].add(liquidity_assets_minted)	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(first_asset_amount),	pallet_assets_before[1].add(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(first_asset_amount),	pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

  var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());

	var user = bob;
	var first_asset_amount = new BN(80000);
	var [second_asset_amount, liquidity_assets_minted] = await calcuate_mint_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);

  console.log("Bob: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityMinted", 14);
  mintLiquidity(user, firstAssetId, secondAssetId, first_asset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_minted.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].sub(first_asset_amount),	bob_assets_before[1].sub(second_asset_amount),	bob_assets_before[2].add(liquidity_assets_minted)	])
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(first_asset_amount),	pallet_assets_before[1].add(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(first_asset_amount),	pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = alice;
	var first_asset_amount = alice_assets_before[2].mul(pool_balance_before[0]).div(total_liquidity_assets_before);
	var [second_asset_amount, liquidity_assets_burned] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);
	var first_asset_amount_excess = first_asset_amount.mul(new BN(105)).div(new BN(100));

  console.log("Alice: attempting to burn more liquidity than they have " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
  burnLiquidity(user, firstAssetId, secondAssetId, first_asset_amount_excess);
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(2);

	// console.log(first_asset_amount.toString());
	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_burned.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

  var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = bob;
	var first_asset_amount = bob_assets_before[2].mul(pool_balance_before[0]).div(total_liquidity_assets_before);
	var [second_asset_amount, liquidity_assets_burned] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);
	var first_asset_amount_excess = first_asset_amount.mul(new BN(105)).div(new BN(100));

  console.log("Bob: attempting to burn more liquidity than they have " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
  burnLiquidity(user, firstAssetId, secondAssetId, first_asset_amount_excess);
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(2);

	// console.log(first_asset_amount.toString());
	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_burned.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

  var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = alice;
	var first_asset_amount = alice_assets_before[2].mul(pool_balance_before[0]).div(total_liquidity_assets_before);
	var [second_asset_amount, liquidity_assets_burned] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);

  console.log("Alice: burning all liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
  burnLiquidity(user, firstAssetId, secondAssetId, first_asset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(first_asset_amount.toString());
	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_burned.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].add(first_asset_amount),	alice_assets_before[1].add(second_asset_amount),	alice_assets_before[2].sub(liquidity_assets_burned)	])
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(first_asset_amount),	pallet_assets_before[1].sub(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(first_asset_amount),	pool_balance_before[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.sub(liquidity_assets_burned))
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = bob;
	var first_asset_amount = bob_assets_before[2].mul(pool_balance_before[0]).div(total_liquidity_assets_before);
	var [second_asset_amount, liquidity_assets_burned] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);
	var first_asset_amount_excess = first_asset_amount.mul(new BN(105)).div(new BN(100));

	console.log("Bob: owning 100% of the pool, attempting to burn more liquidity than then pool has " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
  burnLiquidity(user, firstAssetId, secondAssetId, first_asset_amount_excess);
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(2);

	// console.log(first_asset_amount.toString());
	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_burned.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = bob;
	var first_asset_amount = bob_assets_before[2].mul(pool_balance_before[0]).div(total_liquidity_assets_before);
	var [second_asset_amount, liquidity_assets_burned] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);

  console.log("Bob: burning all liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
  burnLiquidity(user, firstAssetId, secondAssetId, first_asset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	// console.log(first_asset_amount.toString());
	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_burned.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].add(first_asset_amount),	bob_assets_before[1].add(second_asset_amount),	bob_assets_before[2].sub(liquidity_assets_burned)	])
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(first_asset_amount),	pallet_assets_before[1].sub(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(first_asset_amount),	pool_balance_before[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.sub(liquidity_assets_burned))
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = bob;
	var first_asset_amount = new BN(10000);

	console.log("Bob: attempting to burn liquidity from 0 liquidity pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
  burnLiquidity(user, firstAssetId, secondAssetId, first_asset_amount);
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	// console.log(first_asset_amount.toString());
	// console.log(second_asset_amount.toString());
	// console.log(liquidity_assets_burned.toString());

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = bob;
	var amount = new BN(30000);

  console.log("Bob: attempting to sell asset from 0 liquidity pool " + firstAssetId + ", buying asset " + secondAssetId);
	var soldAssetId = firstAssetId;
	var boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = bob;
	var amount = new BN(20000);

  console.log("Bob: attempting to sell asset from 0 liquidity pool " + secondAssetId + ", buying asset " + firstAssetId);
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = bob;
	var amount = new BN(10000);

  console.log("Bob: attempting to buy asset from 0 liquidity pool " + secondAssetId + ", selling asset " + firstAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  buyAsset(user, soldAssetId, boughtAssetId, amount, new BN(1000000));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();

	var alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(alice_assets_before.toString());
	var bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.log(bob_assets_before.toString());
	var pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.log(pallet_assets_before.toString());
	var pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.log(pool_balance_before.toString());
	var total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.log(total_liquidity_assets_before.toString());


	var user = bob;
	var amount = new BN(20000);

  console.log("Bob: attempting to buy asset from 0 liquidity pool " + firstAssetId + ", selling asset " + secondAssetId);
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  buyAsset(user, soldAssetId, boughtAssetId, amount, new BN(1000000));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	var alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.log(alice_assets.toString());
	var bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.log(bob_assets.toString());
	var pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.log(pallet_assets.toString());
	var pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.log(pool_balance.toString());
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.log(total_liquidity_assets.toString());

	await waitNewBlock();


});
