import {getApi, initApi} from "../utils/api";
import { getCurrentNonce, signTx, getBalanceOfAsset, getBalanceOfPool, getNextAssetId, getLiquidityAssetId, getAssetSupply, balanceTransfer, getSudoKey, sudoIssueAsset, transferAsset, createPool, sellAsset, buyAsset, mintLiquidity, burnLiquidity} from '../utils/tx'
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

	await waitNewBlock();

  console.log("Sudo: issuing asset " + secondAssetId + " to Alice");
  eventPromise = expectEvent("assets","Issued", 12);
  sudoIssueAsset(sudoPair, new BN(120000), alice.address);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

  await waitNewBlock();

  console.log("Alice: creating pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk","PoolCreated", 14);
  createPool(alice, firstAssetId, new BN(50000), secondAssetId, new BN(50000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Alice: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityMinted", 14);
  mintLiquidity(alice, firstAssetId, secondAssetId, new BN(30000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

  await waitNewBlock();

	console.log("Alice: transfering asset " + firstAssetId + " to Bob");
	eventPromise = expectEvent("assets", "Transferred", 12);
	transferAsset(alice, firstAssetId, bob.address, new BN(100000));
	[eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Bob: selling asset " + firstAssetId + ", buying asset " + secondAssetId);
	var soldAssetId = firstAssetId;
	var boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  sellAsset(bob, soldAssetId, boughtAssetId, new BN(30000), new BN(0));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Bob: selling asset " + secondAssetId + ", buying asset " + firstAssetId);
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  sellAsset(bob, soldAssetId, boughtAssetId, new BN(20000), new BN(0));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Bob: buying asset " + secondAssetId + ", selling asset " + firstAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  buyAsset(bob, soldAssetId, boughtAssetId, new BN(10000), new BN(1000000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Bob: buying asset " + firstAssetId + ", selling asset " + secondAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  buyAsset(bob, soldAssetId, boughtAssetId, new BN(20000), new BN(1000000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Alice: burning liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
  burnLiquidity(alice, firstAssetId, secondAssetId, new BN(20000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');


	await waitNewBlock();

  console.log("Alice: burning all liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
	var user = alice;
	// getLiquidityAssetId(firstAssetId, secondAssetId) order of assets must be the same as in create pool
	var liquidity_asset_id = new BN(await getLiquidityAssetId(firstAssetId, secondAssetId));
	var user_liquidity_assets = await getBalanceOfAsset(liquidity_asset_id, user);
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	var [total_firstAsset_reserve,] = await getBalanceOfPool(firstAssetId, secondAssetId);
	var firstAsset_amount = user_liquidity_assets * total_firstAsset_reserve / total_liquidity_assets;
  burnLiquidity(user, firstAssetId, secondAssetId, firstAsset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');
	user_liquidity_assets = parseInt(await getBalanceOfAsset(liquidity_asset_id, user));
	total_liquidity_assets = parseInt(await getAssetSupply(liquidity_asset_id));
	expect(user_liquidity_assets).toEqual(0);
	expect(total_liquidity_assets).toEqual(0);

	await waitNewBlock();

  console.log("Bob: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityMinted", 14);
  mintLiquidity(bob, firstAssetId, secondAssetId, new BN(10000));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	await waitNewBlock();

  console.log("Alice: selling asset " + firstAssetId + ", buying asset " + secondAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  sellAsset(alice, soldAssetId, boughtAssetId, new BN(3000), new BN(0));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

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

	await waitNewBlock();

  console.log("Sudo: issuing asset " + secondAssetId + " to Alice");
  eventPromise = expectEvent("assets","Issued", 12);
  sudoIssueAsset(sudoPair, new BN(200000), alice.address);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

	console.log("Alice: transfering asset " + firstAssetId + " to Bob");
	eventPromise = expectEvent("assets", "Transferred", 12);
	transferAsset(alice, firstAssetId, bob.address, new BN(100000));
	[eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

	console.log("Alice: transfering asset " + secondAssetId + " to Bob");
	eventPromise = expectEvent("assets", "Transferred", 12);
	transferAsset(alice, secondAssetId, bob.address, new BN(100000));
	[eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

  await waitNewBlock();

  console.log("Alice: creating pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk","PoolCreated", 14);
  createPool(alice, firstAssetId, new BN(60000), secondAssetId, new BN(60000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Alice: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityMinted", 14);
  mintLiquidity(alice, firstAssetId, secondAssetId, new BN(20000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Bob: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityMinted", 14);
  mintLiquidity(bob, firstAssetId, secondAssetId, new BN(80000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Alice: attempting to burn more liquidity than they have " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
	var user = alice;
	// getLiquidityAssetId(firstAssetId, secondAssetId) order of assets must be the same as in create pool
	var liquidity_asset_id = new BN(await getLiquidityAssetId(firstAssetId, secondAssetId));
	var user_liquidity_assets = await getBalanceOfAsset(liquidity_asset_id, user);
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	var [total_firstAsset_reserve,] = await getBalanceOfPool(firstAssetId, secondAssetId);
	var firstAsset_amount = user_liquidity_assets * total_firstAsset_reserve / total_liquidity_assets;
	var firstAsset_amount_excess = firstAsset_amount * 1.05;
  burnLiquidity(user, firstAssetId, secondAssetId, firstAsset_amount_excess);
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(2);

	await waitNewBlock();

  console.log("Bob: attempting to burn more liquidity than they have " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
	var user = bob;
	// getLiquidityAssetId(firstAssetId, secondAssetId) order of assets must be the same as in create pool
	var liquidity_asset_id = new BN(await getLiquidityAssetId(firstAssetId, secondAssetId));
	var user_liquidity_assets = await getBalanceOfAsset(liquidity_asset_id, user);
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	var [total_firstAsset_reserve,] = await getBalanceOfPool(firstAssetId, secondAssetId);
	var firstAsset_amount = user_liquidity_assets * total_firstAsset_reserve / total_liquidity_assets;
	var firstAsset_amount_excess = firstAsset_amount * 1.05;
  burnLiquidity(user, firstAssetId, secondAssetId, firstAsset_amount_excess);
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(2);

	await waitNewBlock();

  console.log("Alice: burning all liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
	var user = alice;
	// getLiquidityAssetId(firstAssetId, secondAssetId) order of assets must be the same as in create pool
	var liquidity_asset_id = new BN(await getLiquidityAssetId(firstAssetId, secondAssetId));
	var user_liquidity_assets = await getBalanceOfAsset(liquidity_asset_id, user);
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	var [total_firstAsset_reserve,] = await getBalanceOfPool(firstAssetId, secondAssetId);
	var firstAsset_amount = user_liquidity_assets * total_firstAsset_reserve / total_liquidity_assets;
  burnLiquidity(user, firstAssetId, secondAssetId, firstAsset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');
	user_liquidity_assets = parseInt(await getBalanceOfAsset(liquidity_asset_id, user));
	total_liquidity_assets = parseInt(await getAssetSupply(liquidity_asset_id));
	expect(user_liquidity_assets).toEqual(0);

	await waitNewBlock();

	console.log("Bob: owning 100% of the pool, attempting to burn more liquidity than then pool has " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
	var user = bob;
	// getLiquidityAssetId(firstAssetId, secondAssetId) order of assets must be the same as in create pool
	var liquidity_asset_id = new BN(await getLiquidityAssetId(firstAssetId, secondAssetId));
	var user_liquidity_assets = await getBalanceOfAsset(liquidity_asset_id, user);
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	var [total_firstAsset_reserve,] = await getBalanceOfPool(firstAssetId, secondAssetId);
	var firstAsset_amount = user_liquidity_assets * total_firstAsset_reserve / total_liquidity_assets;
	var firstAsset_amount_excess = firstAsset_amount * 1.05;
  burnLiquidity(user, firstAssetId, secondAssetId, firstAsset_amount_excess);
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(2);

	await waitNewBlock();

	console.log("Bob: burning all liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
	var user = bob;
	// getLiquidityAssetId(firstAssetId, secondAssetId) order of assets must be the same as in create pool
	var liquidity_asset_id = new BN(await getLiquidityAssetId(firstAssetId, secondAssetId));
	var user_liquidity_assets = await getBalanceOfAsset(liquidity_asset_id, user);
	var total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	var [total_firstAsset_reserve,] = await getBalanceOfPool(firstAssetId, secondAssetId);
	var firstAsset_amount = user_liquidity_assets * total_firstAsset_reserve / total_liquidity_assets;
  burnLiquidity(user, firstAssetId, secondAssetId, firstAsset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');
	user_liquidity_assets = parseInt(await getBalanceOfAsset(liquidity_asset_id, user));
	total_liquidity_assets = parseInt(await getAssetSupply(liquidity_asset_id));
	expect(user_liquidity_assets).toEqual(0);

	await waitNewBlock();

	console.log("Bob: attempting to burn liquidity from 0 liquidity pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned", 14);
	var user = bob;
  burnLiquidity(user, firstAssetId, secondAssetId, 10000);
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	await waitNewBlock();

  console.log("Bob: attempting to sell asset from 0 liquidity pool " + firstAssetId + ", buying asset " + secondAssetId);
	var soldAssetId = firstAssetId;
	var boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  sellAsset(bob, soldAssetId, boughtAssetId, new BN(30000), new BN(0));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	await waitNewBlock();

  console.log("Bob: attempting to sell asset from 0 liquidity pool " + secondAssetId + ", buying asset " + firstAssetId);
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  sellAsset(bob, soldAssetId, boughtAssetId, new BN(20000), new BN(0));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	await waitNewBlock();

  console.log("Bob: attempting to buy asset from 0 liquidity pool " + secondAssetId + ", selling asset " + firstAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  buyAsset(bob, soldAssetId, boughtAssetId, new BN(10000), new BN(1000000));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	await waitNewBlock();

  console.log("Bob: attempting to buy asset from 0 liquidity pool " + firstAssetId + ", selling asset " + secondAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped", 14);
  buyAsset(bob, soldAssetId, boughtAssetId, new BN(20000), new BN(1000000));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	await waitNewBlock();


});
