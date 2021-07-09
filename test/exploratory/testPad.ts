import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import {getApi, initApi} from "../../utils/api";
import { getCurrentNonce, signAndWaitTx } from "../../utils/txHandler";
import { User } from "../../utils/User";
import {AccountData} from '@polkadot/types/interfaces/balances'

require('dotenv').config()


export const main = async () => {
  console.log('main start')

  try {
    getApi();
  } catch(e) {
    await initApi('ws://127.0.0.1:9944')
  }
  const firstAssetId = new BN(16);
  const secondAssetId = new BN(17);
  
  const keyring = new Keyring({ type: 'sr25519' });
  const testUser1 = new User(keyring, '//testUser_120c053b-697e-4538-94cb-39b92c4b650e');
  keyring.addPair(testUser1.keyRingPair);
  
  const MAX_BALANCE = new BN('340282366920938463463374607431768211455'); //max balance
  const api = getApi();
  const nonce = await getCurrentNonce(testUser1.keyRingPair.address);
  //const txResult = await signAndWaitTx(
  //  api.tx.xyk.burnLiquidity(firstAssetId, secondAssetId, MAX_BALANCE.sub(new BN(1001))),
  //  testUser1.keyRingPair,
  //nonce
  //)
  let balance = await api.query.tokens.accounts(testUser1.keyRingPair.address, secondAssetId);
  let accountData = (balance as AccountData);
	console.info("soldAssetBalanceBefore " + accountData.free.toBigInt().toString())
  
  balance = await api.query.tokens.accounts(testUser1.keyRingPair.address, firstAssetId);
  accountData = (balance as AccountData);
	console.info("boughtAssetBalanceBefore " + accountData.free.toBigInt().toString())

  const txResult = await signAndWaitTx(
    api.tx.xyk.sellAsset(secondAssetId, firstAssetId, new BN(100), new BN(1)),
    testUser1.keyRingPair,
    nonce
  )
  console.info(txResult);

  balance = await api.query.tokens.accounts(testUser1.keyRingPair.address, secondAssetId);
  accountData = (balance as AccountData);
  console.info("soldAssetBalanceAfter "+ accountData.free.toBigInt().toString())

  balance = await api.query.tokens.accounts(testUser1.keyRingPair.address, firstAssetId);
  accountData = (balance as AccountData);
	console.info("boughtAssetBalanceAfter " + accountData.free.toBigInt().toString())

return txResult;

}


main().then(() => {
  console.log('end')
  process.exit(0)
})
