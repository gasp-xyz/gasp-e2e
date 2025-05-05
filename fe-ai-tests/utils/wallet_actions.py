"""
Wallet-related actions for browser automation testing.
This module contains controller actions for interacting with wallet components in the UI.
"""

from browser_use import Browser, ActionResult

class WalletActions:
    """
    Collection of wallet-related actions that can be registered with a controller.
    
    Usage:
        controller = Controller(output_model=YourOutputModel)
        wallet_actions = WalletActions()
        wallet_actions.register_actions(controller)
    """
    
    @staticmethod
    async def check_wallet_connection(browser: Browser):
        """
        Check if wallet is connected
        
        Returns:
            ActionResult with information about wallet connection status
        """
        page = await browser.get_current_page()
        
        # Check for wallet connected status using data-testid="wallet-status-connected"
        status_connected = await page.locator('[data-testid="wallet-status-connected"]').count() > 0
        
        return ActionResult(
            extracted_content=f'Wallet is {"connected" if status_connected else "not connected"}',
            output_data={'wallet_connected': status_connected}
        )

    @staticmethod
    async def open_wallet_connection_info(browser: Browser):
        """
        Open wallet connection info dialog by hovering over wallet status and clicking open wallet button
        if deposit option is not already visible
        
        Args:
            browser: Browser instance
        
        Returns:
            ActionResult with information about wallet connection info
        """
        page = await browser.get_current_page()
        
        # Check if deposit button is already visible
        deposit_button = page.locator('button:has-text("Deposit")')
        is_deposit_displayed = await deposit_button.count() > 0 and await deposit_button.is_visible()
        
        if not is_deposit_displayed:
            # Hover over wallet status element
            wallet_status = page.locator('[data-testid="wallet-status"]')
            await wallet_status.hover()
            
            # Click the open wallet button
            open_wallet_button = page.locator('[data-testid="open-wallet"]')
            await open_wallet_button.click()
        
        return ActionResult(
            extracted_content='Wallet connection info opened',
            output_data={'wallet_info_opened': True}
        )

    @staticmethod
    async def connect_wallet(browser: Browser, wallet_type: str = "metamask"):
        """
        Connect wallet to the application
        
        Args:
            browser: Browser instance
            wallet_type: Type of wallet to connect (default: "metamask")
        
        Returns:
            ActionResult with information about wallet connection
        """
        page = await browser.get_current_page()
        
        # Check if already connected
        if await page.locator('[data-testid="wallet-status-connected"]').count() > 0:
            return ActionResult(
                extracted_content='Wallet is already connected',
                output_data={'wallet_connected': True, 'was_connected': True}
            )
        
        # Click wallet connect button
        await page.locator('[data-testid="wallet-notConnected-cta"]').click()
        
        # Wait for wallet options to be visible
        await page.locator(f'[data-testid="installedWallets-walletCard-{wallet_type}"]').wait_for()
        
        # Click the desired wallet type
        await page.locator(f'[data-testid="installedWallets-walletCard-{wallet_type}"]').click()
        
        # Wait for wallet connection (this might need to be customized based on the actual flow)
        await page.locator('[data-testid="wallet-status-connected"]').wait_for()
        
        return ActionResult(
            extracted_content=f'Connected to {wallet_type} wallet',
            output_data={'wallet_connected': True, 'wallet_type': wallet_type}
        )

    @staticmethod
    async def open_wallet_settings(browser: Browser):
        """
        Open wallet settings
        
        Args:
            browser: Browser instance
        
        Returns:
            ActionResult with information about wallet settings
        """
        page = await browser.get_current_page()
        
        # Open wallet settings by clicking the settings button
        await page.locator('[data-testid="wallet-wrapper-header-settings"]').click()
        
        return ActionResult(
            extracted_content='Opened wallet settings',
            output_data={'wallet_settings_opened': True}
        )

    @staticmethod
    async def select_my_tokens_tab(browser: Browser):
        """
        Select 'My Tokens' tab in wallet interface
        
        Args:
            browser: Browser instance
        
        Returns:
            ActionResult with information about selected tab
        """
        page = await browser.get_current_page()
        
        # Click on My Tokens tab
        await page.locator('[data-testid="My-Tokens-item"]').click()
        
        # Wait for tokens to be visible
        await page.locator('[data-testid="my-tokens"]').wait_for()
        
        return ActionResult(
            extracted_content='Selected My Tokens tab',
            output_data={'selected_tab': 'my_tokens'}
        )

    @staticmethod
    async def select_my_positions_tab(browser: Browser):
        """
        Select 'My Positions' tab in wallet interface
        
        Args:
            browser: Browser instance
        
        Returns:
            ActionResult with information about selected tab
        """
        page = await browser.get_current_page()
        
        # Click on My Positions tab
        await page.locator('[data-testid="My-Positions-item"]').click()
        
        # Wait for positions to be visible
        await page.locator('[data-testid="my-positions"]').wait_for()
        
        return ActionResult(
            extracted_content='Selected My Positions tab',
            output_data={'selected_tab': 'my_positions'}
        )

    @staticmethod
    async def check_token_amount(browser: Browser, token_name: str, origin: str = "Native"):
        """
        Check the amount of a specific token in the 'My Tokens' tab
        
        Args:
            browser: Browser instance
            token_name: Name of the token to check
            origin: Origin of the token (default: "Native")
        
        Returns:
            ActionResult with information about token amount
        """
        page = await browser.get_current_page()
        
        # Ensure My Tokens tab is selected
        if await page.locator('[data-testid="my-tokens"]').count() == 0:
            await page.locator('[data-testid="My-Tokens-item"]').click()
            await page.locator('[data-testid="my-tokens"]').wait_for()
        
        # Locate the token row
        token_row_selector = f'[data-testid="my-tokens"] [data-testid="{token_name}-token-row"]'
        
        # Wait for the token row to be visible
        await page.locator(token_row_selector).wait_for()
        
        # Get the amount from the token row
        amount_selector = f'{token_row_selector} [data-testid="token-amount"]'
        amount_text = await page.locator(amount_selector).text_content()
        
        # Clean the amount (remove commas)
        cleaned_amount = amount_text.replace(',', '')
        amount = float(cleaned_amount) if cleaned_amount.replace('.', '', 1).isdigit() else cleaned_amount
        
        # Get fiat value if available
        fiat_value = None
        try:
            fiat_selector = f'{token_row_selector} [data-testid="fiat-value"]'
            fiat_text = await page.locator(fiat_selector).text_content()
            # Clean the fiat value (remove currency symbols and commas)
            fiat_value = fiat_text.replace('$', '').replace(',', '')
            fiat_value = float(fiat_value) if fiat_value.replace('.', '', 1).isdigit() else fiat_value
        except:
            # Fiat value might not be available for all tokens
            pass
        
        return ActionResult(
            extracted_content=f'{token_name} ({origin}) amount: {amount_text}',
            output_data={
                'token_name': token_name,
                'token_origin': origin,
                'token_amount': amount,
                'token_fiat_value': fiat_value
            }
        )

    @staticmethod
    async def check_position(browser: Browser, pool_name: str):
        """
        Check if a specific position exists in the 'My Positions' tab
        
        Args:
            browser: Browser instance
            pool_name: Name of the pool position to check
        
        Returns:
            ActionResult with information about the position
        """
        page = await browser.get_current_page()
        
        # Ensure My Positions tab is selected
        if await page.locator('[data-testid="my-positions"]').count() == 0:
            await page.locator('[data-testid="My-Positions-item"]').click()
            await page.locator('[data-testid="my-positions"]').wait_for()
        
        # Check if the position exists
        position_selector = f'[data-testid="my-positions"] >> text={pool_name}'
        position_exists = await page.locator(position_selector).count() > 0
        
        return ActionResult(
            extracted_content=f'Position {pool_name} {"exists" if position_exists else "does not exist"}',
            output_data={'position_exists': position_exists, 'pool_name': pool_name}
        )

    @staticmethod
    async def open_deposit(browser: Browser):
        """
        Open deposit dialog
        
        Args:
            browser: Browser instance
        
        Returns:
            ActionResult with information about deposit dialog
        """
        page = await browser.get_current_page()
        
        # Click deposit button
        await page.locator('button:has-text("Deposit")').click()
        
        return ActionResult(
            extracted_content='Opened deposit dialog',
            output_data={'deposit_opened': True}
        )

    @staticmethod
    async def open_withdraw(browser: Browser):
        """
        Open withdraw/send dialog
        
        Args:
            browser: Browser instance
        
        Returns:
            ActionResult with information about withdraw dialog
        """
        page = await browser.get_current_page()
        
        # Click send button
        await page.locator('button:has-text("Send")').click()
        
        return ActionResult(
            extracted_content='Opened withdraw/send dialog',
            output_data={'withdraw_opened': True}
        )

    @staticmethod
    async def wait_for_token_amount_change(browser: Browser, token_name: str, initial_amount: str, origin: str = "Native", max_wait_time: int = 300):
        """
        Wait for token amount to change from initial value
        
        Args:
            browser: Browser instance
            token_name: Name of the token to monitor
            initial_amount: Initial amount to compare against
            origin: Origin of the token (default: "Native")
            max_wait_time: Maximum time to wait in seconds (default: 300 seconds / 5 minutes)
        
        Returns:
            ActionResult with information about token amount change
        """
        page = await browser.get_current_page()
        
        # Ensure My Tokens tab is selected
        if await page.locator('[data-testid="my-tokens"]').count() == 0:
            await page.locator('[data-testid="My-Tokens-item"]').click()
            await page.locator('[data-testid="my-tokens"]').wait_for()
        
        # Build the selector for token amount
        token_row_selector = f'[data-testid="my-tokens"] [data-testid="{token_name}-token-row"]'
        amount_selector = f'{token_row_selector} [data-testid="token-amount"]'
        
        # Set up a timeout for the wait
        try:
            # Wait for the token amount to change with a condition
            await page.wait_for_function(
                f"""
                () => {{
                    const element = document.querySelector('{amount_selector}');
                    if (!element) return false;
                    const text = element.textContent || '';
                    const cleaned = text.replace(/,/g, '');
                    return cleaned !== '{initial_amount}';
                }}
                """,
                timeout=max_wait_time * 1000
            )
            
            # Get the new amount
            new_amount_text = await page.locator(amount_selector).text_content()
            new_amount = new_amount_text.replace(',', '')
            
            return ActionResult(
                extracted_content=f'{token_name} amount changed from {initial_amount} to {new_amount}',
                output_data={
                    'token_name': token_name,
                    'token_origin': origin,
                    'initial_amount': initial_amount,
                    'new_amount': new_amount,
                    'amount_changed': True
                }
            )
        except:
            return ActionResult(
                extracted_content=f'{token_name} amount did not change from {initial_amount} within {max_wait_time} seconds',
                output_data={
                    'token_name': token_name,
                    'token_origin': origin,
                    'initial_amount': initial_amount,
                    'amount_changed': False
                }
            )

    def register_actions(self, controller):
        """
        Register all wallet actions with the provided controller
        
        Args:
            controller: Controller instance to register actions with
        """
        # Register all action methods with the controller
        controller.action('Check wallet connection status')(self.check_wallet_connection)
        controller.action('Open wallet connection info')(self.open_wallet_connection_info)
        controller.action('Connect wallet')(self.connect_wallet)
        controller.action('Open wallet settings')(self.open_wallet_settings)
        controller.action('Select My Tokens tab in wallet')(self.select_my_tokens_tab)
        controller.action('Select My Positions tab in wallet')(self.select_my_positions_tab)
        controller.action('Check token amount in wallet')(self.check_token_amount)
        controller.action('Check position in wallet')(self.check_position)
        controller.action('Open deposit dialog')(self.open_deposit)
        controller.action('Open withdraw/send dialog')(self.open_withdraw)
        controller.action('Wait for token amount to change')(self.wait_for_token_amount_change)
