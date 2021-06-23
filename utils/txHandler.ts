import { SubmittableExtrinsic, } from '@polkadot/api/types'
import { AnyJson } from '@polkadot/types/types';
import { getApi } from './api'
import { GenericExtrinsic, GenericEvent } from '@polkadot/types'
import { KeyringPair } from '@polkadot/keyring/types';
import xoshiro from 'xoshiro';
import BN from 'bn.js'
import { SudoDB } from './SudoDB';
import { env } from 'process';
import { EventResult, ExtrinsicResult } from './eventListeners';
const DEFAULT_TIME_OUT_MS = 1500000;

export async function getCurrentNonce(account?: string) {
  const api = getApi()
  if (account) {
    const { nonce } = await api.query.system.account(account)
    //console.log('currentNonce', nonce.toNumber())
    //   setNonce(nonce.toNumber())
    return nonce.toNumber()
  }
 // console.log('currentNonce', -1)
  return -1
}

export async function getBalanceOfAsset(assetId: BN, account: any ) {
  const api = getApi()
 
    const balance = await api.query.assets.balances([assetId, account.address])

    console.log(account.address + ' asset ' + assetId + " balance: " + balance.toString())

    return balance.toString()
  
}

export async function getBalanceOfPool(assetId1: BN, assetId2: BN ) {
  const api = getApi()
 
    const balance1 = await api.query.xyk.pools([assetId1, assetId2])
    const balance2 = await api.query.xyk.pools([assetId2, assetId1])

    console.log("pool " + assetId1 + "-" + assetId2 + " has balance of "+ balance1 +  "-" + balance2)

    return [balance1,balance2]
  
}

export async function getSudoKey() {
  const api = getApi();

  const sudoKey = await api.query.sudo.key();

  return sudoKey
}

export const getNextAssetId = async () => {
  const api = getApi();
  const asset_id = await api.query.tokens.nextCurrencyId();
  return new BN(asset_id.toString());
}

export const sudoIssueAsset = async (account: KeyringPair, total_balance: BN, target: any)
: Promise<GenericEvent[]> => {
  const nonce = await SudoDB.getInstance().getSudoNonce(account.address);
  console.info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);

  const api = getApi();
  return signAndWaitTx(
		api.tx.sudo.sudo(
    	api.tx.tokens.create(target, total_balance)
		),
    account,
    nonce
  )
}

export const transferAssets = async (from: any, to: any, asset_id: BN, amount: BN, nonce:number)
: Promise<GenericEvent[]> => {
  const api = getApi();
  return signAndWaitTx(
		api.tx.tokens.transfer(to, asset_id, amount),
        from,
        nonce
		)
}

/**
 * shuffles input array in place using Fisher-Yates shuffling algorithm. Xoshiro-256+ 
 * is used as the source of of pseudo random number generator
 * @param objects - input array
 * @param seed - 32 bytes long seed for pseudo random number generator
 */
function fisher_yates_shuffle<K>(objects: K[], seed: Uint8Array)
{
    const prng = xoshiro.create('256+', seed);
    for(var i=objects.length-1; i>0; i--){
        var j = prng.roll() % i; 
        var tmp = objects[i];
        objects[i] = objects[j];
        objects[j] = tmp;
    } 
}

function recreateExtrinsicsOrder(extrinsics: GenericExtrinsic[], seed_bytes: Uint8Array){
    var slots = extrinsics.map((ev) => {
        if (ev.isSigned) {
            return ev.signer.toString();
        }else{
            return "None";
        }
    })

    fisher_yates_shuffle(slots, seed_bytes);

    let map = new Map()

    for (var e of extrinsics) {
        let who = "None";
        if (e.isSigned){
            who = e.signer.toString();
        }

        if (map.has(who)){
            map.get(who).push(e)
        }else{
            map.set(who, [e])
        }
    }

    let shuffled_extrinsics = slots.map( (who) => {
        return map.get(who).shift();
    });
    return shuffled_extrinsics;
}

