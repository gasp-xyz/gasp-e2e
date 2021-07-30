# E2E tests
This project has been created to test individual and combined API functionalities that Mangata exchange offers.

---
###  How to setup
1. Install node ( v14.16.1 )
2. Clone the code
3. Run `yarn` in the root folder.
4. Install Jest test framework globally. `yarn global add  jest -g `
---
###  How to build
1. `npm run build`
###  How to run esLint
1. `npm run eslint`

###  How to configure

####  Node tests ( no UI )
To point to the right environment or instance, you need to export the following environment variables:

1. TEST_PALLET_ADDRESS: This contains the address to the pallet wallet. 
`export TEST_PALLET_ADDRESS='PalletAddressComehere' ` more info available in `mangate-node: node/src/chain_spec.rs`
2. TEST_SUDO_NAME: This contains the name of sudo user to perform required sudo perations. 
`export TEST_SUDO_NAME='//nameofTheUser' ` more info available in `mangate-node: node/src/chain_spec.rs`
3. API_URL: Points the API to the right environment. The default will be localhost (`ws://127.0.0.1:9944`).
`export API_URL='ws://127.0.0.1:9944'`
4. TEST_USER_NAME: Contains the name of the user for CI/CD validation tests. Default is `//Alice` (address `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY`)
`export TEST_USER_NAME='//Alice'`

---
####  Node tests ( UI )

1. API_URL: UI tests need the API to do and setup some internal stuff.  `export API_URL=wss://staging.testnode.mangata.finance:9945`
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

###  How to run in a docker setup
There exist a possibility to run test pointing to a dockerized setup. You only need to :
1. Download and run docker instance:  `docker-compose -f devops/docker-compose.yml up`
2. Point to that node ( ip can be obtained from the docker-compose) exporting `API_URL='ws://172.16.238.10:9944`.`
3. Run any test `yarn test-sequential`.


