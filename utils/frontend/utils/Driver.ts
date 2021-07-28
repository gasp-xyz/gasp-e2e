import { WebDriver } from "selenium-webdriver";

require("chromedriver");
const { Builder } = require("selenium-webdriver");
const fs = require('fs');
let chrome = require("selenium-webdriver/chrome");
const path = 'utils/frontend/utils/extensions'
const polkadotExtensionPath = `${path}/polkadot_v0.38.3.crx`;
const metamaskExtensionPath = `${path}/metamask_9.8.2.0.crx`;

// Singleton constructor
export const DriverBuilder = (function () {
    
    function buildChromeDriver() {
      let options = new chrome.Options();
      options.addExtensions(polkadotExtensionPath);
      options.addExtensions(metamaskExtensionPath);
    
      driver = new Builder()
          .forBrowser('chrome')
          .setChromeOptions(options)
          .build();
      return driver;
    }
    
    let driver: WebDriver;
    return {
      
      getInstance: function () {
        if (!driver) {
            driver = buildChromeDriver();
        }
        return driver;
      }
    }
})();




