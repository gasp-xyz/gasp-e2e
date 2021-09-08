import { Mangata } from "mangata-sdk";

require("dotenv").config();

export const main = async () => {
    const mangata = Mangata.getInstance("wss://staging.testnode.mangata.finance:9945");
    const api = await mangata.getApi();
    const result = await (api.rpc as any).xyk.calculate_sell_price_id(
      4,
      6,
      100
    );
    console.warn('Plain BN: ->' + result.price.toString());
    console.warn(result.toHuman());
};

main().then(() => {
  process.exit(0);
});
