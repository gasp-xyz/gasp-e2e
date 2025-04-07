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
    you_pay_amount: float
    swap_rate_visible: bool
    min_received: float
    price_impact: float
    comission: float
    security_lock_visible: bool


@pytest.fixture
def controller_with_actions():
    """Fixture that provides a controller with necessary actions registered"""
    return create_base_controller(Output)


@pytest.mark.asyncio
@pytest.mark.swap
async def test_gasp_wallets(browser_context, controller_with_actions, llm):
    # Get initial actions for home page
    initial_actions = get_initial_actions()
    
    # Define the task
    task = """
    1. click Select Token from You Pay section and pick GASP native token from modal
    2. click Select Token from You Get section and type USDT in opened modals searchbar, pick USDT with ethereum label
    3. Set You Get input value to 10
    4. check all visible swap details and you pay field
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
    assert parsed.you_pay_amount > 0
    assert parsed.swap_rate_visible == True
    assert parsed.min_received > 0
    assert parsed.price_impact > 0
    assert parsed.comission > 0
    assert parsed.security_lock_visible > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
