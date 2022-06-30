import { BN } from "@polkadot/util";
import { getAssetSupply, getNextAssetId } from "./tx";
import { setAssetInfo, sudoIssueAsset } from "./txHandler";
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

  static async setupUserWithCurrency(
    user: User,
    assetId: BN,
    value: BN,
    sudo: User
  ): Promise<void> {
    await Promise.all([
      sudoIssueAsset(sudo.keyRingPair, value, user.keyRingPair.address),
      setAssetInfo(
        sudo,
        assetId,
        `TEST_${assetId}`,
        `m${assetId}`,
        `Test token ${assetId}`,
        new BN(18)
      ),
    ]);
    user.addAsset(assetId, value);
  }

  static async setupUserWithCurrencies(
    user: User,
    currencyValues = [new BN(250000), new BN(250001)],
    sudo: User
  ): Promise<BN[]> {
    const currencies = [];
    for (let currency = 0; currency < currencyValues.length; currency++) {
      const currencyId = await this.issueAssetToUser(
        user,
        currencyValues[currency],
        sudo
      );
      currencies.push(currencyId);
      user.addAsset(currencyId, new BN(currencyValues[currency]));
    }

    return currencies;
  }

  static async issueAssetToSudo(sudo: User) {
    await this.issueAssetToUser(sudo, new BN(1000), sudo);
  }

  //this method add a certain amount of currencies to a user into a returned currecncyId
  static async issueAssetToUser(user: User, num = new BN(1000), sudo: User) {
    const assetId = await getNextAssetId();
    await Promise.all([
      sudoIssueAsset(sudo.keyRingPair, num, user.keyRingPair.address),
      setAssetInfo(
        sudo,
        assetId,
        `TEST_${assetId}`,
        `m${assetId}`,
        `Test token ${assetId}`,
        new BN(18)
      ),
    ]);
    return assetId;
  }
}
