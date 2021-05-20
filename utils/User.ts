
import { Keyring } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import BN from 'bn.js';
import { v4 as uuid } from 'uuid';
import { ExtrinsicResult, getUserEventResult, waitNewBlock } from './eventListeners';
import { balanceTransfer, buyAsset, createPool, getAccountInfo, getUserAssets, sellAsset, setBalance } from './tx';

export enum AssetWallet
{
    BEFORE,
    AFTER
}

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
        const diffFromWallet = this.getAsset(currencyId)?.amountBefore!.sub(amount);
        expect(this.getAsset(currencyId)?.amountAfter!).toEqual(diffFromWallet);
    }
    validateWalletIncreased(currencyId: BN, amount: BN){
        const addFromWallet = this.getAsset(currencyId)?.amountBefore!.add(amount);
        expect(this.getAsset(currencyId)?.amountAfter!).toEqual(addFromWallet);
    }

    validateWalletsUnmodified(){
        this.assets.forEach( asset => {
            expect(asset.amountBefore).toEqual(asset.amountAfter);
        });
    };

    addAsset(currecncyId : any, amountBefore = new BN(0)){
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
    getAsset(currecncyId : any){
        return this.assets.find( asset => asset.currencyId === currecncyId);
    }
    async refreshAmounts(beforeOrAfter : AssetWallet = AssetWallet.BEFORE){
        let currencies = this.assets.map( asset => new BN(asset.currencyId));
        let assetValues = await getUserAssets(this.keyRingPair.address, currencies);
        
        for (let index = 0; index < this.assets.length; index++) {
            if(beforeOrAfter === AssetWallet.BEFORE)
                this.assets[index].amountBefore = assetValues[index];
            else
                this.assets[index].amountAfter = assetValues[index];
        }
    }

    async buyAssets( soldAssetId: BN, boughtAssetId: BN, amount: BN, maxExpected = new BN(1000000)) {
        const eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, this.keyRingPair.address);
        buyAsset(this.keyRingPair, soldAssetId, boughtAssetId, amount, maxExpected);
        const eventResult = await eventPromise;
        expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        await waitNewBlock();
    }
    
    async sellAssets(soldAssetId : BN, boughtAssetId: BN ,amount: BN) {
    
        const eventPromise = getUserEventResult("xyk", "AssetsSwapped", 14, this.keyRingPair.address);
        sellAsset(this.keyRingPair, soldAssetId, boughtAssetId, amount, new BN(0));
        const eventResponse = await eventPromise;
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        await waitNewBlock();
    }
    
    async createPoolToAsset(first_asset_amount: BN, second_asset_amount: BN, firstCurrency: BN, secondCurrency : BN) {

        let eventPromise = getUserEventResult("xyk", "PoolCreated", 14, this.keyRingPair.address);
        createPool(this.keyRingPair, firstCurrency, first_asset_amount, secondCurrency, second_asset_amount);
        let eventResponse = await eventPromise;
        //console.warn(eventResponse.data);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        await waitNewBlock();

    }

    async addBalance(user : string = '//Alice', amount : number = Math.pow(10,11)){
        
        let eventPromise = getUserEventResult("balances","Endowed", 14 , this.keyRingPair.address);
        await balanceTransfer(new User(this.keyring, user).keyRingPair,this.keyRingPair.address, amount);
        await eventPromise;
        eventPromise = getUserEventResult("balances","Transfer", 14, this.keyRingPair.address);
        await eventPromise;
        await this.waitUntilBalanceIsNotZero();

        await waitNewBlock();

    }

    async setBalance(sudo : User, amount : number = Math.pow(10,11)) {
       
        let eventPromise = getUserEventResult("balances","Endowed", 14, this.keyRingPair.address);
        await setBalance(sudo.keyRingPair,this.keyRingPair.address, amount);
        await eventPromise;
        eventPromise = getUserEventResult("balances","BalanceSet", 14, this.keyRingPair.address);
        await eventPromise;

        await waitNewBlock();
        
    }
    async getUserAccountInfo(){
        const accountInfo = await getAccountInfo(this.keyRingPair.address);
        return accountInfo;
    }
    async waitUntilBalanceIsNotZero(){
        let amount = '0';
        do {
            await waitNewBlock();
            const accountData = await this.getUserAccountInfo();
            amount = accountData.free;
        } while (amount === '0');
    }
}

export class Asset{
    amountBefore : BN;
    amountAfter : BN ;
    currencyId : BN;

    constructor(currencyId : BN, amountBefore = new BN(0), amountAfter = new BN(0)) {
        this.currencyId = currencyId;
        this.amountBefore = amountBefore;
        this.amountAfter = amountAfter;
    }


}

