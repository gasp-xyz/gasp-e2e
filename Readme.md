<p align="center">
    <a href="https://https://mangata.finance/">
    <img width="132" height="101" src="https://mangata.finance/images/logo-without-text.svg" class="attachment-full size-full" alt="Mangata brand" loading="lazy" /></a>
</p>

<h2 align="center">Mangata E2E Tests</h2>

<p align="center">
    This project has been created to test individual and combined API functionalities that Mangata exchange offers.
</p>

![Issues](https://img.shields.io/github/issues/mangata-finance/mangata-e2e)
![Pull Request](https://img.shields.io/github/issues-pr/mangata-finance/mangata-e2e)
![GitHub last commit](https://img.shields.io/github/last-commit/mangata-finance/mangata-e2e)
![Build Status](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fmangata-finance%2Fmangata-e2e%2Fbadge%3Fref%3Dmain&style=flat)
![Language](https://img.shields.io/github/languages/top/mangata-finance/mangata-e2e)

---
###  How to setup
1. Install node ( v14.16.1 )
2. Clone the code
3. Run `yarn` in the root folder.
4. Install Jest test framework globally. `yarn global add  jest -g `

### Setup with Dev Container
1. Install `docker`, `docker-compose`, and `vscode`
2. Install the `ms-vscode-remote.remote-containers` vscode extension
3. Run `docker-compose -f devops/dockerfiles/docker-compose.yml up` in a seperate terminal
4. Open the repo in vscode and click 'Reopen in container' or `ctrl+shift+p` and search for _Remote-Containers: Open Folder in Container_

#### Working with Dev Containers
Basically all system and project dependencies should be added to `.devcontainer/Dockerfile` so all developer dependencies are tracked in version control and available to anyone. 

#### Troubleshooting
So somehow we now have essentially a distributed system for developing and that brings its own problems. If you get stuck, tear down chain running in docker-compose, spin it back up, and rebuild the devcontainer. 
1. Close vscode
2. `docker-compose -f devops/dockerfiles/docker-compose.yml down`
3. `docker-compose -f devops/dockerfiles/docker-compose.yml up`
4. Re-open vscode
5. `ctrl+shift+p` and search for _Remote-Containers: Rebuild and Reopen in Container_
---
###  How to build
1. `yarn`
###  How to run esLint
1. Follow the mangata eslint installation guide [here](https://github.com/mangata-finance/eslint-config-mangata)
2. `yarn eslint`

###  How to configure
If you run test on your machine first you need to set using `yarn`.
1. Clone **/mangata-e2e** and then delete folder **/node_modules** and file **yarn.lock**
2. Run `yarn` in **/mangata-e2e**. This command begin installation and creating necessary files for `yarn`.
3. If process will finish correct you'll see folder **/node_modules** and **file yarn.lock**

After each running you system you need to configure some parameters for test.
Use this pattern (don't forget to add parameters instead of <text in the same barackets>): `export TEST_SUDO_NAME=//<You need insert name here> && export TEST_PALLET_ADDRESS=5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2 && export E2E_XYK_PALLET_ADDRESS=5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2 && export E2E_TREASURY_PALLET_ADDRESS=5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z && export E2E_TREASURY_BURN_PALLET_ADDRESS=5EYCAe5ijiYfyeZ2JJezKNMZfdbiFMyQc4YVzxaiMebAZBcm && API_URL=ws://<You need insert url here> && export MNEMONIC_POLK="<You need insert information about mnemonic polk here>" && export MNEMONIC_META="<You need insert information about mnemonic meta here>" && export UI_URL=http://localhost:3000/`


####  Node tests ( no UI )
To point to the right environment or instance, you need to export the following environment variables:

1. E2E_XYK_PALLET_ADDRESS: This contains the address to the pallet wallet. 
`export E2E_XYK_PALLET_ADDRESS='PalletAddressComehere' ` more info available in `mangate-node: node/src/chain_spec.rs`
2. TEST_SUDO_NAME: This contains the name of sudo user to perform required sudo perations. 
`export TEST_SUDO_NAME='//nameofTheUser' ` more info available in `mangate-node: node/src/chain_spec.rs`
3. API_URL: Points the API to the right environment. The default will be localhost (`ws://127.0.0.1:9944`).
`export API_URL='ws://127.0.0.1:9944'`
4. TEST_USER_NAME: Contains the name of the user for CI/CD validation tests. Default is `//Alice` (address `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY`)
`export TEST_USER_NAME='//Alice'`
5. LOG_LEVEL: Handles the test log_levels:[error,warn,info,http,verbose,debug,silly] , default: `info`.

---
####  Node tests ( UI )

1. API_URL: UI tests need the API to do and setup some internal stuff.  `export API_URL='wss://staging.testnode.mangata.finance:9945'`
2. UI_URL : UI tests need a UI to test with. Important that the tested UI  points to the same API_URL you exported before . `export UI_URL='https://staging.mangata.finance/'`
3. MNEMONIC_META: In order to setup Metamask extension, we need the mnemonic for that account. This is available as a secret in Github .`export MNEMONIC_META='dismiss blabla bla .. trumpet' ` ( Ask Gonzalo :) )

###  How to run
After that env. variables have been exported, you can run all tests with the command
 `jest` or `./node_modules/.bin/jest`

You can specify the command `--runInBand` if you don't want to run the tests in parallel

There are also some configurations to run tests, 
- `npm run test-parallel` : Run the tests (from `test/parallel/` folder) that can be parallelized.
- `npm run test-sequential` : Run tests (from `test/sequential/` folder) that can not be paralelized so they will run one after the other.

- `npm run test-ui` : Run tests (from `test/ui/` folder). They contain UI tests.

Finally, there are groups that can be ran instead.

These are ran like so: jest --group=sequential. Multiple groups can be ran like jest --group=group1 --group=group2.

At the moment groups are split between testing configurations (parallel, sequential, etc) and pallets (api, asset, liquidity, sudo, etc). They can be found in docstrings at the top of any test file.

###  How to run in a docker setup
There exist a possibility to run test pointing to a dockerized setup. You only need to :
1. Download and run docker instance:  `docker-compose -f devops/docker-compose.yml up`
2. Point to that node ( ip can be obtained from the docker-compose) exporting `API_URL='ws://172.16.238.10:9944`.`
3. Run any test `yarn test-sequential`.

### Reports reports reports!
https://mangata-finance.github.io/mangata-e2e



### How to setup on Windows
- Follow all the steps from [here](https://ubuntu.com/tutorials/working-with-visual-studio-code-on-ubuntu-on-wsl2#4-install-the-remote-development-extension)
- Install `yarn` and do `yarn install`
- Install nvm: `curl -sL https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.0/install.sh -o install_nvm.sh`
- Install latest node version: `nvm install v16.15.0`
- (Optional) `sudo cp /home/<usr>/.nvm/versions/node/v16.15.0/bin/node /usr/bin/`
- Install Jest extension ( into wsl ) 
- Install python: `apt-get install python`
- You need to check version before you will be debugging test. Use `nvm version` (or `nvm ls`) and  `yarn --version`
- If version of nvm on your local machine is lower than v16.15.0 as default, you need to fix this: `nvm alias default v16.15.0`
- Debug test
    