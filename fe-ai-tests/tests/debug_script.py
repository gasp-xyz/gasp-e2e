import asyncio
import os
import logging
from pydantic import BaseModel, SecretStr
from playwright.async_api import async_playwright
from browser_use import Agent, Browser, Controller, ActionResult, BrowserConfig
from browser_use.browser.context import BrowserContextConfig, BrowserContext
from langchain_anthropic import ChatAnthropic
from lmnr import Laminar

# Use these imports if you still want to use the controller creation from common_test_utils
from utils.common_test_utils import create_base_controller, get_initial_actions

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Get UI URL from environment variable with a fallback default
UI_URL = os.getenv('UI_URL', 'https://app.gasp.xyz')

# Define an output model for your task
class DebugOutput(BaseModel):
    """
    Output model for debugging - add fields you want to capture from your actions
    """
    # Common fields that might be useful for debugging
    liq_pools_count: int = 0
    first_pool_volume: float
    first_pool_tvl: float
    first_pool_rewards_apy: float
    all_pools_have_volume: bool
    all_pools_have_tvl: bool
    all_pools_have_rewards_apy: bool
    any_value_out_of_order: bool

async def main_async():
    # Define your task instructions here for easy modification
    task_instructions = """
    before doing any action assess if there is predefined function in controller that could be used instead
    1. Get details of all liquidity pools on the list
    2. asses if any value looks out of order
    """
    
    # Optional: specify a path to append to the base URL
    path = "/pools/promoted"  # e.g., "/swap" if you want to start at a specific page
    
    # Get initial actions (optionally with a specific path)
    initial_actions = get_initial_actions(path)
    
    # Create controller with the output model
    controller = create_base_controller(DebugOutput)
    
    # Initialize Laminar if you're using it
    Laminar.initialize(project_api_key=os.getenv('LMNR_PROJECT_API_KEY'))
    
    # Initialize LLM
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        logger.error("ANTHROPIC_API_KEY environment variable not set")
        return None
        
    llm_instance = ChatAnthropic(
        model_name="claude-3-5-sonnet-20240620",
        temperature=0.0,
        timeout=100,
        api_key=SecretStr(api_key),
    )
    
    # Check if running in a CI environment
    is_ci = os.getenv('CI') == 'true'

    # Configure the Browser launch settings
    browser_config = BrowserConfig(
        headless=is_ci  # Set headless based on CI environment variable
    )

    # Setup browser and context
    async with async_playwright() as p:
        # Create browser instance
        browser_instance = Browser(config=browser_config)
        
        try:
            # Configure browser context
            context_config = BrowserContextConfig(
                browser_window_size={'width': 1300, 'height': 900},
                locale='en-US',
                highlight_elements=True,
                save_recording_path='tmp/record_videos',
            )
            
            # Create browser context
            context = BrowserContext(browser=browser_instance, config=context_config)
            
            try:
                # Create an agent
                agent = Agent(
                    task=task_instructions,
                    initial_actions=initial_actions,
                    llm=llm_instance,
                    browser_context=context,
                    controller=controller,
                    generate_gif='tmp/debug_agent.gif'  # Optional: generate a gif of the agent's actions
                )
                
                # Run the agent
                history = await agent.run()
                result = history.final_result()
                
                # Log and process the result
                if result:
                    logger.info(f"Agent result: {result}")
                    # Parse the result into the model for structured access
                    parsed = DebugOutput.model_validate_json(result)
                    logger.info(f"Parsed output: {parsed.model_dump_json(indent=2)}")
                    
                    # Print summary
                    print("\nDebug run completed successfully!")
                    return parsed
                else:
                    logger.warning("No result was returned by the agent")
                    print("\nDebug run completed with no result.")
                    return None
                    
            finally:
                # Close the browser context
                await context.close()
        finally:
            # Close the browser instance
            await browser_instance.close()


def main():
    """Entry point for running the debug agent"""
    asyncio.run(main_async())


if __name__ == "__main__":
    main()