import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import {
  abi,
  getAssetIdFromErc20,
  getL2UpdatesStorage,
  getPublicClient,
  setupEthUser,
} from "../../utils/rollup/ethUtils";
import { getL1, L1Type } from "../../utils/rollup/l1s";
import { setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { testLog } from "../../utils/Logger";
import { PrivateKeyAccount, Abi, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
// import { Assets } from "../../utils/Assets";
// import { Sudo } from "../../utils/sudo";
import { waitForBalanceChange } from "../../utils/utils";
import { signTx } from "gasp-sdk";

let user: User;

async function depositAndWait(depositor: User, l1: L1Type = "EthAnvil") {
  const updatesBefore = await getL2UpdatesStorage(l1);
  testLog.getLog().info(JSON.stringify(updatesBefore));
  const acc: PrivateKeyAccount = privateKeyToAccount(
    depositor.name as `0x${string}`,
  );
  const publicClient = getPublicClient(l1);
  const { request } = await publicClient.simulateContract({
    account: acc,
    address: getL1(l1)?.contracts?.rollDown.address!,
    abi: abi as Abi,
    functionName: "deposit",
    args: [getL1(l1)?.contracts.dummyErc20.address, BigInt(112233445566)],
  });
  const wc = createWalletClient({
    account: acc,
    chain: getL1(l1),
    transport: http(),
  });
  await wc.writeContract(request);

  const updatesAfter = await getL2UpdatesStorage(l1);
  testLog.getLog().info(JSON.stringify(updatesAfter));

  // eslint-disable-next-line no-console
  console.log(updatesAfter);
  // eslint-disable-next-line no-console
  console.log(updatesBefore);
  // TODO: verify that deposit is present in the pendingDeposits in l2update
  //validate that the request got inserted.
  // expect(
  //   parseInt(JSON.parse(JSON.stringify(updatesAfter)).lastAcceptedRequestOnL1),
  // ).toBeGreaterThan(
  //   parseInt(JSON.parse(JSON.stringify(updatesBefore)).lastAcceptedRequestOnL1),
  // );
  testLog.getLog().info(depositor.keyRingPair.address);
  const assetId = await getAssetIdFromErc20(
    getL1(l1)?.contracts.dummyErc20.address!,
    l1,
  );
  // Wait for the balance to change
  return await waitForBalanceChange(depositor.keyRingPair.address, 40, assetId);
}

describe("Rolldown withdraw error", () => {
  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    [user] = setupUsers();
    const keyRing = new Keyring({ type: "ethereum" });
    user = new User(keyRing);
    const params = getL1("EthAnvil");
    await setupEthUser(
      user,
      params?.contracts.dummyErc20.address!,
      params?.contracts.rollDown.address!,
      112233445566,
    );
  });

  test("withdrawing token which does not exist should return correct error", async () => {
    const api = getApi();
    // eslint-disable-next-line no-console
    console.log(
      "--------------------------THE RESPONSE----------------------------",
    );
    // const randomAddress = generateRandomAddress();
    // eslint-disable-next-line no-console
    // console.log("random address: ", randomAddress);
    const anyChange = await depositAndWait(user);
    // Check that got updated.
    expect(anyChange).toBeTruthy();
    // const erc20Address = getL1("EthAnvil")?.contracts.dummyErc20.address!;
    // await Sudo.batchAsSudoFinalized(Assets.mintNative(user));
    const tx = getApi().tx.rolldown.withdraw(
      "Ethereum",
      user.keyRingPair.address,
      "0x2bdcc0de6be1f7d2ee689a0342d76f52e8efa111",
      1122,
    );
    // const balanceBefore = await getBalance(
    //   erc20Address,
    //   user.keyRingPair.address,
    //   "EthAnvil",
    // );
    // eslint-disable-next-line no-console
    console.log(
      "--------------------------THE RESPONSE----------------------------",
    );
    const res = await signTx(api, tx, user.keyRingPair);
    // expectExtrinsicFail(res);
    // eslint-disable-next-line no-console
    console.log(
      "--------------------------HERE IS THE RESPONSE----------------------------",
    );
    // eslint-disable-next-line no-console
    console.dir(res);
    // expect(res).toBeTruthy();

    //     let balanceAfter = await getBalance(
    //       erc20Address,
    //       user.keyRingPair.address,
    //       "EthAnvil",
    //     );
    //     while (
    //       BigInt((balanceAfter as any).toString()) <=
    //       BigInt((balanceBefore as any).toString())
    //     ) {
    //       await new Promise((resolve) => setTimeout(resolve, 5000));
    //       balanceAfter = await getBalance(
    //         erc20Address,
    //         user.keyRingPair.address,
    //         "EthAnvil",
    //       );
    //       testLog.getLog().info(balanceAfter);
    //     }
    //     const diff =
    //       BigInt((balanceAfter as any).toString()) -
    //       BigInt((balanceBefore as any).toString());
    //     expect(diff).toBe(BigInt(1122));
  });
});

// function generateRandomAddress(): string {
//   const randomBytes = crypto.getRandomValues(new Uint8Array(20));

//   const address = Array.from(randomBytes)
//     .map((byte) => byte.toString(16).padStart(2, "0"))
//     .join("");

//   return `0x${address}`;
// }
