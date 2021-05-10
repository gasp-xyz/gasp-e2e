
import { Keyring } from '@polkadot/api';
import { KeyringInstance, KeyringPair, KeyringPair$Json, KeyringPair$JsonEncodingTypes, KeyringPair$Meta, KeyringOptions } from '@polkadot/keyring/types';
import BN from 'bn.js';
import { getuid } from 'process';
import { v4 as uuid } from 'uuid';
import { ExtrinsicResult, getEventResult, waitNewBlock } from './eventListeners';
import { getNextAssetId , getAvailableCurrencies, getAssetSupply , sudoIssueAsset, getSudoKey} from './tx';
import { User } from './User';

export class Assets {
    /**
     * class that encapsulates some Asset related methods.
     */
    
    constructor() {
    }
    ///This method create or return the specified number of available assets
    static async getCurrencies(numAssets : number = 2){
        var currencies = []
        const numberOfcurrencies = parseInt((await getNextAssetId()).toString());
        
        if (numAssets > numberOfcurrencies){
            //we need to create some currencies.
            for (let remainingAssetsToCreate = numberOfcurrencies; remainingAssetsToCreate < numAssets; remainingAssetsToCreate++) {
                await this.issueAssetToSudo();
            }

        }
        //there are some currencies already created.
        for (let index = 0; index < numAssets; index++) {
                const element = await getAssetSupply(new BN(index));
                currencies.push(index.toString());
                
        }
        
        return currencies;
        
    };

    static async setupUserWithCurrencies(user : User, numCurrencies = 2, value = [250000, 250001]){
        var currencies = [];
        for (let currency = 0; currency < numCurrencies; currency++) {
            await waitNewBlock();
            const currencyId = await this.issueAssetToUser(user, value[currency]);
            currencies.push(currencyId);
            user.addAsset(currencyId,new BN(value[currency]));
        }
        return currencies;
    }

    static async issueAssetToSudo(){
        var keyring = new Keyring({ type: 'sr25519' });
        const sudo = new User(keyring, '//Maciatko');
        await this.issueAssetToUser(sudo);
    }

    //this method add a certain amount of currencies to a user into a returned currecncyId
    static async issueAssetToUser(user : User, num = 1000){
        var keyring = new Keyring({ type: 'sr25519' });
        const sudo = new User(keyring, '//Maciatko');
        // add users to pair.
        keyring.addPair(sudo.keyRingPair);
        var sudoKey = await getSudoKey();
        var sudoPair = keyring.getPair(sudoKey.toString());
        var eventPromise = getEventResult("tokens","Issued", 12);
        sudoIssueAsset(sudoPair, new BN(num), user.keyRingPair.address);        
        var eventResult = await eventPromise;
        expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        return eventResult.data[0];

    }

}

