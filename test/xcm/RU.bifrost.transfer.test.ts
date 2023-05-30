import {
  BuildBlockMode,
  connectParachains,
  connectVertical,
} from "@acala-network/chopsticks";
import { BN_BILLION, BN_HUNDRED } from "@mangata-finance/sdk";
import { BN_FIVE, BN_TEN, bufferToU8a, u8aToHex } from "@polkadot/util";
import { mangataChopstick } from "../../utils/api";
import {
  AssetId,
  ChainId,
  ChainSpecs,
  TRANSFER_INSTRUCTIONS,
} from "../../utils/ChainSpecs";
import { waitForEvents } from "../../utils/eventListeners";
import { XcmNode } from "../../utils/Framework/Node/XcmNode";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { alice, api, setupApi, setupUsers } from "../../utils/setup";
import { sendTransaction, signSendSuccess } from "../../utils/sign";
import { expectEvent } from "../../utils/validators";
import * as fs from "fs";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { sleep } from "../../utils/utils";

/**
 * @group xcm
 */
describe("XCM transfers", () => {
  let bifrost: ApiContext;
  let mangata: ApiContext;
  let kusama: ApiContext;
  let bifrostApi: XcmNode;

  afterAll(async () => {
    // await sleep(100000);
    await kusama.teardown();
    await mangata.teardown();
    await bifrost.teardown();
  });
  beforeAll(async () => {
    bifrost = await XcmNetworks.biforst({
      buildBlockMode: BuildBlockMode.Instant,
    });
    await setupApi();
    mangata = mangataChopstick!;
    kusama = await XcmNetworks.kusama();
    await connectParachains([bifrost.chain, mangata.chain]);
    await connectVertical(kusama.chain, mangata.chain);

    bifrostApi = new XcmNode(bifrost.api, ChainId.Bifrost);
    setupUsers();
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Sudo: {
        Key: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      },
      Tokens: {
        Accounts: [
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: BN_BILLION.mul(AssetId.Mgx.unit).toString() },
          ],
        ],
      },
    });
    await bifrost.dev.setStorage({
      System: {
        Account: [
          [
            [alice.keyRingPair.address],
            { data: { free: BN_HUNDRED.mul(AssetId.Bnc.unit).toString() } },
          ],
        ],
      },
    });
    await kusama.dev.setStorage({
      System: {
        Account: [
          [
            [alice.keyRingPair.address],
            { providers: 1, data: { free: 1000 * 1e12 } },
          ],
        ],
      },
    });
    const path = `test/xcm/_releasesUT/0.30.0/mangata_kusama_runtime-0.30.0.RC.compact.compressed.wasm`;
    const wasmContent = fs.readFileSync(path, {
      flag: "r",
    });
    const hexHash = mangata
      .api!.registry.hash(bufferToU8a(wasmContent))
      .toHex();
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
    await kusama.dev.newBlock();
    await sendTransaction(
      kusama.api.tx.balances
        .transferKeepAlive(alice.keyRingPair.address, 1)
        .signAsync(alice.keyRingPair)
    );
    await Sudo.batchAsSudoFinalized(Assets.mintNative(alice));
    await mangata.dev.newBlock();
    await mangata.dev.newBlock();
    await Sudo.batchAsSudoFinalized(Assets.mintNative(alice));
    await Sudo.asSudoFinalized(Assets.mintNative(alice));
  });

  it("send BNC to mangata and back", async () => {
    const op = bifrostApi.xTokenTransferV2(
      ChainId.Mg,
      AssetId.Bnc,
      AssetId.Bnc.unit.mul(BN_TEN),
      alice
    );
    await signSendSuccess(bifrost.api, op, alice);

    await waitForEvents(api, "xcmpQueue.Success");

    expectEvent(await waitForEvents(api, "tokens.Deposited"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z",
          amount: "25,804,800,000",
        }),
      }),
    });
    await api.tx.xTokens
      .transferMultiasset(
        {
          V3: {
            id: {
              Concrete: AssetId.BncV3.location,
            },
            fun: {
              Fungible: AssetId.Bnc.unit.mul(BN_FIVE),
            },
          },
        },
        {
          V3: {
            parents: 1,
            interior: {
              X2: [
                { Parachain: ChainSpecs.get(ChainId.Bifrost)!.parachain },
                {
                  AccountId32: {
                    network: undefined,
                    id: alice.keyRingPair.publicKey,
                  },
                },
              ],
            },
          },
        },
        {
          Limited: {
            refTime:
              TRANSFER_INSTRUCTIONS *
              ChainSpecs.get(ChainId.Bifrost)!.unitCostWeight,
            proofSize: 0,
          },
        }
      )
      .signAndSend(alice.keyRingPair);

    await waitForEvents(api, "system.ExtrinsicSuccess");
    await waitForEvents(bifrost.api, "xcmpQueue.Success");

    expectEvent(await waitForEvents(bifrost.api, "balances.Deposit"), {
      event: expect.objectContaining({
        data: expect.objectContaining({
          who: "eCSrvbA5gGNYdM3UjBNxcBNBqGxtz3SEEfydKragtL4pJ4F",
          amount: "6,410,240,000",
        }),
      }),
    });
    await sleep(10000000);
  });
});
