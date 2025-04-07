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
    welcome_modal_dismissed: bool
    first_collator_rewards: float
    first_collator_stake: float


@pytest.fixture
def controller_with_actions():
    """Fixture that provides a controller with necessary actions registered"""
    return create_base_controller(Output)


@pytest.mark.asyncio
async def test_gasp_website(browser_context, controller_with_actions, llm):
    # Get initial actions for staking page
    initial_actions = get_initial_actions("/staking")
    
    # Define the task
    task = """
    1. click first element on Active Collators table with click_first_collator
    2. retrieve collator stats
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
    assert parsed.first_collator_rewards > 0, "First collator rewards should be greater than 0"
    assert parsed.first_collator_stake > 0, "First collator stake should be greater than 0"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
