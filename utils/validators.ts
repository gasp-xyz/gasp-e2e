import BN from "bn.js";
import { EventResult, ExtrinsicResult } from "./eventListeners";
import { User } from "./User";

export function validateTransactionSucessful(eventResult: EventResult, tokensAmount: number, user : User) {
	expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
	expect(eventResult.data[1]).toEqual(user.keyRingPair.address);
	expect(eventResult.data[2]).toEqual(tokensAmount);
}