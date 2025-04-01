# GASP Frontend AI Tests

Automated tests for the GASP UI using Playwright and PDM.

## Getting Started

This project uses [PDM](https://pdm-project.org/) for dependency management.

1. **Install PDM**: Follow the [official installation guide](https://pdm-project.org/en/latest/#installation)

2. **Setup project**:

   ```bash
   cd fe-ai-tests
   pdm install
   pdm run playwright install chromium
   ```

3. **Run tests**:

   ```bash
   # Run specific test
   pdm run pytest collator_details_prod_test.py -v

   # Run all tests
   pdm run pytest
   ```

## Environment Variables

Create a `.env` file with:

```bash
UI_URL=https://app.gasp.xyz
LMNR_PROJECT_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

## Managing Dependencies

```bash
# Add a new dependency
pdm add package-name

# Add a development dependency (like testing tools)
pdm add -d pytest

# Update all dependencies
pdm update
```

## Common Issues

1. **Missing browsers**: Run `pdm run playwright install chromium`
2. **No environment activation needed**: Use `pdm run` to execute commands in the environment
