
import BN from 'bn.js';
import { ExtrinsicResult, getUserEventResult, waitNewBlock } from './eventListeners';
import { getNextAssetId , getAssetSupply , sudoIssueAsset} from './tx';
import { User } from './User';

export class Assets {

    ///This method create or return the specified number of available assets
    static async getCurrencies(numAssets : number = 2, sudoUser : User){
        var currencies = []
        const numberOfcurrencies = parseInt((await getNextAssetId()).toString());
        
        if (numAssets > numberOfcurrencies){
            //we need to create some currencies.
            for (let remainingAssetsToCreate = numberOfcurrencies; remainingAssetsToCreate < numAssets; remainingAssetsToCreate++) {
                await this.issueAssetToSudo(sudoUser);
            }

        }
        //there are some currencies already created.
        for (let index = 0; index < numAssets; index++) {
                await getAssetSupply(new BN(index));
                currencies.push(index.toString());
        }
        
        return currencies;
        
    };

    static async setupUserWithCurrencies(user : User, numCurrencies = 2, value = [250000, 250001], sudo: User){
        var currencies = [];
        for (let currency = 0; currency < numCurrencies; currency++) {
            await waitNewBlock();
            const currencyId = await this.issueAssetToUser(user, value[currency], sudo);
            currencies.push(currencyId);
            user.addAsset(currencyId,new BN(value[currency]));
        }
        return currencies;
    }

    static async issueAssetToSudo(sudo : User){
        await this.issueAssetToUser(sudo, 1000, sudo);
    }

    //this method add a certain amount of currencies to a user into a returned currecncyId
    static async issueAssetToUser(user : User, num = 1000, sudo : User){

        var eventPromise = getUserEventResult("tokens","Issued", 12, user.keyRingPair.address);
        sudoIssueAsset(sudo.keyRingPair, new BN(num), user.keyRingPair.address);        
        var eventResult = await eventPromise;
        expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

        return new BN(eventResult.data[0]);

    }

}

