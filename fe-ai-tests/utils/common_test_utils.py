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

from .swap_actions import SwapActions
from .wallet_actions import WalletActions

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
    
    # Register wallet actions
    wallet_actions = WalletActions()
    wallet_actions.register_actions(controller)
    
    # Register swap actions
    swap_actions = SwapActions()
    swap_actions.register_actions(controller)

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