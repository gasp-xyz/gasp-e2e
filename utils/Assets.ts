import { assert } from "console";
import { BN } from "@polkadot/util";
import { ExtrinsicResult } from "./eventListeners";
import { getAssetSupply, getNextAssetId } from "./tx";
import { getEventResultFromMangataTx, sudoIssueAsset } from "./txHandler";
import { User } from "./User";

export class Assets {
  ///This method create or return the specified number of available assets
  static async getCurrencies(numAssets: number = 2, sudoUser: User) {
    const currencies = [];
    const numberOfcurrencies = parseInt((await getNextAssetId()).toString());

    if (numAssets > numberOfcurrencies) {
      //we need to create some currencies.
      for (
        let remainingAssetsToCreate = numberOfcurrencies;
        remainingAssetsToCreate < numAssets;
        remainingAssetsToCreate++
      ) {
        await this.issueAssetToSudo(sudoUser);
      }
    }
    //there are some currencies already created.
    for (let index = 0; index < numAssets; index++) {
      await getAssetSupply(new BN(index));
      currencies.push(index.toString());
    }

    return currencies;
  }

  static async setupUserWithCurrencies(
    user: User,
    currencyValues = [new BN(250000), new BN(250001)],
    sudo: User
  ): Promise<BN[]> {
    const currencies = [];
    for (let currency = 0; currency < currencyValues.length; currency++) {
      currencies.push(
        this.issueAssetToUser(user, currencyValues[currency], sudo).then(
          (id) => {
            user.addAsset(id, new BN(currencyValues[currency]));
            return id;
          }
        )
      );
    }

    return await Promise.all(currencies);
  }

  static async issueAssetToSudo(sudo: User) {
    await this.issueAssetToUser(sudo, new BN(1000), sudo);
  }

  //this method add a certain amount of currencies to a user into a returned currecncyId
  static async issueAssetToUser(user: User, num = new BN(1000), sudo: User) {
    const result = await sudoIssueAsset(
      sudo.keyRingPair,
      num,
      user.keyRingPair.address
    );
    const eventResult = await getEventResultFromMangataTx(result, [
      "tokens",
      "Issued",
      user.keyRingPair.address,
    ]);

    assert(eventResult.state === ExtrinsicResult.ExtrinsicSuccess);
    const assetId = eventResult.data[0].split(",").join("");
    return new BN(assetId);
  }

  static getAssetName(assetID: string) {
    return `m${assetID}`;
  }
}
