import { formatBalance} from "@polkadot/util/format";
import BN from "bn.js";
import { getApi } from "./api";
import { assert } from "console";
import { waitNewBlock } from "./eventListeners";
import { Assets } from "./Assets";
import { signSendAndWaitToFinishTx } from "./txHandler";
import { User } from "./User";


export function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

export function fromBNToUnitString(value : BN){
    const api = getApi();
    const decimals = api?.registry.chainDecimals;
    const valueFormatted = formatBalance(value, {decimals:decimals})
    return valueFormatted;
}

export function getEnvironmentRequiredVars(){
    const palletAddress = process.env.TEST_PALLET_ADDRESS ? process.env.TEST_PALLET_ADDRESS : '';
    const sudoUserName = process.env.TEST_SUDO_NAME ? process.env.TEST_SUDO_NAME : '';
    assert(palletAddress.length !== 0, "PALLET ADDRESS NOT FOUND AS GLOBAL ENV")
    assert(sudoUserName.length !== 0, "SUDO USERNAME NOT FOUND AS GLOBAL ENV")
    // expect(palletAddress.length).not.toEqual(0);
    // expect(sudoUserName.length).not.toEqual(0);
    const uri = process.env.API_URL ? process.env.API_URL: 'ws://127.0.0.1:9944';
    return {pallet: palletAddress, sudo: sudoUserName, chainUri:uri};
}

export async function UserCreatesAPoolAndMintliquidity(
	testUser1: User, sudo: User
	, userAmount : BN 
	, poolAmount : BN = new BN(userAmount).div(new BN(2))
	, mintAmount: BN = new BN(userAmount).div(new BN(4))) {

	await waitNewBlock();
    const api = getApi();
	const [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [parseInt(userAmount.toString()), parseInt(userAmount.toString())], sudo);
	await testUser1.setBalance(sudo);
	await signSendAndWaitToFinishTx(
		api?.tx.xyk.createPool(firstCurrency, poolAmount, secondCurrency, poolAmount),
		testUser1.keyRingPair
	);
	await waitNewBlock();
	await testUser1.mintLiquidity(firstCurrency, secondCurrency, mintAmount);
	return [firstCurrency, secondCurrency];
}