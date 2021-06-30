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
###  How to run
After that env. variables have been exported, you can run all tests with the command
 `jest` or `./node_modules/.bin/jest`

You can specify the command `--runInBand` if you don't want to run the tests in parallel

There are also some configurations to run tests, 
- `npm run test-parallel` : Run the tests (from `test/parallel/` folder) that can be parallelized.
- `npm run test-sequential` : Run tests (from `test/sequential/` folder) that can not be paralelized so they will run one after the other.