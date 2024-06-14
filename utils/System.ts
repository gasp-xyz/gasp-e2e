import { api, Extrinsic } from "./setup";
import fs from "fs";

export class System {
  static remark(data: string): Extrinsic {
    return api.tx.system.remark(data);
  }
  static remarkWithEvent(data: string): Extrinsic {
    return api.tx.system.remarkWithEvent(data);
  }

  static async setCode(
    filepath: string = "./utils/wasms/rollup_runtime_maintenance_mode.wasm",
  ) {
    const data = fs.readFileSync(filepath).toString("hex");
    return api.tx.system.setCode(data);
  }
  static async setCodeWithoutChecks(
    filepath: string = "./utils/wasms/rollup_runtime_maintenance_mode.wasm",
  ) {
    const data = fs.readFileSync(filepath).toString("hex");
    return api.tx.system.setCodeWithoutChecks(data);
  }
}