export const signAndWaitTx = async (
  tx: SubmittableExtrinsic<'promise'>,
  who: any,
  nonce: number,
  timeout_ms: number = DEFAULT_TIME_OUT_MS
): Promise<GenericEvent[]> => {
  return new Promise<GenericEvent[]>(async (resolve, reject) => {

  const api = getApi()
  let result: GenericEvent[] = [];

  if (timeout_ms > 0){
      setTimeout(() => {
      reject("timeout in - signAndWaitTx - " + who.address + " - " + nonce + " - " + tx.toHuman()?.toString())
      }, timeout_ms);
  }

  const unsub = await tx.signAndSend(who, { nonce }, async ({ events = [], status }) => {
    //console.warn(status);
    if (status.isInBlock) {
            const unsub_new_heads = await api.derive.chain.subscribeNewHeads(async (lastHeader) => {
                if (lastHeader.parentHash.toString() === status.asInBlock.toString()){
                    unsub_new_heads()
                    let prev_block_extrinsics = (await api.rpc.chain.getBlock(lastHeader.parentHash)).block.extrinsics;
                    let curr_block_extrinsics = (await api.rpc.chain.getBlock(lastHeader.hash)).block.extrinsics;
                    let curr_block_events = await api.query.system.events.at(lastHeader.hash);

                    let extrinsic_with_seed = curr_block_extrinsics.find( e => { return e.method.method === "set" && e.method.section === "random" });
                    if(!extrinsic_with_seed){
                        return;
                    }

                    var json_response = JSON.parse(extrinsic_with_seed.method.args[0].toString())
                    const seed_bytes = Uint8Array.from(Buffer.from(json_response["seed"].substring(2), 'hex'));
                    let shuffled_extrinsics = recreateExtrinsicsOrder(prev_block_extrinsics, seed_bytes);

                    // filter extrinsic triggered by current request
                    let index = shuffled_extrinsics.findIndex( e => {return e.isSigned && e.signer.toString() === who.address && e.nonce.toString() === nonce.toString();});
                    if (index < 0) {
                        return;
                    }
                    

                    let req_events = curr_block_events.filter(event => {
                        return event.phase.isApplyExtrinsic && event.phase.asApplyExtrinsic.toNumber() === index;
                    }).map( ({ phase, event }) => {
                        return event;
                    });
                    console.info(
                            `W[${env.JEST_WORKER_ID}]` +
                             "--block - no " + lastHeader.number +
                             " \n --curr_block " + JSON.stringify(curr_block_events.toJSON()) + 
                             " \n --curr_block[toHuman]: " + curr_block_events.map( ({event}) => {return event} ).map( e => JSON.stringify(e.toHuman()) + JSON.stringify(e.toHuman().data) ).toString() +
                             " \n --req_events " + req_events.toString() + 
                             " \n --index: " + index +
                             " \n --who.address: " + who.address +
                             " \n --nonce: " + nonce.toString() + 
                             " \n --toHuman: " + req_events.map( e => JSON.stringify(e.toHuman()) + JSON.stringify(e.toHuman().data) ).toString()
                    );
                    result = result.concat(req_events);
                }
            });

        }else if (status.isFinalized) {
            unsub();
            // resolve only if transaction has been finalized
            console.info(
              `RESULT W[${env.JEST_WORKER_ID}]` +
               " \n --req_events " + result.toString() + 
               " \n --who.address: " + who.address +
               " \n --nonce: " + nonce.toString() + 
               " \n --toHuman: " + result.map( e => JSON.stringify(e.toHuman()) + JSON.stringify(e.toHuman().data) ).toString()
            );
            resolve(result)
        }
    });
  })
}
// From the events that a waitForTx, create an EventResponse filtering by search term or by extrinsic results.
export const getEventResultFromTxWait = function(relatedEvents :GenericEvent[], searchTerm : string [] = []) : EventResult{
  const extrinsicResultMethods = ['ExtrinsicSuccess', 'ExtrinsicFailed', 'ExtrinsicUndefined'];
  let extrinsicResult;
  if(searchTerm.length > 0) {
    extrinsicResult = relatedEvents.find( e => e.toHuman().method !== null && 
                                          searchTerm.every( filterTerm => (
                                              JSON.stringify(e.toHuman()) 
                                            + JSON.stringify(e.toHuman().data))
                                            .includes(filterTerm)) 
                                          );
  }else {

    extrinsicResult = relatedEvents.find( e => e.toHuman().method !== null && 
                                                extrinsicResultMethods.includes(e.toHuman().method!.toString()) );
  }

  if(extrinsicResult){
    const eventResult =  extrinsicResult.toHuman();
    switch (eventResult.method) {
      case extrinsicResultMethods[1]:
        const data = eventResult.data as AnyJson[];
        const error = JSON.stringify(data[0]);
        const errorNumber = JSON.parse(error).Module.error;
        return new EventResult(ExtrinsicResult.ExtrinsicFailed, parseInt(errorNumber));
    
      case extrinsicResultMethods[2]:
        return new EventResult(ExtrinsicResult.ExtrinsicUndefined, eventResult.data)
      
      default:
        return new EventResult(ExtrinsicResult.ExtrinsicSuccess, eventResult.data)

    }

  }
  console.error(`W[${env.JEST_WORKER_ID}]` + relatedEvents + "<-found  --- Expected \n --->>" + searchTerm.toString() 
    + "\n toHumanStr " + relatedEvents.map( e => JSON.stringify(e.toHuman()) + JSON.stringify(e.toHuman().data) ).toString())
  return new EventResult(-1, 'ERROR: NO TX FOUND');
}

/// Do a Tx and expect a success. Good for setups.
export async function signSendAndWaitToFinishTx( fun : SubmittableExtrinsic<'promise'> | undefined, account : KeyringPair ){
  const nonce = await getCurrentNonce(account.address);
  const result = await signAndWaitTx(
    fun!,
    account,
    nonce
  ).then( result => {
      return getEventResultFromTxWait(result)
  });
  expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  return result;
  
}
