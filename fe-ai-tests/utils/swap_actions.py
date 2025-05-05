"""
Swap-related actions for browser automation testing.
This module contains controller actions for interacting with token swap components in the UI.
"""

from browser_use import Browser, ActionResult

class SwapActions:
    """
    Collection of swap-related actions that can be registered with a controller.
    
    Usage:
        controller = Controller(output_model=YourOutputModel)
        swap_actions = SwapActions()
        swap_actions.register_actions(controller)
    """
    
    @staticmethod
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

    @staticmethod
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

    @staticmethod
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

    @staticmethod
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

    @staticmethod
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

    @staticmethod
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

    @staticmethod
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
    
    @staticmethod
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

    @staticmethod
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

    @staticmethod
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

    def register_actions(self, controller):
        """
        Register all swap actions with the provided controller
        
        Args:
            controller: Controller instance to register actions with
        """
        # Register all action methods with the controller
        controller.action('Select token from You Pay section')(self.select_pay_token)
        controller.action('Select token from You Get section')(self.select_get_token)
        controller.action('Search token in selector')(self.search_token)
        controller.action('Set You Pay amount')(self.set_pay_amount)
        controller.action('Set You Get amount')(self.set_get_amount)
        controller.action('Switch tokens')(self.switch_tokens)
        controller.action('Toggle trade details')(self.toggle_trade_details)
        controller.action('Click swap button')(self.click_swap_button)
        controller.action('Open swap settings')(self.open_swap_settings)
        controller.action('Toggle autorouting')(self.toggle_autorouting)
