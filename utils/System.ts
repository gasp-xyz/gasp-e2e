import { api, Extrinsic } from "./setup";

export class System {
  static remark(data: string): Extrinsic {
    return api.tx.system.remark(data);
  }
  static remarkWithEvent(data: string): Extrinsic {
    return api.tx.system.remarkWithEvent(data);
  }
}
