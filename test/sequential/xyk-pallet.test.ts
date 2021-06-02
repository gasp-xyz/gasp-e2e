import {getApi, initApi} from "../../utils/api";
import { calcuate_mint_liquidity_price_local, calcuate_burn_liquidity_price_local, calculate_sell_price_local, calculate_buy_price_local, calculate_sell_price_rpc, calculate_buy_price_rpc, getUserAssets, getBalanceOfPool, getNextAssetId, getLiquidityAssetId, getAssetSupply, getSudoKey, sudoIssueAsset, transferAsset, createPool, sellAsset, buyAsset, mintLiquidity, burnLiquidity} from '../../utils/tx'
import {waitNewBlock, getUserEventResult, ExtrinsicResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import { getEnvironmentRequiredVars } from "../../utils/utils";

jest.spyOn(console, 'log').mockImplementation(jest.fn());
const {pallet: pallet_address,sudo:sudoUserName} = getEnvironmentRequiredVars();

jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

test.skip('xyk-pallet: Happy case scenario', async () => {

	try {
    getApi();
  } catch(e) {
    await initApi();
  }

	const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  const bob = keyring.addFromUri('//Bob');
  keyring.addFromUri(sudoUserName);

  let pool_balance_before;
  let total_liquidity_assets_before;

	// Assuming the pallet's AccountId
	const pallet_address = "5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2"

  const nextAssetId = await getNextAssetId();
  const firstAssetId = new BN(nextAssetId.toString());
  const secondAssetId = firstAssetId.add(new BN(1));

	let sudoKey = await getSudoKey();
	let sudoPair = keyring.getPair(sudoKey.toString());

	await waitNewBlock();

	console.info("Sudo: issuing asset " + firstAssetId + " to Alice");
	let eventPromise = getUserEventResult("tokens","Issued", 12, alice.address);
	sudoIssueAsset(sudoPair, new BN(220000), alice.address);
	let eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	let alice_assets = await getUserAssets(alice.address, [firstAssetId]);
	expect(alice_assets).toEqual([new BN(220000)]);


	await waitNewBlock();

  console.info("Sudo: issuing asset " + secondAssetId + " to Alice");
  eventPromise = getUserEventResult("tokens","Issued", 12, alice.address);
  sudoIssueAsset(sudoPair, new BN(120000), alice.address);
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	alice_assets = await getUserAssets(alice.address, [secondAssetId]);
	expect(alice_assets).toEqual([new BN(120000)]);


  await waitNewBlock();

	let alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	// console.info(alice_assets_before.toString());
	let bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	// console.info(bob_assets_before.toString());
	let pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());

	alice_assets_before.push(new BN(0));
	bob_assets_before.push(new BN(0));
	pool_balance_before = [new BN(0), new BN(0)];
	total_liquidity_assets_before = new BN(0);

	let user = alice;
	let first_asset_amount = new BN(50000);
	let second_asset_amount = new BN(50000);

  console.info("Alice: creating pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk","PoolCreated", 14, user.address );
  createPool(user, firstAssetId, first_asset_amount, secondAssetId, second_asset_amount);
    eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	let liquidity_asset_id = await getLiquidityAssetId(firstAssetId, secondAssetId);
	let liquidity_assets_minted = first_asset_amount.add(second_asset_amount);
	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].sub(first_asset_amount),	alice_assets_before[1].sub(second_asset_amount),	alice_assets_before[2].add(liquidity_assets_minted)	])
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	let bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	let pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(first_asset_amount),	pallet_assets_before[1].add(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	let pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(first_asset_amount),	pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	let total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());

	user = alice;
	first_asset_amount = new BN(30000);
	[second_asset_amount, liquidity_assets_minted] = await calcuate_mint_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);

  console.info("Alice: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk", "LiquidityMinted", 14, user.address);
  mintLiquidity(user, firstAssetId, secondAssetId, first_asset_amount);
  	eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	// console.info(second_asset_amount.toString());
	// console.info(liquidity_assets_minted.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].sub(first_asset_amount),	alice_assets_before[1].sub(second_asset_amount),	alice_assets_before[2].add(liquidity_assets_minted)	])
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(first_asset_amount),	pallet_assets_before[1].add(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(first_asset_amount),	pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

  await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());

	user = alice;
	let amount = new BN(100000);

	console.info("Alice: transfering asset " + firstAssetId + " to Bob");
	eventPromise = getUserEventResult("tokens", "Transferred", 12, user.address);
	transferAsset(user, firstAssetId, bob.address, amount);
	eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].sub(amount),	alice_assets_before[1],	alice_assets_before[2]	])
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].add(amount),	bob_assets_before[1], bob_assets_before[2]])
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());

	user = bob;
	amount = new BN(30000);
	let sell_price_local = calculate_sell_price_local(pool_balance_before[0], pool_balance_before[1], amount);
	let sell_price_rpc = await calculate_sell_price_rpc(pool_balance_before[0], pool_balance_before[1], amount);

	expect(sell_price_local).toEqual(sell_price_rpc);

  console.info("Bob: selling asset " + firstAssetId + ", buying asset " + secondAssetId);
	let soldAssetId = firstAssetId;
	let boughtAssetId = secondAssetId;
  eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, user.address);
  sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0));
  	eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	// console.info(sell_price_local.toString());
	// console.info(sell_price_rpc.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].sub(amount),	bob_assets_before[1].add(sell_price_local), bob_assets_before[2]])
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(amount),	pallet_assets_before[1].sub(sell_price_local)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	const buyAndBurn = new BN(7).mul(new BN(2));
	expect	([	pool_balance_before[0].add(amount),	pool_balance_before[1].sub(sell_price_local).sub(buyAndBurn)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());

	user = bob;
	amount = new BN(20000);
	sell_price_local = calculate_sell_price_local(pool_balance_before[1], pool_balance_before[0], amount);
	sell_price_rpc = await calculate_sell_price_rpc(pool_balance_before[1], pool_balance_before[0], amount);

	expect(sell_price_local).toEqual(sell_price_rpc);

  console.info("Bob: selling asset " + secondAssetId + ", buying asset " + firstAssetId);
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, user.address);
  sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0));
  	eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	// console.info(sell_price_local.toString());
	// console.info(sell_price_rpc.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].add(sell_price_local),	bob_assets_before[1].sub(amount), bob_assets_before[2]])
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(sell_price_local),	pallet_assets_before[1].add(amount)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	const buyAndBurnReSelling = new BN(10).mul(new BN(2));
	expect	([	pool_balance_before[0].sub(sell_price_local).sub(buyAndBurnReSelling),	pool_balance_before[1].add(amount)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());

	user = bob;
	amount = new BN(10000);
	let buy_price_local = calculate_buy_price_local(pool_balance_before[0], pool_balance_before[1], amount);
	let buy_price_rpc = await calculate_buy_price_rpc(pool_balance_before[0], pool_balance_before[1], amount);

	expect(buy_price_local).toEqual(buy_price_rpc);

  console.info("Bob: buying asset " + secondAssetId + ", selling asset " + firstAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, user.address);
  buyAsset(user, soldAssetId, boughtAssetId, amount, new BN(1000000));
  	eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	// console.info(buy_price_local.toString());
	// console.info(buy_price_rpc.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].sub(buy_price_local),	bob_assets_before[1].add(amount), bob_assets_before[2]])
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(buy_price_local),	pallet_assets_before[1].sub(amount)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	const buyAndBurnBuy = new BN(4).mul( new BN(2));
	expect	([	pool_balance_before[0].add(buy_price_local),	pool_balance_before[1].sub(amount).sub(buyAndBurnBuy)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());

	user = bob;
	amount = new BN(10000);
	buy_price_local = calculate_buy_price_local(pool_balance_before[1], pool_balance_before[0], amount);
	buy_price_rpc = await calculate_buy_price_rpc(pool_balance_before[1], pool_balance_before[0], amount);

	expect(buy_price_local).toEqual(buy_price_rpc);

  console.info("Bob: buying asset " + firstAssetId + ", selling asset " + secondAssetId);
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, user.address);
  buyAsset(user, soldAssetId, boughtAssetId, amount, new BN(1000000));
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	// console.info(buy_price_local.toString());
	// console.info(buy_price_rpc.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].add(amount),	bob_assets_before[1].sub(buy_price_local), bob_assets_before[2]])
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(amount),	pallet_assets_before[1].add(buy_price_local)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	const buyAndBurnReBuy = new BN(4).mul( new BN(2));
	expect	([	pool_balance_before[0].sub(amount).sub(buyAndBurnReBuy),	pool_balance_before[1].add(buy_price_local)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = alice;
	let liquidity_assets_burned = new BN(20000);
	[first_asset_amount, second_asset_amount] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, liquidity_assets_burned);

  console.info("Alice: burning liquidity " + liquidity_assets_burned + "of pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, user.address);
  burnLiquidity(user, firstAssetId, secondAssetId, liquidity_assets_burned);
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	// console.info(first_asset_amount.toString());
	// console.info(second_asset_amount.toString());
	// console.info(liquidity_assets_burned.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].add(first_asset_amount),	alice_assets_before[1].add(second_asset_amount),	alice_assets_before[2].sub(liquidity_assets_burned)	])
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(first_asset_amount),	pallet_assets_before[1].sub(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(first_asset_amount),	pool_balance_before[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.sub(liquidity_assets_burned))
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());


	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = alice;
	[first_asset_amount, second_asset_amount] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, liquidity_assets_burned);

  console.info("Alice: burning all liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, user.address);
  burnLiquidity(user, firstAssetId, secondAssetId, liquidity_assets_burned);
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	// console.info(first_asset_amount.toString());
	// console.info(second_asset_amount.toString());
	// console.info(liquidity_assets_burned.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].add(first_asset_amount),	alice_assets_before[1].add(second_asset_amount),	alice_assets_before[2].sub(liquidity_assets_burned)	])
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(first_asset_amount),	pallet_assets_before[1].sub(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(first_asset_amount),	pool_balance_before[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.sub(liquidity_assets_burned))
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

});


test.skip('xyk-pallet: Liquidity sufficiency scenario', async () => {

	try {
    getApi();
  } catch(e) {
    await initApi();
  }

	const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  const bob = keyring.addFromUri('//Bob');
  keyring.addFromUri(sudoUserName);

  const nextAssetId = await getNextAssetId();
  const firstAssetId = new BN(nextAssetId.toString());
  const secondAssetId = firstAssetId.add(new BN(1));

	let sudoKey = await getSudoKey();
	let sudoPair = keyring.getPair(sudoKey.toString());

	let eventPromise;
	await waitNewBlock();

	console.info("Sudo: issuing asset " + firstAssetId + " to Alice");
	eventPromise = getUserEventResult("tokens","Issued", 12, alice.address);
	sudoIssueAsset(sudoPair, new BN(200000), alice.address);
	let eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	let alice_assets = await getUserAssets(alice.address, [firstAssetId]);
	expect(alice_assets).toEqual([new BN(200000)]);


	await waitNewBlock();

  console.info("Sudo: issuing asset " + secondAssetId + " to Alice");
  eventPromise = getUserEventResult("tokens","Issued", 12, alice.address);
  sudoIssueAsset(sudoPair, new BN(200000), alice.address);
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	alice_assets = await getUserAssets(alice.address, [secondAssetId]);
	expect(alice_assets).toEqual([new BN(200000)]);

	await waitNewBlock();

	let alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	// console.info(alice_assets_before.toString());
	let bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	// console.info(bob_assets_before.toString());

	let user = alice;
	let amount = new BN(100000);

	console.info("Alice: transfering asset " + firstAssetId + " to Bob");
	eventPromise = getUserEventResult("tokens", "Transferred", 12, user.address);
	transferAsset(user, firstAssetId, bob.address, amount);
	eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	expect	([	alice_assets_before[0].sub(amount),	alice_assets_before[1]	])
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	let bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	expect	([	bob_assets_before[0].add(amount),	bob_assets_before[1]	])
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	// console.info(bob_assets_before.toString());

	user = alice;
	amount = new BN(100000);

	console.info("Alice: transfering asset " + secondAssetId + " to Bob");
	eventPromise = getUserEventResult("tokens", "Transferred", 12, user.address);
	transferAsset(user, secondAssetId, bob.address, amount);
	eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	expect	([	alice_assets_before[0],	alice_assets_before[1].sub(amount)	])
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	expect	([	bob_assets_before[0],	bob_assets_before[1].add(amount)	])
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());

  await waitNewBlock();

  	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId]);
	// console.info(bob_assets_before.toString());
	let pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
  	let pool_balance_before, total_liquidity_assets_before ;
	alice_assets_before.push(new BN(0));
	bob_assets_before.push(new BN(0));
	pool_balance_before = [new BN(0), new BN(0)];
	total_liquidity_assets_before = new BN(0);

	user = alice;
	let first_asset_amount = new BN(60000);
	let second_asset_amount = new BN(60000);

  console.info("Alice: creating pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk","PoolCreated", 14, user.address);
  createPool(user, firstAssetId, first_asset_amount, secondAssetId, second_asset_amount);
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	let liquidity_asset_id = await getLiquidityAssetId(firstAssetId, secondAssetId);
	let liquidity_assets_minted = first_asset_amount.add(second_asset_amount);
	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].sub(first_asset_amount),	alice_assets_before[1].sub(second_asset_amount),	alice_assets_before[2].add(liquidity_assets_minted)	])
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	let pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(first_asset_amount),	pallet_assets_before[1].add(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	let pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(first_asset_amount),	pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	let total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

  	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());

	user = alice;
	first_asset_amount = new BN(20000);
	[second_asset_amount, liquidity_assets_minted] = await calcuate_mint_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);

  console.info("Alice: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk", "LiquidityMinted", 14, user.address);
  mintLiquidity(user, firstAssetId, secondAssetId, first_asset_amount);
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	// console.info(second_asset_amount.toString());
	// console.info(liquidity_assets_minted.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].sub(first_asset_amount),	alice_assets_before[1].sub(second_asset_amount),	alice_assets_before[2].add(liquidity_assets_minted)	])
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(first_asset_amount),	pallet_assets_before[1].add(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(first_asset_amount),	pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

  	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());

	user = bob;
	first_asset_amount = new BN(80000);
	[second_asset_amount, liquidity_assets_minted] = await calcuate_mint_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);

  console.info("Bob: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk", "LiquidityMinted", 14, user.address);
  mintLiquidity(user, firstAssetId, secondAssetId, first_asset_amount);
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	// console.info(second_asset_amount.toString());
	// console.info(liquidity_assets_minted.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].sub(first_asset_amount),	bob_assets_before[1].sub(second_asset_amount),	bob_assets_before[2].add(liquidity_assets_minted)	])
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].add(first_asset_amount),	pallet_assets_before[1].add(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].add(first_asset_amount),	pool_balance_before[1].add(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.add(liquidity_assets_minted))
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = alice;
	let liquidity_assets_burned = alice_assets_before[2];
	[first_asset_amount, second_asset_amount] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, first_asset_amount);
	let liquidity_assets_burned_excess = liquidity_assets_burned.mul(new BN(105)).div(new BN(100));

  console.info("Alice: attempting to burn more liquidity than they have " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, user.address);
  burnLiquidity(user, firstAssetId, secondAssetId, liquidity_assets_burned_excess);
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
	expect(eventResponse.data).toEqual(2);

	// console.info(first_asset_amount.toString());
	// console.info(second_asset_amount.toString());
	// console.info(liquidity_assets_burned.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

  	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = bob;
	let liquidity_asset_amount: BN = bob_assets_before[2];
	[first_asset_amount, second_asset_amount] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, liquidity_asset_amount);
	let liquidity_asset_amount_excess = liquidity_asset_amount.mul(new BN(105)).div(new BN(100));

  console.info("Bob: attempting to burn more liquidity than they have " + liquidity_asset_amount_excess + " from pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, user.address);
  burnLiquidity(user, firstAssetId, secondAssetId, liquidity_asset_amount_excess);
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
	expect(eventResponse.data).toEqual(2);

	// console.info(first_asset_amount.toString());
	// console.info(second_asset_amount.toString());
	// console.info(liquidity_assets_burned.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

  	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = alice;
	liquidity_assets_burned = alice_assets_before[2];
	[first_asset_amount, second_asset_amount] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, liquidity_assets_burned);

  console.info("Alice: burning all liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, user.address);
  burnLiquidity(user, firstAssetId, secondAssetId, liquidity_assets_burned);
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	// console.info(first_asset_amount.toString());
	// console.info(second_asset_amount.toString());
	// console.info(liquidity_assets_burned.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	alice_assets_before[0].add(first_asset_amount),	alice_assets_before[1].add(second_asset_amount),	alice_assets_before[2].sub(liquidity_assets_burned)	])
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(first_asset_amount),	pallet_assets_before[1].sub(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(first_asset_amount),	pool_balance_before[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.sub(liquidity_assets_burned))
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = bob;
	liquidity_assets_burned = bob_assets_before[2];
	[first_asset_amount, second_asset_amount] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, liquidity_assets_burned);
	liquidity_assets_burned_excess = liquidity_assets_burned.mul(new BN(105)).div(new BN(100));

	console.info("Bob: owning 100% of the pool, attempting to burn more liquidity than then pool has " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, user.address);
  burnLiquidity(user, firstAssetId, secondAssetId, liquidity_assets_burned_excess);
  eventResponse = await eventPromise;
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toEqual(2);

	// console.info(first_asset_amount.toString());
	// console.info(second_asset_amount.toString());
	// console.info(liquidity_assets_burned.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = bob;
	liquidity_assets_burned = bob_assets_before[2];
	[first_asset_amount, second_asset_amount] = await calcuate_burn_liquidity_price_local(firstAssetId, secondAssetId, liquidity_assets_burned);

  console.info("Bob: burning all liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, user.address);
  burnLiquidity(user, firstAssetId, secondAssetId, liquidity_assets_burned);
  eventResponse = await eventPromise;
	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

	// console.info(first_asset_amount.toString());
	// console.info(second_asset_amount.toString());
	// console.info(liquidity_assets_burned.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	([	bob_assets_before[0].add(first_asset_amount),	bob_assets_before[1].add(second_asset_amount),	bob_assets_before[2].sub(liquidity_assets_burned)	])
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	([	pallet_assets_before[0].sub(first_asset_amount),	pallet_assets_before[1].sub(second_asset_amount)	])
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	([	pool_balance_before[0].sub(first_asset_amount),	pool_balance_before[1].sub(second_asset_amount)	])
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before.sub(liquidity_assets_burned))
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = bob;
	liquidity_asset_amount = new BN(10000);

	console.info("Bob: attempting to burn liquidity from 0 liquidity pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = getUserEventResult("xyk", "LiquidityBurned", 14, user.address);
  burnLiquidity(user, firstAssetId, secondAssetId, liquidity_asset_amount);
  eventResponse = await eventPromise;
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toEqual(3);

	// console.info(first_asset_amount.toString());
	// console.info(second_asset_amount.toString());
	// console.info(liquidity_assets_burned.toString());

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = bob;
	amount = new BN(30000);

  console.info("Bob: attempting to sell asset from 0 liquidity pool " + firstAssetId + ", buying asset " + secondAssetId);
	let soldAssetId = firstAssetId;
	let boughtAssetId = secondAssetId;
  eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, user.address);
  sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0));
  eventResponse = await eventPromise;
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toEqual(3);

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = bob;
	amount = new BN(20000);
	console.info("Bob: attempting to sell asset from 0 liquidity pool " + secondAssetId + ", buying asset " + firstAssetId);
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, user.address);
  sellAsset(user, soldAssetId, boughtAssetId, amount, new BN(0));
  	eventResponse = await eventPromise;
  	expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  	expect(eventResponse.data).toEqual(3);

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = bob;
	amount = new BN(10000);

  console.info("Bob: attempting to buy asset from 0 liquidity pool " + secondAssetId + ", selling asset " + firstAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, user.address);
  buyAsset(user, soldAssetId, boughtAssetId, amount, new BN(1000000));
 eventResponse = await eventPromise;
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toEqual(3);

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();

	alice_assets_before = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(alice_assets_before.toString());
	bob_assets_before = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	// console.info(bob_assets_before.toString());
	pallet_assets_before = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	// console.info(pallet_assets_before.toString());
	pool_balance_before = await getBalanceOfPool(firstAssetId, secondAssetId);
	// console.info(pool_balance_before.toString());
	total_liquidity_assets_before = await getAssetSupply(liquidity_asset_id);
	// console.info(total_liquidity_assets_before.toString());


	user = bob;
	amount = new BN(20000);

  console.info("Bob: attempting to buy asset from 0 liquidity pool " + firstAssetId + ", selling asset " + secondAssetId);
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, user.address);
  buyAsset(user, soldAssetId, boughtAssetId, amount, new BN(1000000));
  eventResponse = await eventPromise;
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toEqual(3);

	alice_assets = await getUserAssets(alice.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(alice_assets_before)
	.toEqual(alice_assets);
	// console.info(alice_assets.toString());
	bob_assets = await getUserAssets(bob.address, [firstAssetId, secondAssetId, liquidity_asset_id]);
	expect	(bob_assets_before)
	.toEqual(bob_assets);
	// console.info(bob_assets.toString());
	pallet_assets = await getUserAssets(pallet_address, [firstAssetId, secondAssetId]);
	expect	(pallet_assets_before)
	.toEqual(pallet_assets);
	// console.info(pallet_assets.toString());
	pool_balance = await getBalanceOfPool(firstAssetId, secondAssetId);
	expect	(pool_balance_before)
	.toEqual(pool_balance);
	// console.info(pool_balance.toString());
	total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	expect(total_liquidity_assets_before)
	.toEqual(total_liquidity_assets);
	// console.info(total_liquidity_assets.toString());

	await waitNewBlock();


});

test('xyk-pallet: dummy', async () => {
	expect(true).toEqual(true);
});
