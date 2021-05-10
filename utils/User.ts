
import { Keyring } from '@polkadot/api';
import { KeyringInstance, KeyringPair, KeyringPair$Json, KeyringPair$JsonEncodingTypes, KeyringPair$Meta, KeyringOptions } from '@polkadot/keyring/types';
import BN from 'bn.js';
import { getuid } from 'process';
import { v4 as uuid } from 'uuid';
import { getEventResult } from './eventListeners';
import { balanceTransfer, getUserAssets } from './tx';

export class User {

    /**
     * class that represent the user and wallet.
     */
    keyRingPair : KeyringPair;
    name : String;
    keyring :Keyring;
    assets : Asset [];
    
    constructor(keyring : Keyring ,name = '') {
        if(!name){
            name = '//testUser_' + uuid();
        }
        this.name = name;
        this.keyring = keyring;
        this.keyRingPair = keyring.createFromUri(name); 
        console.warn(`User  ${name} :created: ${this.keyRingPair.address} `);
        this.assets = [];
    }

    addFromAddress(keyring : Keyring, address : string){
        this.keyRingPair = keyring.addFromAddress(address);
        this.name = 'addres_created_account';
    }

    async addBalance(){
        var eventPromise = getEventResult("balances","Endowed", 14);
        await balanceTransfer(new User(this.keyring,'//Alice').keyRingPair,this.keyRingPair.address,Math.pow(10,11));
        var result = await eventPromise;
        eventPromise = getEventResult("balances","Transfer", 14);
        result = await eventPromise;
    }

    async validateWalletReduced(currencyId: BN, amount: BN){
        const diffFromWallet = this.getAsset(currencyId).amountBefore.sub(amount);
        expect(this.getAsset(currencyId).amountAfter).toEqual(diffFromWallet);
    }
    async validateWalletIncreased(currencyId: BN, amount: BN){
        const addFromWallet = this.getAsset(currencyId).amountBefore.add(amount);
        expect(this.getAsset(currencyId).amountAfter).toEqual(addFromWallet);
    }

    async validateLiquidity(userLiquidityWalletId : BN, liquidityAmount: any){
        const liquiditySum = this.getAsset(userLiquidityWalletId).amountBefore.add(liquidityAmount);
        expect(this.getAsset(userLiquidityWalletId).amountAfter).toEqual(liquiditySum);
    }

    async validateCurrencies(firstCurrency :  any, secondCurrency : any,liquidityUserWallet : any, liquidity : any, transactionAmount : any) {

        const diffFromWallet = this.getAsset(firstCurrency).amountBefore.sub(transactionAmount);
        const diffToWallet = this.getAsset(secondCurrency).amountBefore.sub(this.getAsset(secondCurrency).amountAfter);
        const liquiditySum = this.getAsset(liquidityUserWallet).amountBefore.add(liquidity);
        expect	( [diffFromWallet,diffToWallet,liquiditySum ])
        .toEqual( [this.getAsset(firstCurrency).amountAfter , this.getAsset(secondCurrency).amountAfter, this.getAsset(liquidityUserWallet).amountAfter ] );
    }

    addAsset(currecncyId, amountBefore = new BN(0)){
        const asset = new Asset(currecncyId, amountBefore);
        if(this.assets.find( asset => asset.currencyId === currecncyId) === undefined){
            this.assets.push(asset);
        }
    }
    addAssets(currencyIds :any[]){
        currencyIds.forEach(element => {
            this.addAsset(element);
        });
    }
    getAsset(currecncyId){
        return this.assets.find( asset => asset.currencyId === currecncyId);
    }
    async refreshAmounts(beforeOrAfter : AssetWallet = AssetWallet.BEFORE){
        var currencies = this.assets.map( asset => new BN(asset.currencyId));
        var assetValues = await getUserAssets(this.keyRingPair.address, currencies);
        
        for (let index = 0; index < this.assets.length; index++) {
            const asset = this.assets[index];
            if(beforeOrAfter === AssetWallet.BEFORE)
                this.assets[index].amountBefore = assetValues[index];
            else
                this.assets[index].amountAfter = assetValues[index];
        }
    }

    validateWalletsUnmodified(){
        this.assets.forEach( asset => {
            expect(asset.amountBefore).toEqual(asset.amountAfter);
        });
    }

}

export class Asset{
    amountBefore : BN;
    amountAfter : BN ;
    currencyId : BN;

    /**
     *
     */
    constructor(currencyId : BN, amountBefore = new BN(0), amountAfter = new BN(0)) {
        this.currencyId = currencyId;
        this.amountBefore = amountBefore;
        this.amountAfter = amountAfter;
    }


}

export enum AssetWallet
{
    BEFORE,
    AFTER
}