import asyncio
import os
from playwright.async_api import async_playwright
import pytest
import pytest_asyncio
from browser_use import Agent, Browser, Controller, ActionResult, BrowserConfig
from browser_use.browser.context import BrowserContextConfig, BrowserContext
from langchain_anthropic import ChatAnthropic
from pydantic import BaseModel, SecretStr
from lmnr import Laminar


class Output(BaseModel):
    welcome_modal_dismissed: bool
    metamask_wallet_visible: bool
    walletconnect_wallet_visible: bool
    binance_wallet_visible: bool
    binance_modal_opened: bool

# Get UI URL from environment variable with a fallback default
UI_URL = os.getenv('UI_URL', 'https://app.gasp.xyz')

# Initial Actions - now using UI_URL environment variable
initial_actions = [
    {"open_tab": {"url": f"{UI_URL}"}},
    {"dismiss_welcome_message": {}}
]


@pytest_asyncio.fixture
async def browser():
    # Check if running in a CI environment
    is_ci = os.getenv('CI') == 'true'

    # Configure the Browser launch settings here
    browser_config = BrowserConfig(
        headless=is_ci # Set headless based on CI environment variable
    )
    async with async_playwright() as p:
        browser_instance = Browser(config=browser_config)
        yield browser_instance # Yield the configured instance
        await browser_instance.close()


@pytest_asyncio.fixture
async def browser_context(browser):
    context_config = BrowserContextConfig(
        browser_window_size={'width': 1300, 'height': 900},
        locale='en-US',
        highlight_elements=True,
        save_recording_path='tmp/record_videos',
    )
    # Use the pre-configured browser instance passed from the 'browser' fixture
    context = BrowserContext(browser=browser, config=context_config)
    yield context
    await context.close()


@pytest.fixture
def controller_with_actions():
    """Fixture that provides a controller with all necessary actions registered"""
    controller = Controller(output_model=Output)

    @controller.action('Open website')
    async def open_website(url: str, browser: Browser):
        page = await browser.get_current_page()
        await page.goto(url)
        return ActionResult(extracted_content='Website opened')

    @controller.action('Dismiss welcome modal by clicking "start trading"')
    async def dismiss_welcome_message(browser: Browser):
        page = await browser.get_current_page()
        # XPath targeting the button with "Start trading" text
        selector = '//button[contains(text(), "Start trading")]'
        await page.locator(selector).click()
        return ActionResult(
            extracted_content='welcome modal dismissed', 
            output_data={'welcome_modal_dismissed': True}  # Add output data for this action
        )
    
    @controller.action('click first element on Active Collators table')
    async def click_first_collator(browser: Browser):
        page = await browser.get_current_page()
        selector = '//*[@data-testid="collator-row-item-link"]'
        first_collator = page.locator(selector).first
        await first_collator.click()
        return ActionResult(extracted_content='clicked first collator in Active Collators table')

    return controller


@pytest.fixture
def llm():
    # Get API key from environment variable
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        pytest.skip("ANTHROPIC_API_KEY environment variable not set")
        
    return ChatAnthropic(
        model_name="claude-3-5-sonnet-20240620",
        temperature=0.0,
        timeout=100,
        api_key=SecretStr(api_key),
    )


@pytest.mark.asyncio
async def test_gasp_website(browser_context, controller_with_actions, llm):
    # Initialize Laminar
    Laminar.initialize(project_api_key=os.getenv('LMNR_PROJECT_API_KEY'))
    
    # Create an agent with the task
    agent = Agent(
        task="""
        1. using vision click Connect your wallet button on right top side of the site
        2. check what wallets can be conneced now
        3. click on binance wallet
        4. wait and check if Connect With Binance modal was opened with qr code
        """,
        initial_actions=initial_actions,
        llm=llm,
        browser_context=browser_context,
        controller=controller_with_actions,
        generate_gif='tmp/agent_history.gif'
    )

    # Run the agent
    history = await agent.run()
    result = history.final_result()

    # Verify the result exists
    assert result is not None, "No result was returned"

    # Parse the result
    parsed = Output.model_validate_json(result)

    # Add assertion for welcome_modal_dismissed
    assert parsed.metamask_wallet_visible == True
    assert parsed.walletconnect_wallet_visible == True
    assert parsed.metamask_wallet_visible == True
    assert parsed.binance_wallet_visible == True
    assert parsed.binance_modal_opened == True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
