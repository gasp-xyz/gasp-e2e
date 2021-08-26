import { ApiPromise } from "@polkadot/api";

export { Name, Node };

type Name = string;

type Node = {
  name: Name;
  api?: ApiPromise;
};
