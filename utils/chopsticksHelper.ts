import { getApi } from "./api";

export interface RPCParam {
  paramType: string;
  paramValue: any;
}

export async function replaceByStateCall(
  method: string,
  params: RPCParam[],
  module = "xyk",
  returnType = "XYKRpcResult"
) {
  const api = await getApi();
  let encodedStr = "0x";
  params.forEach((item) => {
    encodedStr += api
      .createType(item.paramType, item.paramValue)
      .toHex(true)
      .replace("0x", "");
  });
  let res: any;
  if (module === "xyk") {
    res = await api.rpc.state.call(`XykApi_${method}`, encodedStr);
  }
  const parsed = api.createType(returnType, res);
  return JSON.parse(JSON.stringify(parsed));
}
