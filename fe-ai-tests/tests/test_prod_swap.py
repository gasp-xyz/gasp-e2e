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

class SwapOutput(BaseModel):
    you_pay_amount: float
    you_get_amount: float
    pay_token_name: str
    get_token_name: str
    swap_rate_visible: bool
    min_received: float
    price_impact: float
    comission: float
    security_lock_visible: bool


@pytest.fixture
def controller_with_actions():
    """Fixture that provides a controller with necessary actions registered"""
    return create_base_controller(SwapOutput)


@pytest.mark.asyncio
@pytest.mark.swap
async def test_gasp_wallets(browser_context, controller_with_actions, llm):
    # Get initial actions for home page
    initial_actions = get_initial_actions()
    
    # Define the task
    task = """
    before doing any action assess if there is predefined function in controller that could be used instead
    1. Select token from You Pay section with token_name="GASP" and origin="Native" using select_pay_token
    2. using select_get_token Select token from You Get section with token_name="USDT" and origin="Ethereum"
    3. using set_get_amount Set You Get amount to 10
    4. check all visible swap details and you pay field
    """
    
    # Run the test
    parsed = await run_agent_test(
        task=task,
        initial_actions=initial_actions,
        browser_context=browser_context,
        controller=controller_with_actions,
        llm=llm,
        output_class=SwapOutput
    )

    # Assertions
    assert parsed.you_pay_amount > 0
    assert parsed.swap_rate_visible == True
    assert parsed.min_received > 0
    assert parsed.price_impact > 0
    assert parsed.comission > 0
    assert parsed.security_lock_visible == True
    assert parsed.get_token_name == "USDT"
    assert parsed.pay_token_name == "GASP"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
