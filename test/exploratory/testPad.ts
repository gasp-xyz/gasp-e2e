import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import {getApi, initApi} from "../../utils/api";
import { getCurrentNonce, signAndWaitTx } from "../../utils/txHandler";
import { User } from "../../utils/User";

require('dotenv').config()


export const main = async () => {
  console.log('main start')

  try {
    getApi();
  } catch(e) {
    await initApi('ws://127.0.0.1:9944')
  }
  //const userAddress = "5G8jfZFLNojTbJ3Xmpw4YxXdm4UYZRWY9a7NkS2PM9PhQmjB";
  const firstAssetId = new BN(6);
  const secondAssetId = new BN(7);
  
  const keyring = new Keyring({ type: 'sr25519' });
  const testUser1 = new User(keyring, '//testUser_05c5e4da-cfc2-499a-9451-15036b83bc9b');
  keyring.addPair(testUser1.keyRingPair);
  
  const MAX_BALANCE = new BN('340282366920938463463374607431768211455'); //max balance
  const api = getApi();
  const nonce = await getCurrentNonce(testUser1.keyRingPair.address);
  const txResult = await signAndWaitTx(
    api.tx.xyk.burnLiquidity(firstAssetId, secondAssetId, MAX_BALANCE.sub(new BN(1001))),
    testUser1.keyRingPair,
  nonce
)
console.info(txResult);

return txResult;

}


main().then(() => {
  console.log('end')
  process.exit(0)
})
