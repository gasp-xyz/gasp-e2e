import { BN } from "@polkadot/util";
import { BaseUser } from "./BaseUser";
import { ExtrinsicResult } from "../../eventListeners";
import { getEventResultFromMangataTx } from "../../txHandler";
import { Keyring } from "@polkadot/api";
import { mintAsset } from "../../tx";
import { Node } from "../Node/Node";
import { Token } from "../Supply/Token";
import { getEnvironmentRequiredVars } from "../../utils";
import { User } from "../../User";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { SudoDB } from "../../SudoDB";
import { testLog } from "../../Logger";
import { env } from "process";

export class SudoUser extends BaseUser {
  node: Node;

  constructor(keyring: Keyring, node: Node, json?: any) {
    const { sudo: sudoName } = getEnvironmentRequiredVars();
    super(keyring, sudoName, json);
    this.node = node;
  }

  async mintToken(assetId: BN, amount: BN): Promise<Token> {
    await mintAsset(
      this.keyRingPair,
      assetId,
      this.keyRingPair.address,
      amount,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "tokens",
        "Minted",
        this.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    return new Token(assetId, amount);
  }
  async mintTokens(
    tokens: BN[],
    users: User[],
    amount: BN = new BN(Math.pow(10, 20).toString()),
  ): Promise<MangataGenericEvent[]> {
    const mintFunctions: any[] = [];

    users.forEach((user) => {
      tokens.forEach((token) => {
        mintFunctions.push(
          this.node?.api!.tx.sudo.sudo(
            this.node?.api!.tx.tokens.mint(
              token,
              user.keyRingPair.address,
              amount,
            ),
          ),
        );
      });
    });

    const nonce = new BN(
      await SudoDB.getInstance().getSudoNonce(this.keyRingPair.address),
    );
    const txResult = await signTx(
      this.node?.api!,
      this.node?.api!.tx.utility.batch(mintFunctions)!,
      this.keyRingPair,
      { nonce: new BN(nonce) },
    ).catch((reason) => {
      // eslint-disable-next-line no-console
      console.error("OhOh sth went wrong. " + reason.toString());
      testLog.getLog().error(`W[${env.JEST_WORKER_ID}] - ${reason.toString()}`);
    });
    return txResult as MangataGenericEvent[];
  }
  async promotePool(liqAssetId: BN, weight: number = 1) {
    testLog.getLog().info(`Promoting pool :${liqAssetId}`);
    const nonce = new BN(
      await SudoDB.getInstance().getSudoNonce(this.keyRingPair.address),
    );
    return await signTx(
      this.node.api!,
      this.node.api!.tx.sudo.sudo(
        this.node.api!.tx.proofOfStake.updatePoolPromotion(liqAssetId, weight),
      ),
      this.keyRingPair,
      { nonce: nonce },
    );
  }
  async addStakingLiquidityToken(liqTokenForCandidate: BN) {
    const nonce = new BN(
      await SudoDB.getInstance().getSudoNonce(this.keyRingPair.address),
    );
    testLog.getLog().info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${nonce} `);
    return await signTx(
      this.node.api!,
      this.node.api!.tx.sudo.sudo(
        this.node?.api!.tx.parachainStaking.addStakingLiquidityToken(
          {
            Liquidity: liqTokenForCandidate,
          },
          liqTokenForCandidate,
        ),
      ),
      this.keyRingPair,
      { nonce: new BN(nonce) },
    ).catch((reason) => {
      // eslint-disable-next-line no-console
      console.error("OhOh sth went wrong. " + reason.toString());
      testLog.getLog().error(`W[${env.JEST_WORKER_ID}] - ${reason.toString()}`);
    });
  }
}
