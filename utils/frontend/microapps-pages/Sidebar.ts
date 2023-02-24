import { By, WebDriver } from "selenium-webdriver";
import { buildDataTestIdXpath, waitForElement } from "../utils/Helper";

const DIV_MAIN_APP = "app-layout";

export class Sidebar {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isAppDisplayed() {
    const mainApp = buildDataTestIdXpath(DIV_MAIN_APP);
    const displayed = await this.isDisplayed(mainApp);
    return displayed;
  }

  private async isDisplayed(elementXpath: string) {
    try {
      await waitForElement(this.driver, elementXpath, 2000);
      const displayed = await (
        await this.driver.findElement(By.xpath(elementXpath))
      ).isDisplayed();
      return displayed;
    } catch (Error) {
      return false;
    }
  }
}
