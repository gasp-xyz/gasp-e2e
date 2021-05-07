
import { Keyring } from '@polkadot/api';
import { KeyringInstance, KeyringPair, KeyringPair$Json, KeyringPair$JsonEncodingTypes, KeyringPair$Meta, KeyringOptions } from '@polkadot/keyring/types';
import { getuid } from 'process';
import { v4 as uuid } from 'uuid';
import { getEventResult } from './eventListeners';
import { balanceTransfer } from './tx';

export class User {
    /**
     * class that represent the user and wallet.
     */
    keyRingPair : KeyringPair;
    name : String;
    keyring :Keyring;
    
    constructor(keyring : Keyring ,name = '') {
        if(!name){
            name = '//testUser_' + uuid();
        }
        this.name = name;
        this.keyring = keyring;
        this.keyRingPair = keyring.createFromUri(name);    
        console.warn(`User  ${name} :created: ${this.keyRingPair.address} `);
    }

    addFromAddress(keyring : Keyring, address : string){
        this.keyRingPair = keyring.addFromAddress(address);
        this.name = 'addres_created_account';
    }

    async addBalance(){
        var eventPromise = getEventResult("balances","Endowed", 14);
        await balanceTransfer(new User(this.keyring,'//Alice').keyRingPair,this.keyRingPair.address,Math.pow(10,11));
        var result = await eventPromise;
        eventPromise = getEventResult("balances","Transfer", 14);
        result = await eventPromise;
    }

}
