import { assert } from "console";
import { BN } from "@polkadot/util";
import { ExtrinsicResult, findEventData } from "./eventListeners";
import { getAssetSupply, getNextAssetId } from "./tx";
import {
  getEventResultFromMangataTx,
  setAssetInfo,
  sudoIssueAsset,
} from "./txHandler";
import { User } from "./User";
import { BN_TEN, BN_THOUSAND, MangataGenericEvent } from "@mangata-finance/sdk";
import { api, Extrinsic } from "./setup";
import { MGA_ASSET_ID } from "./Constants";
import { Sudo } from "./sudo";

export class Assets {
  static MG_UNIT: BN = BN_TEN.pow(new BN(18));
  static DEFAULT_AMOUNT = BN_THOUSAND.mul(this.MG_UNIT);

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
    await setAssetInfo(
      sudo,
      new BN(assetId),
      `TEST_${assetId}`,
      this.getAssetName(assetId),
      `Test token ${assetId}`,
      new BN(18)
    );
    return new BN(assetId);
  }

  static getAssetName(assetID: string) {
    return `m${assetID}`;
  }

  static mintNative(user: User, amount: BN = this.DEFAULT_AMOUNT): Extrinsic {
    user.addAsset(MGA_ASSET_ID);
    return Sudo.sudo(
      api.tx.tokens.mint(MGA_ASSET_ID, user.keyRingPair.address, amount)
    );
  }

  static issueToken(user: User, amount: BN = this.DEFAULT_AMOUNT): Extrinsic {
    return Sudo.sudo(api.tx.tokens.create(user.keyRingPair.address, amount));
  }

  static mintToken(
    asset: BN,
    user: User,
    amount: BN = this.DEFAULT_AMOUNT
  ): Extrinsic {
    return Sudo.sudo(
      api.tx.tokens.mint(asset, user.keyRingPair.address, amount)
    );
  }

  static transfer(target: User, tokenId: BN, amount: BN): Extrinsic {
    return api.tx.tokens.transfer(target.keyRingPair.address, tokenId, amount);
  }

  static transferAll(target: User, tokenId: BN): Extrinsic {
    return api.tx.tokens.transferAll(target.keyRingPair.address, tokenId, true);
  }

  static findTokenId(result: MangataGenericEvent[]): BN[] {
    return findEventData(result, "tokens.Issued").map(
      (data) => new BN(data[0])
    );
  }
}
