import { WebDriver, Capabilities, logging } from "selenium-webdriver";

import "chromedriver";
import { Builder } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
const path = "utils/frontend/utils/extensions";
const polkadotExtensionPath = `${path}/polkadot_v0.44.1.0.crx`;
const talismanExtensionPath = `${path}/talisman_v1.15.1.crx`;

// Singleton constructor
export const DriverBuilder = (function () {
  async function buildChromeDriver(addExtensions = true) {
    const options = new chrome.Options();
    if (addExtensions) {
      options.addExtensions(polkadotExtensionPath);
      options.addExtensions(talismanExtensionPath);
    }
    options
      .addArguments("--disable-dev-shm-usage")
      .addArguments("--enable-clipboard-read");
    //.addArguments("--disable-web-security");
    const prefs = new logging.Preferences();
    prefs.setLevel(logging.Type.BROWSER, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.CLIENT, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.DRIVER, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.PERFORMANCE, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.SERVER, logging.Level.DEBUG);

    let caps: Capabilities = new Capabilities();
    caps = Capabilities.chrome();
    caps.set("version", "114.0");
    caps.set("selenoid:options", {
      enableVNC: true,
      enableVideo: true,
      enableLog: true,
    });

    driver = new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .withCapabilities(caps)
      .build();
    await driver!.manage().setTimeouts({ script: 5000 });
    await driver!.manage().window().maximize();

    return driver;
  }

  let driver: WebDriver | undefined;
  return {
    getInstance: async function (withExtensions = true): Promise<WebDriver> {
      if (!driver) {
        driver = await buildChromeDriver(withExtensions);
      }
      return driver!;
    },
    destroy: async function () {
      driver = undefined;
    },
  };
})();
