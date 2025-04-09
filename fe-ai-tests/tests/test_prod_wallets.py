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


class Output(BaseModel):
    metamask_wallet_connector_visible: bool
    walletconnect_wallet_connector_visible: bool
    binance_wallet_connector_visible: bool
    binance_modal_opened: bool


@pytest.fixture
def controller_with_actions():
    """Fixture that provides a controller with necessary actions registered"""
    return create_base_controller(Output)


@pytest.mark.asyncio
@pytest.mark.wallet
async def test_gasp_wallets(browser_context, controller_with_actions, llm):
    # Get initial actions for home page
    initial_actions = get_initial_actions()
    
    # Define the task
    task = """
    1. using vision click Connect your wallet button on right top side of the site
    2. check what wallet connectors are visible now
    3. click on binance wallet
    4. wait and check if Connect With Binance modal was opened with qr code
    """
    
    # Run the test
    parsed = await run_agent_test(
        task=task,
        initial_actions=initial_actions,
        browser_context=browser_context,
        controller=controller_with_actions,
        llm=llm,
        output_class=Output
    )

    # Assertions specific to this test
    assert parsed.metamask_wallet_connector_visible == True
    assert parsed.walletconnect_wallet_connector_visible == True
    assert parsed.binance_wallet_connector_visible == True
    assert parsed.binance_modal_opened == True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
