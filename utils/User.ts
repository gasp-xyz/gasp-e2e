
import { Keyring } from '@polkadot/api';
import { KeyringInstance, KeyringPair, KeyringPair$Json, KeyringPair$JsonEncodingTypes, KeyringPair$Meta, KeyringOptions } from '@polkadot/keyring/types';
import BN from 'bn.js';
import { getuid } from 'process';
import { v4 as uuid } from 'uuid';
import { ExtrinsicResult, getEventResult, waitNewBlock } from './eventListeners';
import { balanceTransfer, buyAsset, createPool, getUserAssets, sellAsset } from './tx';

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
        this.assets = [];
    }

    addFromAddress(keyring : Keyring, address : string){
        this.keyRingPair = keyring.addFromAddress(address);
        this.name = 'addres_created_account';
    }

    validateWalletReduced(currencyId: BN, amount: BN){
        const diffFromWallet = this.getAsset(currencyId).amountBefore.sub(amount);
        expect(this.getAsset(currencyId).amountAfter).toEqual(diffFromWallet);
    }
    validateWalletIncreased(currencyId: BN, amount: BN){
        const addFromWallet = this.getAsset(currencyId).amountBefore.add(amount);
        expect(this.getAsset(currencyId).amountAfter).toEqual(addFromWallet);
    }

    validateWalletsUnmodified(){
        this.assets.forEach( asset => {
            expect(asset.amountBefore).toEqual(asset.amountAfter);
        });
    };

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

    async buyAssets( soldAssetId: BN, boughtAssetId: BN, amount: BN, maxExpected = new BN(1000000)) {
        const eventPromise = getEventResult("xyk", "AssetsSwapped", 14);
        buyAsset(this.keyRingPair, soldAssetId, boughtAssetId, amount, maxExpected);
        const eventResult = await eventPromise;
        expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        await waitNewBlock();
    }
    
    async transferAssets(soldAssetId : BN, boughtAssetId: BN ,amount: BN) {
    
        const eventPromise = getEventResult("xyk", "AssetsSwapped", 14);
        sellAsset(this.keyRingPair, soldAssetId, boughtAssetId, amount, new BN(0));
        const eventResponse = await eventPromise;
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        await waitNewBlock();
    }
    
    async createPoolToAsset(first_asset_amount: BN, second_asset_amount: BN, firstCurrency: BN, secondCurrency : BN) {
        console.log("creating pool " + firstCurrency + " - " + secondCurrency);
        var eventPromise = getEventResult("xyk", "PoolCreated", 14);
        createPool(this.keyRingPair, firstCurrency, first_asset_amount, secondCurrency, second_asset_amount);
        var eventResponse = await eventPromise;
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        await waitNewBlock();
    }

    async addBalance(user : string = '//Alice', amount : number = Math.pow(10,11)){
        var eventPromise = getEventResult("balances","Endowed", 14);
        await balanceTransfer(new User(this.keyring, user).keyRingPair,this.keyRingPair.address, amount);
        var result = await eventPromise;
        eventPromise = getEventResult("balances","Transfer", 14);
        result = await eventPromise;
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