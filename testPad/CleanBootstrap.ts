/* eslint-disable no-console */
import "@mangata-finance/types";
import { Mangata, signTx } from "gasp-sdk";
import * as fs from "fs";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";

function difference(a1: any, a2: any) {
  const a2Set = new Set(a2);
  return a1.filter(function (x: any) {
    return !a2Set.has(x);
  });
}

(async () => {
  const liqToken = new BN(9);
  const api = await Mangata.instance([
    "wss://roccoco-testnet-collator-01.mangatafinance.cloud",
  ]).api();

  const file = fs.readFileSync(
    "/home/goncer/accounts/5CthcoS3CYHoVHDMUacydayRLMzMWedKryjsrvzrmv3VHCKP" +
      ".json",
  );
  const keyring = new Keyring({ type: "sr25519" });
  const user = keyring.createFromJson(JSON.parse(file as any));
  keyring.addPair(user);
  keyring.pairs[0].decodePkcs8("");

  const claimedRewardsKeys = await api.query.bootstrap.claimedRewards.keys();
  const alreadyClaimedAddresses = claimedRewardsKeys.map(
    ({ args: [address] }) => address.toString(),
  );

  const provisionedAddresses = await api.query.bootstrap.provisions.keys();
  const provisioned = provisionedAddresses.map(({ args: [address] }) =>
    address.toString(),
  );

  const accountsNotClaimedLpRewards = difference(
    provisioned,
    alreadyClaimedAddresses,
  );
  console.log(JSON.stringify(accountsNotClaimedLpRewards));
  console.log(JSON.stringify(provisioned));
  console.log(JSON.stringify(claimedRewardsKeys));
  for (const account of accountsNotClaimedLpRewards) {
    await signTx(
      api,
      api!.tx.bootstrap.claimLiquidityTokensForAccount(account, false),
      user,
    );
  }
  provisioned.push("5EYCAe5fva7A4cKCNZH5hjHguP83vY8vygL9jepYHZqYEYe1");
  for (const account of provisioned) {
    const tokens = await api!.query.tokens.accounts(account, liqToken);
    console.log("\n tokens " + tokens.toString() + " account - " + account);
    await signTx(
      api,
      api!.tx.sudo.sudo(
        api!.tx.tokens.forceTransfer(
          {
            Id: account,
          },
          {
            Id: user.address,
          },
          liqToken,
          tokens.free.toString(),
        ),
      ),
      user,
    );
  }
  const tokens = await api!.query.tokens.accounts(user.address, liqToken);
  await signTx(
    api!,
    api!.tx.market.burnLiquidity(liqToken, tokens.free.toString(), 0, 0),
    user,
  );
})()
  .then(() => console.log("done"))
  .then(() => process.exit(0));
