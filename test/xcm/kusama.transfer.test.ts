import { connectVertical } from '@acala-network/chopsticks'
import { KeyringPair } from '@polkadot/keyring/types'

import { balance, Context, expectEvent, expectExtrinsicSuccess, expectJson, sendTransaction, testingPairs } from '../../utils/Framework/XcmHelper'
import networks from '../../utils/Framework/XcmNetworks'

/**
 * @group xcm
 * @group proxied
 */
describe('XCM tests for Mangata <-> Kusama', () => {

    let kusama: Context;
    let mangata: Context;
    let alice: KeyringPair;

    beforeAll(async () => {
        kusama = await networks.kusama()
        mangata = await networks.mangata()
        await connectVertical(kusama.chain, mangata.chain)
        alice = testingPairs().alice
    })


    afterAll(async () => {
        await kusama.teardown()
        await mangata.teardown()
    })

    beforeEach(async () => {
        await mangata.dev.setStorage({
            Tokens: {
                Accounts: [
                    [[alice.address, { token: 4 }], { free: 10 * 1e12 }],
                    [[alice.address, { token: 0 }], { free: (1000n * 10n ** 18n).toString() }],
                ],
            },
            Sudo: {
                Key: alice.address,
            },
        })
        await kusama.dev.setStorage({
            System: {
                Account: [[[alice.address], { data: { free: 10 * 1e12 } }]],
            },
        })
    })

    it('mangata transfer assets to kusama', async () => {
        let tx = await sendTransaction(
            mangata.api.tx.xTokens
                .transfer(
                    4,
                    1 * 1e12,
                    {
                        V1: {
                            parents: 1,
                            interior: {
                                X1: {
                                    AccountId32: {
                                        network: 'Any',
                                        id: alice.addressRaw,
                                    },
                                },
                            },
                        },
                    },
                    'Unlimited'
                )
                .signAsync(alice)
        )

        await mangata.chain.newBlock()
        await kusama.chain.upcomingBlock()

        expectExtrinsicSuccess(await tx.events)
        expectEvent(await tx.events, {
            event: expect.objectContaining({
                section: 'xTokens',
                method: 'TransferredMultiAssets',
            }),
        })

        expectJson(await mangata.api.query.tokens.accounts(alice.address, 4)).toMatchInlineSnapshot(`
          {
            "free": 9000000000000,
            "frozen": 0,
            "reserved": 0,
          }
        `)

        expect(await balance(kusama.api, alice.address)).toMatchInlineSnapshot(`
          {
            "feeFrozen": 0,
            "free": 10999895428355,
            "miscFrozen": 0,
            "reserved": 0,
          }
        `)

        expectEvent(await kusama.api.query.system.events(), {
            event: expect.objectContaining({
                method: 'ExecutedUpward',
                section: 'ump',
                data: [
                    '0x740fe61d99a98beab81994c32b7f31445044b01b2fd682936fc5e12ec2c229cb',
                    {
                        Complete: expect.anything(),
                    },
                ],
            }),
        })
    })
})
