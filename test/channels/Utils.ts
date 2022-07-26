import { BN } from "@polkadot/util";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { User } from "../../utils/User";
import { toBN } from "@mangata-finance/sdk";

export class Utils {
  static amount(value: number, exponent: number): BN {
    return toBN(value.toString(), exponent);
  }

  static asset(paraId: number, key: string, amount: BN) {
    return {
      V1: {
        id: {
          Concrete: {
            parents: 1,
            interior: {
              X2: [
                {
                  Parachain: paraId,
                },
                {
                  GeneralKey: key,
                },
              ],
            },
          },
        },
        fun: {
          Fungible: amount,
        },
      },
    };
  }

  static assetLocation(paraId: number, key: string) {
    return {
      V1: {
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: paraId,
            },
            {
              GeneralKey: key,
            },
          ],
        },
      },
    };
  }

  static location(paraId: number, publicKey: Uint8Array) {
    return {
      V1: {
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: paraId,
            },
            {
              AccountId32: {
                network: "Any",
                id: publicKey,
              },
            },
          ],
        },
      },
    };
  }

  static async signAndSend(user: User, tx: SubmittableExtrinsic<"promise">) {
    return new Promise((resolve, _) => {
      tx?.signAndSend(user.keyRingPair, ({ events = [], status }) => {
        console.log(status.toHuman());

        events.forEach(({ phase, event: { data, method, section } }) => {
          console.log(
            phase.toString() +
              " : " +
              section +
              "." +
              method +
              " " +
              data.toString()
          );
        });

        if (status.isFinalized) {
          resolve({});
        }
      });
    });
  }
}
