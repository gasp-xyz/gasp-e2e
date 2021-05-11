# E2E tests
This project has been created to test individual and combined API functionalities that Mangata exchange offers.

---
###  How to setup
1. Install node ( v14.16.1 )
2. Clone the code
3. Run `npm install` in the root folder.
4. Install Jest test framework globally. `npm i jest -g `
---
###  How to configure
To point to the right environment or instance, you need to export the following environment variables:

1. TEST_PALLET_ADDRESS: This contains the address to the pallet wallet. 
`export TEST_PALLET_ADDRESS='PalletAddressComehere' ` more info available in `mangate-node: node/src/chain_spec.rs`
2. API_URL: Points the API to the right environment. The default will be localhost (`ws://127.0.0.1:9944`).
`export API_URL='ws://127.0.0.1:9944'`
---
###  How to run
After that env. variables have been exported, you can run all tests with the command
 `jest` or `./node_modules/.bin/jest`

You can specify the command `--runInBand` if you don't want to run the tests in parallel