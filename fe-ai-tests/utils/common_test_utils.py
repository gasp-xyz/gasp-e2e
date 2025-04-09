import logging
import os
import pytest
import pytest_asyncio
from playwright.async_api import async_playwright
from browser_use import Agent, Browser, Controller, ActionResult, BrowserConfig
from browser_use.browser.context import BrowserContextConfig, BrowserContext
from langchain_anthropic import ChatAnthropic
from pydantic import SecretStr
from lmnr import Laminar

# Get UI URL from environment variable with a fallback default
UI_URL = os.getenv('UI_URL', 'https://app.gasp.xyz')

# Common initial actions
def get_initial_actions(path=""):
    """Generate initial actions with optional path appended to base URL"""
    url = f"{UI_URL}{path}"
    return [
        {"open_tab": {"url": url}},
        {"dismiss_welcome_message": {}}
    ]

@pytest_asyncio.fixture
async def browser():
    """Fixture for the browser instance with CI-aware configuration"""
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
    """Fixture for browser context with standard configuration"""
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
def llm():
    """Fixture for the LLM with standardized configuration"""
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

def create_base_controller(output_model):
    """Create a controller with common actions registered"""
    controller = Controller(output_model=output_model)

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
    
    @controller.action('Select token from You Pay section')
    async def select_pay_token(browser: Browser, token_name: str, origin: str = "Native"):
        """
        Selects a token in the 'You Pay' section
        
        Args:
            browser: Browser instance
            token_name: Name of the token to select
            origin: Origin of the token (default: "Native")
        """
        page = await browser.get_current_page()
        
        # Click on the token selector button
        await page.locator('[data-testid="firstToken-selector-btn"]').click()
        
        # Wait for the token selector modal to appear
        await page.locator('[data-testid="firstToken-selector-content"]').wait_for()
        
        # Build the selector for the token item
        token_item_xpath = f'//div[@data-testid="tokenList-item" and contains(., "{token_name}") and contains(., "{origin}")]'
        
        # Scroll to the token item and click it
        token_element = page.locator(token_item_xpath)
        await token_element.scroll_into_view_if_needed()
        await token_element.click()
        
        # Check for warning and accept if present
        warning_button = page.locator('[data-testid="firstToken-selector-content"] button:has-text("Ok, I understand")')
        if await warning_button.count() > 0:
            await warning_button.click()
        
        return ActionResult(
            extracted_content=f'Selected {token_name} ({origin}) in You Pay section',
            output_data={'pay_token_selected': True, 'pay_token_name': token_name, 'pay_token_origin': origin}
        )

    @controller.action('Select token from You Get section')
    async def select_get_token(browser: Browser, token_name: str, origin: str = "Native"):
        """
        Selects a token in the 'You Get' section
        
        Args:
            browser: Browser instance
            token_name: Name of the token to select
            origin: Origin of the token (default: "Native")
        """
        page = await browser.get_current_page()
        
        # Click on the token selector button
        await page.locator('[data-testid="secondToken-selector-btn"]').click()
        
        # Wait for the token selector modal to appear
        await page.locator('[data-testid="secondToken-selector-content"]').wait_for()
        
        # Build the selector for the token item
        token_item_xpath = f'//div[@data-testid="tokenList-item" and contains(., "{token_name}") and contains(., "{origin}")]'
        
        # Scroll to the token item and click it
        token_element = page.locator(token_item_xpath)
        await token_element.scroll_into_view_if_needed()
        await token_element.click()
        
        # Check for warning and accept if present
        warning_button = page.locator('[data-testid="secondToken-selector-content"] button:has-text("Ok, I understand")')
        if await warning_button.count() > 0:
            await warning_button.click()
        
        return ActionResult(
            extracted_content=f'Selected {token_name} ({origin}) in You Get section',
            output_data={'get_token_selected': True, 'get_token_name': token_name, 'get_token_origin': origin}
        )

    @controller.action('Search token in selector')
    async def search_token(browser: Browser, search_text: str):
        """
        Search for a token in the currently open token selector
        
        Args:
            browser: Browser instance
            search_text: Text to search for
        """
        page = await browser.get_current_page()
        
        # Find and use the search input in the token selector
        search_input = page.locator('input[placeholder*="Search"]')
        await search_input.fill(search_text)
        
        return ActionResult(
            extracted_content=f'Searched for "{search_text}" in token selector',
            output_data={'token_search': search_text}
        )

    @controller.action('Set You Pay amount')
    async def set_pay_amount(browser: Browser, amount: str):
        """
        Sets the amount in the 'You Pay' input field
        
        Args:
            browser: Browser instance
            amount: Amount to set
        """
        page = await browser.get_current_page()
        
        # Click and fill the input
        pay_input = page.locator('[data-testid="firstToken-input"]')
        await pay_input.click()
        await pay_input.fill(amount)
        
        return ActionResult(
            extracted_content=f'Set You Pay amount to {amount}',
            output_data={'pay_amount': float(amount) if amount.replace('.', '', 1).isdigit() else amount}
        )

    @controller.action('Set You Get amount')
    async def set_get_amount(browser: Browser, amount: str):
        """
        Sets the amount in the 'You Get' input field
        
        Args:
            browser: Browser instance
            amount: Amount to set
        """
        page = await browser.get_current_page()
        
        # Click and fill the input
        get_input = page.locator('[data-testid="secondToken-input"]')
        await get_input.click()
        await get_input.fill(amount)
        
        return ActionResult(
            extracted_content=f'Set You Get amount to {amount}',
            output_data={'get_amount': float(amount) if amount.replace('.', '', 1).isdigit() else amount}
        )

    @controller.action('Switch tokens')
    async def switch_tokens(browser: Browser):
        """
        Switches the Pay and Get tokens
        """
        page = await browser.get_current_page()
        
        # Click the switch button
        await page.locator('[data-testid="switchTokens"]').click()
        
        return ActionResult(
            extracted_content='Switched You Pay and You Get tokens',
            output_data={'tokens_switched': True}
        )

    @controller.action('Toggle trade details')
    async def toggle_trade_details(browser: Browser):
        """
        Toggles the trade details section
        """
        page = await browser.get_current_page()
        
        # Click the toggle button
        await page.locator('[data-testid="toggle-trade-details"]').click()
        
        return ActionResult(
            extracted_content='Toggled trade details section',
            output_data={'trade_details_toggled': True}
        )
    
    @controller.action('Click swap button')
    async def click_swap_button(browser: Browser):
        """
        Clicks the swap button
        """
        page = await browser.get_current_page()
        
        # Click the swap button
        await page.locator('[data-testid="submitSwap"]').click()
        
        return ActionResult(
            extracted_content='Clicked swap button',
            output_data={'swap_button_clicked': True}
        )

    @controller.action('Open swap settings')
    async def open_swap_settings(browser: Browser):
        """
        Opens the swap settings
        """
        page = await browser.get_current_page()
        
        # Click the settings button
        await page.locator('button[class*="outline-none min-w-[0] bg-transparent"]').click()
        
        return ActionResult(
            extracted_content='Opened swap settings',
            output_data={'swap_settings_opened': True}
        )

    @controller.action('Toggle autorouting')
    async def toggle_autorouting(browser: Browser):
        """
        Toggles the autorouting option in swap settings
        """
        page = await browser.get_current_page()
        
        # Click the autorouting checkbox
        await page.locator('label[class*="rounded-full self-start"]').click()
        
        return ActionResult(
            extracted_content='Toggled autorouting setting',
            output_data={'autorouting_toggled': True}
        )

    return controller

def initialize_laminar():
    """Initialize Laminar with the project API key"""
    Laminar.initialize(project_api_key=os.getenv('LMNR_PROJECT_API_KEY'))

def run_agent_test(task, initial_actions, browser_context, controller, llm, output_class):
    """
    Helper function to run an agent test with standardized configuration
    
    Args:
        task: The task for the agent to perform
        initial_actions: List of initial actions to perform
        browser_context: Browser context fixture
        controller: Controller with registered actions
        llm: LLM fixture
        output_class: Pydantic model class for output validation
    
    Returns:
        Coroutine that runs the agent and validates the result
    """
    async def _run_test():
        # Initialize Laminar
        initialize_laminar()
        
        # Create an agent with the task
        agent = Agent(
            task=task,
            initial_actions=initial_actions,
            llm=llm,
            browser_context=browser_context,
            controller=controller,
            generate_gif='tmp/agent_history.gif'
        )

        # Run the agent
        history = await agent.run()
        result = history.final_result()

        # Verify the result exists
        assert result is not None, "No result was returned"

        # Parse the result
        parsed = output_class.model_validate_json(result)
        
        return parsed
        
    return _run_test()