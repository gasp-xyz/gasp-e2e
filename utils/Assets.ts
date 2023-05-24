import { BN_TEN, BN_THOUSAND } from "@mangata-finance/sdk";
import { ApiPromise } from "@polkadot/api";
import { AccountInfo } from "@polkadot/types/interfaces";
import { BN } from "@polkadot/util";
import { assert } from "console";
import _ from "lodash";
import { MGA_ASSET_ID } from "./Constants";
import { ExtrinsicResult } from "./eventListeners";
import { api, Extrinsic, setupApi, setupUsers } from "./setup";
import { Sudo } from "./sudo";
import { getAssetSupply, getNextAssetId } from "./tx";
import {
  getEventResultFromMangataTx,
  setAssetInfo,
  sudoIssueAsset,
} from "./txHandler";
import { User } from "./User";

export class Assets {
  static MG_UNIT: BN = BN_TEN.pow(new BN(18));
  static DEFAULT_AMOUNT = BN_THOUSAND.mul(this.MG_UNIT);

  ///This method create or return the specified number of available assets
  static async getCurrencies(numAssets: number = 2, sudoUser: User) {
    const currencies: string[] = [];
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
    _sudo: User,
    skipInfo = false
  ): Promise<BN[]> {
    const txs: Extrinsic[] = [];
    await setupApi();
    await setupUsers();
    for (let currency = 0; currency < currencyValues.length; currency++) {
      txs.push(Assets.issueToken(user, currencyValues[currency]));
    }
    const result = await Sudo.batchAsSudoFinalized(...txs);
    const assetIds: BN[] = result
      .filter((X) => X.method === "Issued")
      .map((t) => new BN(t.eventData[0].data.toString()));
    const addInfos: Extrinsic[] = [];
    if (!skipInfo) {
      for (let index = 0; index < assetIds.length; index++) {
        const assetId = assetIds[index];
        addInfos.push(
          Assets.registerAsset(
            `TEST_${assetId}`,
            this.getAssetName(assetId.toString()),
            new BN(18)
          )
        );
      }
      await Sudo.batchAsSudoFinalized(...addInfos);
    }
    user.addAssets(assetIds);
    await user.refreshAmounts();
    return assetIds;
  }

  static async issueAssetToSudo(sudo: User) {
    await this.issueAssetToUser(sudo, new BN(1000), sudo);
  }

  //this method add a certain amount of currencies to a user into a returned currecncyId
  static async issueAssetToUser(
    user: User,
    num = new BN(1000),
    sudo: User,
    skipInfo = false
  ) {
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
    if (!skipInfo) {
      await setAssetInfo(
        sudo,
        new BN(assetId),
        `TEST_${assetId}`,
        this.getAssetName(assetId),
        `Test token ${assetId}`,
        new BN(18)
      );
    }

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
  static FinalizeTge(): Extrinsic {
    return Sudo.sudo(api!.tx.issuance.finalizeTge());
  }
  static initIssuance(): Extrinsic {
    return Sudo.sudo(api!.tx.issuance.initIssuanceConfig());
  }
  static promotePool(liquidityId: number, weight: number | null): Extrinsic {
    return Sudo.sudo(
      api!.tx.proofOfStake.updatePoolPromotion(liquidityId, weight)
    );
  }
  static registerAsset(
    name: string,
    symbol: string,
    decimals: number | BN,
    // location?: MultiLocation,
    location?: object,
    xcmMetadata?: XcmMetadata,
    xykMetadata?: XykMetadata,
    assetId?: number | BN
  ): Extrinsic {
    return Sudo.sudo(
      api.tx.assetRegistry.registerAsset(
        {
          decimals: decimals,
          name: api.createType("Vec<u8>", name),
          symbol: api.createType("Vec<u8>", symbol),
          existentialDeposit: 0,
          location: location ? { V1: location } : null,
          additional: {
            xcm: xcmMetadata,
            xyk: xykMetadata,
          },
        },
        api.createType("Option<u32>", assetId)
      )
    );
  }

  static updateAsset(assetId: number | BN, update: UpdateAsset): Extrinsic {
    return Sudo.sudo(
      api.tx.assetRegistry.updateAsset(
        assetId,
        api.createType("Option<u32>", update.decimals),
        api.createType("Vec<u8>", update.name),
        api.createType("Vec<u8>", update.symbol),
        null,
        update.location
          ? update.location.location
            ? { V1: update.location } // Some(location)
            : api.createType("Vec<u8>", "0x0100") // Some(None)
          : null, // None
        { additional: update.metadata }
      )
    );
  }
  static async disableToken(tokenId: BN) {
    const isRegistered = (
      await api!.query.assetRegistry.metadata(tokenId)
    ).toHuman();
    let extrinsicToDisable: Extrinsic;
    if (!isRegistered) {
      extrinsicToDisable = Assets.registerAsset(
        "testAsset" + tokenId.toString(),
        "testSymbol",
        18,
        undefined,
        undefined,
        {
          operationsDisabled: true,
        },
        tokenId
      );
    } else {
      extrinsicToDisable = Assets.updateAsset(tokenId, {
        metadata: { xyk: { operationsDisabled: true } },
      });
    }
    return await Sudo.asSudoFinalized(extrinsicToDisable);
  }
  static async enableToken(tokenId: BN) {
    const isRegistered = (
      await api!.query.assetRegistry.metadata(tokenId)
    ).toHuman();
    let extrinsicToTokenEnable: Extrinsic;
    if (
      isRegistered &&
      _.get(isRegistered, "additional.xyk.operationsDisabled")
    ) {
      extrinsicToTokenEnable = await Assets.updateAsset(tokenId, {
        metadata: { xyk: { operationsDisabled: false } },
      });
      await Sudo.asSudoFinalized(extrinsicToTokenEnable);
    }
  }
}

export const balance = async (api: ApiPromise, address: string) => {
  const account = await api.query.system.account<AccountInfo>(address);
  return account.data.toJSON();
};

interface Metadata {
  xcm?: XcmMetadata;
  xyk?: XykMetadata;
}

interface XcmMetadata {
  feePerSecond: number;
}

interface XykMetadata {
  operationsDisabled: boolean;
}

// API expects Option<Option<Location>>, we need to wrap it so we can pass
// undefined in UpdateAsset - no update
// { location: undefined } - update with no location
// { location: { ... } } - update with some location
interface UpdateLocation {
  location?: object;
}

// if the value is undefined, it will not be updated
interface UpdateAsset {
  name?: string;
  symbol?: string;
  decimals?: number;
  // location?: MultiLocation,
  location?: UpdateLocation;
  metadata?: Metadata;
}
