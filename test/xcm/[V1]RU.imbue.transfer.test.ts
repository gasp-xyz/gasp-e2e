import { connectParachains } from "@acala-network/chopsticks";
import { bufferToU8a, u8aToHex } from "@polkadot/util";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, setupApi, setupUsers } from "../../utils/setup";
import { sendTransaction } from "../../utils/sign";
import * as fs from "fs";
import {
  expectEvent,
  expectExtrinsicSuccess,
  expectJson,
  matchEvents,
  matchSystemEvents,
} from "../../utils/validators";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { BN_BILLION } from "@mangata-finance/sdk";
import { mangataChopstick } from "../../utils/api";

/**
 * @group xcm
 * @group proxied
 */
describe("[V3][V1] XCM tests for Mangata <-> imbue", () => {
  let imbue: ApiContext;
  let mangata: ApiContext;

  beforeAll(async () => {
    await setupApi();
    imbue = await XcmNetworks.imbue();
    mangata = mangataChopstick!;
    await connectParachains([imbue.chain, mangata.chain]);
    setupUsers();
    await mangata.dev.setStorage({
      Sudo: {
        Key: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      },
      Tokens: {
        Accounts: [
          [[alice.keyRingPair.address, { token: 11 }], { free: 1000e12 }],
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
        ],
      },
    });
    await imbue.dev.setStorage({
      System: {
        Account: [[[alice.keyRingPair.address], { data: { free: 10e12 } }]],
      },
    });
    const path = `test/xcm/_releasesUT/0.30.0/mangata_kusama_runtime-0.30.0.RC.compact.compressed.wasm`;
    const wasmContent = fs.readFileSync(path, {
      flag: "r",
    });
    const hexHash = mangata
      .api!.registry.hash(bufferToU8a(wasmContent))
      .toHex();
    await Sudo.batchAsSudoFinalized(Assets.mintNative(alice));
    await Sudo.asSudoFinalized(
      Sudo.sudo(
        //@ts-ignore
        mangata.api!.tx.parachainSystem.authorizeUpgrade(hexHash)
      )
    );
    const wasmParam = Uint8Array.from(wasmContent);
    const hex = u8aToHex(wasmParam);
    await Sudo.asSudoFinalized(
      Sudo.sudo(
        mangata.api!.tx.parachainSystem.enactAuthorizedUpgrade(hex.toString())
      )
    );
    await Sudo.batchAsSudoFinalized(Assets.mintNative(alice));
    await mangata.dev.newBlock();
    await mangata.dev.newBlock();
    await Sudo.batchAsSudoFinalized(Assets.mintNative(alice));
    await Sudo.asSudoFinalized(Assets.mintNative(alice));
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Sudo: {
        Key: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      },
      Tokens: {
        Accounts: [
          [[alice.keyRingPair.address, { token: 11 }], { free: 1000e12 }],
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_BILLION).toString() },
          ],
        ],
      },
    });
    await imbue.dev.setStorage({
      System: {
        Account: [[[alice.keyRingPair.address], { data: { free: 10e12 } }]],
      },
    });
  });
  it("[V3] mangata transfer assets to [V1] imbue", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 11)
    ).toMatchSnapshot("Before");

    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address)
    ).toMatchSnapshot("Before");
    const tx = await sendTransaction(
      mangata.api.tx.xTokens
        .transfer(
          11,
          10e12,
          {
            V3: {
              parents: 1,
              interior: {
                X2: [
                  { Parachain: 2121 },
                  {
                    AccountId32: {
                      network: undefined,
                      id: alice.keyRingPair.addressRaw,
                    },
                  },
                ],
              },
            },
          },
          "Unlimited"
        )
        .signAsync(alice.keyRingPair)
    );

    await mangata.chain.newBlock();

    expectExtrinsicSuccess(await tx.events);
    expectEvent(await tx.events, {
      event: expect.objectContaining({
        section: "xTokens",
        method: "TransferredMultiAssets",
      }),
    });

    await imbue.chain.newBlock();
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 11)
    ).toMatchSnapshot("After");

    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address)
    ).toMatchSnapshot("After");

    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });

  it("[V1] imbue transfer assets to [V3] mangata", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 11)
    ).toMatchSnapshot("Before");
    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address)
    ).toMatchSnapshot("Before");
    const tx = await sendTransaction(
      imbue.api.tx.xTokens
        .transferMultiasset(
          {
            V1: {
              id: {
                Concrete: {
                  parents: 1,
                  interior: {
                    X2: [{ Parachain: 2121 }, { GeneralKey: "0x0096" }],
                  },
                },
              },
              fun: {
                Fungible: 5e12,
              },
            },
          },
          {
            V1: {
              parents: 1,
              interior: {
                X2: [
                  { Parachain: 2110 },
                  {
                    AccountId32: {
                      network: "Any",
                      id: alice.keyRingPair.addressRaw,
                    },
                  },
                ],
              },
            },
          },
          {
            Fungible: 800000000,
          }
        )
        .signAsync(alice.keyRingPair, { nonce: 0 })
    );

    await imbue.chain.newBlock();

    await matchEvents(tx.events, "polkadotXcm");

    expect(
      await imbue.api.query.system.account(alice.keyRingPair.address)
    ).toMatchSnapshot("After");

    await mangata.chain.newBlock();

    expectJson(
      await mangata.api.query.tokens.accounts(alice.keyRingPair.address, 11)
    ).toMatchSnapshot("After");
    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });
});
