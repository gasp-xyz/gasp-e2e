import pytest
from pydantic import BaseModel
from utils.common_test_utils import (
    get_initial_actions, 
    browser, 
    browser_context, 
    llm, 
    create_base_controller,
    run_agent_test
)


class BinanceOutput(BaseModel):
    binance_wallet_connector_visible: bool
    binance_modal_opened: bool


@pytest.fixture
def controller_with_actions_binance():
    """Fixture that provides a controller with necessary actions registered"""
    return create_base_controller(BinanceOutput)

class WalletOutput(BaseModel):
    metamask_wallet_connector_visible: bool
    walletconnect_wallet_connector_visible: bool
    binance_wallet_connector_visible: bool


@pytest.fixture
def controller_with_actions_wallet():
    """Fixture that provides a controller with necessary actions registered"""
    return create_base_controller(WalletOutput)


@pytest.mark.asyncio
@pytest.mark.wallet
async def test_gasp_wallets_binance(browser_context, controller_with_actions_binance, llm):
    # Get initial actions for home page
    initial_actions = get_initial_actions()
    
    # Define the task
    task = """
    1. Open wallet connection infousing open_wallet_connection_info
    2. check what wallet connectors are visible now
    3. click on binance wallet
    4. wait and check if Connect With Binance modal was opened with qr code
    """
    
    # Run the test
    parsed = await run_agent_test(
        task=task,
        initial_actions=initial_actions,
        browser_context=browser_context,
        controller=controller_with_actions_binance,
        llm=llm,
        output_class=BinanceOutput
    )

    # Assertions specific to this test
    assert parsed.binance_wallet_connector_visible == True
    assert parsed.binance_modal_opened == True

@pytest.mark.asyncio
@pytest.mark.wallet
async def test_gasp_wallets(browser_context, controller_with_actions_wallet, llm):
    # Get initial actions for home page
    initial_actions = get_initial_actions()
    
    # Define the task
    task = """
    1. Open wallet connection infousing open_wallet_connection_info
    2. check what wallet connectors are visible now
    """
    
    # Run the test
    parsed = await run_agent_test(
        task=task,
        initial_actions=initial_actions,
        browser_context=browser_context,
        controller=controller_with_actions_wallet,
        llm=llm,
        output_class=WalletOutput
    )

    # Assertions specific to this test
    assert parsed.metamask_wallet_connector_visible == True
    assert parsed.walletconnect_wallet_connector_visible == True
    assert parsed.binance_wallet_connector_visible == True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
