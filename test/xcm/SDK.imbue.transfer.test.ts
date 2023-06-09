import { connectParachains } from "@acala-network/chopsticks";
import { KeyringPair } from "@polkadot/keyring/types";
import { BN_THOUSAND } from "@polkadot/util";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { devTestingPairs } from "../../utils/setup";
import { expectJson, matchSystemEvents } from "../../utils/validators";
import { Mangata } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";

import { BN_TEN } from "@mangata-finance/sdk";
import { sleep } from "../../utils/utils";

/**
 * @group sdkxcm
 * @group proxied
 */
describe.skip("XCM tests for Mangata <-> imbue", () => {
  let imbue: ApiContext;
  let mangata: ApiContext;
  let alice: KeyringPair;
  const imbueTokenId = 14;
  beforeAll(async () => {
    const imbueRocco = await XcmNetworks.imbue({
      endpoint: "wss://rococo.imbue.network",
    });
    imbue = imbueRocco;
    mangata = await XcmNetworks.mangata({
      endpoint: "wss://collator-01-ws-rococo.mangata.online",
    });
    await connectParachains([imbue.chain, mangata.chain]);
    alice = devTestingPairs().alice;
  });

  afterAll(async () => {
    await imbue.teardown();
    await mangata.teardown();
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[alice.address, { token: imbueTokenId }], { free: 1000e12 }],
          [
            [alice.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
        ],
      },
      Sudo: {
        Key: alice.address,
      },
    });
    await imbue.dev.setStorage({
      System: {
        Account: [[[alice.address], { data: { free: 1000e12 } }]],
      },
    });
  });

  it.skip("SDK ROC - mangata transfer assets to imbue", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, imbueTokenId)
    ).toMatchSnapshot("Before");

    expect(await imbue.api.query.system.account(alice.address)).toMatchSnapshot(
      "Before"
    );
    const mgaSdk = Mangata.instance([mangata.uri]);
    const p = mgaSdk.xTokens.withdraw({
      account: alice,
      amount: BN_TEN.mul(BN_TEN.pow(new BN(12))),
      parachainId: 2121,
      destinationAddress: alice.address,
      tokenSymbol: "IMBU",
      withWeight: "800000000",
    });
    await Promise.race([
      p,
      new Promise(async () => {
        await sleep(5000);
        await mangata.chain.newBlock();
      }),
    ]);

    await imbue.chain.newBlock();
    await imbue.chain.newBlock();
    await mangata.chain.newBlock();
    const balanceInMangata = await mangata.api.query.tokens.accounts(
      alice.address,
      imbueTokenId
    );
    expectJson(balanceInMangata).toMatchSnapshot();

    const balanceInImbu = await imbue.api.query.system.account(alice.address);
    expect(balanceInImbu).toMatchSnapshot();

    await matchSystemEvents(mangata, "xcmpQueue", "Success");
    await sleep(60000);
  });

  it("SDK ROC - imbue transfer assets to mangata", async () => {
    expectJson(
      await mangata.api.query.tokens.accounts(alice.address, imbueTokenId)
    ).toMatchSnapshot("Before");

    expect(await imbue.api.query.system.account(alice.address)).toMatchSnapshot(
      "Before"
    );
    const mgaSdk = Mangata.instance([mangata.uri]);
    const p = mgaSdk.xTokens.depositFromParachain({
      account: alice,
      destination: alice.address,
      asset: "IMBU",
      url: imbue.uri,
      weightLimit: "800000000",
    });
    await Promise.race([
      p,
      new Promise(async () => {
        await sleep(5000);
        await imbue.chain.newBlock();
        await imbue.chain.newBlock();
        await mangata.chain.newBlock();
      }),
    ]);
    await imbue.chain.newBlock();
    const balanceAtImbu = await imbue.api.query.system.account(alice.address);
    expect(balanceAtImbu).toMatchSnapshot();
    await mangata.chain.newBlock();
    await mangata.chain.newBlock();
    const balanceAtMangata = await mangata.api.query.tokens.accounts(
      alice.address,
      imbueTokenId
    );
    expectJson(balanceAtMangata).toMatchSnapshot();
    await matchSystemEvents(mangata, "xcmpQueue", "Success");
  });
});
