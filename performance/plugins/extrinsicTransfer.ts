import { testLog } from "../../utils/Logger";
import { TestItem } from "./testItem";

export class ExtrinsicTransfer implements TestItem {
  async arrange(param1: string, param2: string): Promise<boolean> {
    return true;
  }
  async act(): Promise<boolean> {
    return true;
  }
  async expect(): Promise<boolean> {
    return true;
  }
  async teardown(): Promise<boolean> {
    return true;
  }
  async run(): Promise<boolean> {
    return this.arrange("a", "b").then(async (result) => {
      testLog.getLog().info("Done Arrange");
      return (
        result &&
        (await this.act().then(async (resultAct) => {
          testLog.getLog().info("Done Act");
          return (
            resultAct &&
            (await this.expect().then(async (resultExpect) => {
              testLog.getLog().info("Done Expect");
              return (
                resultAct &&
                (await this.teardown().then(async (resultTearDown) => {
                  testLog.getLog().info("Done TearDown");
                  return resultTearDown;
                }))
              );
            }))
          );
        }))
      );
    });
  }
}
