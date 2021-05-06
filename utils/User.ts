
import { Keyring } from '@polkadot/api';
import { KeyringInstance, KeyringPair, KeyringPair$Json, KeyringPair$JsonEncodingTypes, KeyringPair$Meta, KeyringOptions } from '@polkadot/keyring/types';
import { getuid } from 'process';
import { v4 as uuid } from 'uuid';

export class User {
    /**
     * class that represent the user and wallet.
     */
    keyRingPair : KeyringPair;
    name : String;
    
    constructor(keyring : Keyring ,name = '') {
        if(!name){
            name = '//testUser_' + uuid();
        }
        this.name = name;
        this.keyRingPair = keyring.createFromUri(name);          
    }

}

