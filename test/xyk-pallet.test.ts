import {getApi, initApi} from "../utils/api";
import { getCurrentNonce, signTx, getBalanceOfAsset, getBalanceOfPool, getNextAssetId, getLiquidityAssetId, getAssetSupply, balanceTransfer, getSudoKey, sudoIssueAsset, transferAsset, createPool, sellAsset, buyAsset, mintLiquidity, burnLiquidity} from '../utils/tx'
import {waitNewBlock, expectEvent} from '../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {sleep} from "../utils/utils";


test('xyk-pallet: Happy case scenario', async () => {
	jest.setTimeout(3000000);
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

	let sudoKey = await getSudoKey();
	let sudoPair = keyring.getPair(sudoKey.toString());

	let eventPromise;
	let eventResponse;
	let error;



	// Sudo requies alice as key.
	console.log("Alice: issuing asset " + firstAssetId);
	eventPromise = expectEvent("assets","Issued",12);
	sudoIssueAsset(sudoPair, new BN(220000), alice.address);
	[eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Alice: issuing asset " + secondAssetId);
  eventPromise = expectEvent("assets","Issued",12);
  sudoIssueAsset(sudoPair, new BN(120000), alice.address);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

  await waitNewBlock();

  console.log("Alice: creating pool " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk","PoolCreated",14);
  createPool(alice, firstAssetId, new BN(50000), secondAssetId, new BN(50000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Alice: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityMinted",14);
  mintLiquidity(alice, firstAssetId, secondAssetId, new BN(30000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

  await waitNewBlock();

	console.log("Alice: transfering asset " + firstAssetId + " to Bob");
	eventPromise = expectEvent("assets", "Transferred",12);
	transferAsset(alice, firstAssetId, bob.address, new BN(100000));
	[eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Bob: selling asset " + firstAssetId + ", buying asset " + secondAssetId);
	let soldAssetId = firstAssetId;
	let boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped",14);
  sellAsset(bob, soldAssetId, boughtAssetId, new BN(30000), new BN(0));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Bob: selling asset " + secondAssetId + ", buying asset " + firstAssetId);
	soldAssetId = secondAssetId;
	boughtAssetId = firstAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped",14);
  sellAsset(bob, soldAssetId, boughtAssetId, new BN(20000), new BN(0));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Bob: buying asset " + secondAssetId + ", selling asset " + firstAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped",14);
  buyAsset(bob, soldAssetId, boughtAssetId, new BN(10000), new BN(1000000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Bob: buying asset " + firstAssetId + ", selling asset " + secondAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped",14);
  buyAsset(bob, soldAssetId, boughtAssetId, new BN(20000), new BN(1000000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');

	await waitNewBlock();

  console.log("Alice: burning liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned",14);
  burnLiquidity(alice, firstAssetId, secondAssetId, new BN(20000));
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');


	await waitNewBlock();

  console.log("Alice: burning all liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityBurned",14);
	// getLiquidityAssetId(firstAssetId, secondAssetId) order of assets must be the same as in create pool
	let liquidity_asset_id = new BN(await getLiquidityAssetId(firstAssetId, secondAssetId));
	let alice_liquidity_assets = await getBalanceOfAsset(liquidity_asset_id, alice);
	let total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
	let [total_firstAsset_reserve,] = await getBalanceOfPool(firstAssetId, secondAssetId);
	let firstAsset_amount = alice_liquidity_assets * total_firstAsset_reserve / total_liquidity_assets;
  burnLiquidity(alice, firstAssetId, secondAssetId, firstAsset_amount);
  [eventResponse,] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicSuccess');
	alice_liquidity_assets = parseInt(await getBalanceOfAsset(liquidity_asset_id, alice));
	total_liquidity_assets = parseInt(await getAssetSupply(liquidity_asset_id));
	expect(alice_liquidity_assets).toEqual(0);
	expect(total_liquidity_assets).toEqual(0);

	await waitNewBlock();

  console.log("Bob: minting liquidity " + firstAssetId + " - " + secondAssetId);
  eventPromise = expectEvent("xyk", "LiquidityMinted",14);
  mintLiquidity(bob, firstAssetId, secondAssetId, new BN(10000));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);

	await waitNewBlock();

  console.log("Alice: selling asset " + firstAssetId + ", buying asset " + secondAssetId);
	soldAssetId = firstAssetId;
	boughtAssetId = secondAssetId;
  eventPromise = expectEvent("xyk", "AssetsSwapped",14);
  sellAsset(alice, soldAssetId, boughtAssetId, new BN(3000), new BN(0));
  [eventResponse, error] = await eventPromise;
	expect(eventResponse).toEqual('ExtrinsicFailed');
	expect(error).toEqual(3);


});
