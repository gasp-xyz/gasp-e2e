/* eslint-disable no-console */
import { BN } from "@polkadot/util";
import { TestParams } from "../testParams";
import { KeyringPair } from "@polkadot/keyring/types";
import { runTransactions } from "./testRunner";
import { performanceTestItem } from "./performanceTestItem";
import { Assets } from "../../utils/Assets";
import { getApi, initApi } from "../../utils/api";
import { Node } from "../../utils/Framework/Node/Node";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { Keyring } from "@polkadot/api";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { ProofOfStake } from "../../utils/ProofOfStake";
import { setupApi, setupUsers } from "../../utils/setup";
import { MangataInstance } from "@mangata-finance/sdk";

let tokens: number[] = [];
export class Extrinsic3rdPartySchedule extends performanceTestItem {
  constructor() {
    super();
    Assets.legacy = true;
  }

  tokens: number[] = [];
  async arrange(testParams: TestParams): Promise<boolean> {
    await initApi(testParams.nodes[0]);
    getApi();
    setupUsers();
    await setupApi();
    await super.arrange(testParams);
    //create tokens for testing.
    const mgaNode = new Node(testParams.nodes[0]);
    await mgaNode.connect();
    const keyring = new Keyring({ type: "sr25519" });
    const sudo = UserFactory.createUser(Users.SudoUser, keyring, mgaNode);

    await initApi(testParams.nodes[0]);
    this.tokens = await Assets.setupUserWithCurrencies(
      sudo,
      [
        new BN("1000000000000000000000000000"),
        new BN("1000000000000000000000000000"),
      ],
      sudo,
    ).then((values) => {
      return values.map((val) => val.toNumber());
    });
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(
        new BN(this.tokens[0]),
        sudo,
        Assets.DEFAULT_AMOUNT.muln(40e6),
      ),
      Assets.mintToken(
        new BN(this.tokens[1]),
        sudo,
        Assets.DEFAULT_AMOUNT.muln(40e6),
      ),
      Xyk.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.muln(10e6),
        new BN(this.tokens[0]),
        Assets.DEFAULT_AMOUNT.muln(10e6),
      ),
      Xyk.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.muln(10e6),
        new BN(this.tokens[1]),
        Assets.DEFAULT_AMOUNT.muln(10e6),
      ),
    );

    await this.mintTokensToUsers(testParams.threads, testParams.nodes);
    // await this.mintERC20TokensToUsers(this.tokens, this.mgaNodeandUsers);
    console.info(`Setup Done!`);
    tokens = this.tokens;
    return true;
  }
  async act(testParams: TestParams): Promise<boolean> {
    await super.act(testParams);
    //    const generator = (
    //      users: { nonce: BN; keyPair: KeyringPair }[],
    //      thread: number,
    //      offset: BN,
    //    ) => {
    //      return createAndSignNewSchedules(users, thread, offset);
    //    };
    await runTransactions(
      this.mgaNodeandUsers,
      testParams,
      createAndSignNewSchedules,
    );
    console.info(`.... Done Sending Txs`);
    return true;
  }
}

async function createAndSignNewSchedules(
  // @ts-ignore
  mgaSdk: MangataInstance,
  users: { nonce: BN; keyPair: KeyringPair }[],
  threadId: number,
  nonceOffset: BN = new BN(0),
) {
  setupUsers();
  await setupApi();
  const srcUser = users[threadId % users.length];
  const nonce = srcUser.nonce.add(nonceOffset);

  const assets = [tokens[0], tokens[1]];
  const tx = await ProofOfStake.rewardPool(
    GASP_ASSET_ID,
    new BN(assets[0]),
    GASP_ASSET_ID,
    Assets.DEFAULT_AMOUNT.muln(10e6),
    3,
  );
  await tx.signAsync(
    srcUser!.keyPair,
    //@ts-ignore
    {
      nonce,
    },
  );
  return tx;
}
