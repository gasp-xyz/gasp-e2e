import { WebDriver, Capabilities, logging } from "selenium-webdriver";
import "chromedriver";
import { Builder } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";

const path = "utils/frontend/utils/extensions";
const metamaskExtensionPath = `${path}/meatamask_12.3.1.crx`;

interface MobileDevice {
  deviceName: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  mobile: boolean;
}

export const DriverBuilder = (function () {
  async function buildChromeDriver(
    addExtensions = true,
    debugLogs = false,
    mobileDevice?: MobileDevice,
  ) {
    const options = new chrome.Options();
    if (addExtensions) {
      options.addExtensions(metamaskExtensionPath);
    }

    options
      .addArguments("--disable-dev-shm-usage")
      .addArguments("--enable-clipboard-read")
      .addArguments("--disable-search-engine-choice-screen");

    // Add mobile emulation if device is specified
    if (mobileDevice) {
      options.setMobileEmulation({
        deviceMetrics: {
          width: mobileDevice.width,
          height: mobileDevice.height,
          pixelRatio: mobileDevice.deviceScaleFactor,
          mobile: mobileDevice.mobile,
        },
        userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/${mobileDevice.deviceName}`,
      });
    }

    const prefs = new logging.Preferences();
    prefs.setLevel(logging.Type.BROWSER, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.CLIENT, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.DRIVER, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.PERFORMANCE, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.SERVER, logging.Level.DEBUG);

    let caps: Capabilities = new Capabilities();
    caps = Capabilities.chrome();
    caps.set("version", "128.0");
    caps.set("selenoid:options", {
      enableVNC: true,
      enableVideo: true,
      enableLog: true,
    });
    if (debugLogs) {
      caps.set("goog:loggingPrefs", prefs);
    }

    driver = new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .withCapabilities(caps)
      .build();

    await driver!.manage().setTimeouts({ script: 5000 });

    if (!mobileDevice) {
      await driver!.manage().window().maximize();
    } else {
      await driver!.manage().window().setRect({
        width: mobileDevice.width,
        height: mobileDevice.height,
      });
    }

    if (addExtensions) {
      await waitForMultipleTabs(driver);
    }

    return driver;
  }

  async function waitForMultipleTabs(driver: WebDriver) {
    await driver.wait(
      async () => {
        const handles = await driver.getAllWindowHandles();
        return handles.length > 1;
      },
      10000,
      "Waiting for all extensions tabs to open",
    );
  }

  let driver: WebDriver | undefined;
  return {
    getInstance: async function (
      withExtensions = true,
      debugLogs = false,
      mobileDevice?: MobileDevice,
    ): Promise<WebDriver> {
      if (!driver) {
        driver = await buildChromeDriver(
          withExtensions,
          debugLogs,
          mobileDevice,
        );
      }
      return driver!;
    },
    destroy: async function () {
      driver = undefined;
    },
  };
})();
