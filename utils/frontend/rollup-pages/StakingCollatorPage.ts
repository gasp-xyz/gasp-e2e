import { WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  getText,
  isDisplayed,
  textNumberToFloat,
  waitForElementVisible,
} from "../utils/Helper";

const MIN_STAKE = "min-stake";
const STAKED_TOKEN = "token";
const TOTAL_STAKE = "total-stake";
const DELEGATORS = "delegators";
const REWARDS_AMOUNT =
  '//div[@data-testid="rewards"]//span[contains(@class, "text-highlight")]//span';

export class StakingCollatorPage {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isCollatorsDetailCardDisplayed() {
    const itemXpath = buildDataTestIdXpath("collator-details");
    return isDisplayed(this.driver, itemXpath);
  }

  async getRewards() {
    await waitForElementVisible(this.driver, REWARDS_AMOUNT);
    const rewards = textNumberToFloat(
      await getText(this.driver, REWARDS_AMOUNT),
    );
    return rewards;
  }

  async getMinStake() {
    const xpath = buildDataTestIdXpath(MIN_STAKE);
    await waitForElementVisible(this.driver, xpath);
    const minStake = await getText(this.driver, xpath);
    return minStake;
  }

  async getStakedToken() {
    const xpath = buildDataTestIdXpath(STAKED_TOKEN);
    await waitForElementVisible(this.driver, xpath);
    const token = await getText(this.driver, xpath);
    return token;
  }

  async getTotalStake() {
    const xpath = buildDataTestIdXpath(TOTAL_STAKE);
    await waitForElementVisible(this.driver, xpath);
    const stake = await getText(this.driver, xpath);
    return stake;
  }

  async getDelegators() {
    const xpath = buildDataTestIdXpath(DELEGATORS);
    await waitForElementVisible(this.driver, xpath);
    const delegators = await getText(this.driver, xpath);
    return delegators;
  }

  async getStakingStats() {
    try {
      const [rewards, minStake, stakedToken, totalStake, delegators] =
        await Promise.all([
          this.getRewards(),
          this.getMinStake(),
          this.getStakedToken(),
          this.getTotalStake(),
          this.getDelegators(),
        ]);

      return {
        rewards,
        minStake,
        stakedToken,
        totalStake,
        delegators,
      };
    } catch (error) {
      throw new Error(`Failed to fetch staking stats: ${error}`);
    }
  }

  async clickBack() {
    const itemXpath = buildDataTestIdXpath("back-button");
    return clickElement(this.driver, itemXpath);
  }
}
