import BN from "bn.js";
import { EventResult, ExtrinsicResult } from "./eventListeners";
import { User } from "./User";

export function validateTransactionSucessful(eventResult: EventResult, tokensAmount: number, user : User) {
	expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
	expect(eventResult.data[1]).toEqual(user.keyRingPair.address);
	expect(eventResult.data[2]).toEqual(tokensAmount);
}

export function validateEmptyAssets(assets : BN[]){
	assets.forEach( asset => expect(asset.toString()).toEqual('0') );
}

export function validateAssetsWithValues(assets : BN[], values : number []){
	for (let idx = 0; idx < values.length; idx++) {
		expect(assets[idx].toString()).toEqual(values[idx].toString())
		
	}
	expect(assets).toHaveLength(values.length);
}