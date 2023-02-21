import { api, Extrinsic } from "./setup";

export class Maintenance {
  static switchMaintenanceModeOff(): Extrinsic {
    return api.tx.maintenance.switchMaintenanceModeOff();
  }

  static switchMaintenanceModeOn(): Extrinsic {
    return api.tx.maintenance.switchMaintenanceModeOn();
  }

  static switchUpgradabilityInMaintenanceModeOff(): Extrinsic {
    return api.tx.maintenance.switchUpgradabilityInMaintenanceModeOff();
  }

  static switchUpgradabilityInMaintenanceModeOn(): Extrinsic {
    return api.tx.maintenance.switchUpgradabilityInMaintenanceModeOn();
  }
}
