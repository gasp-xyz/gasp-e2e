import { lockSudoFile, unlockSudoFile } from "./lock";
import { getCurrentNonce } from "./tx";
const fs = require('fs');

export class SudoDB {

    private sudoNounceFileName = 'nunce.sudo';

    constructor() {

    }

    private static instance: SudoDB
    
    // build the singleton.
    public static getInstance(): SudoDB {
        if (!SudoDB.instance) {
            SudoDB.instance = new SudoDB()
        }
        return SudoDB.instance
    }
    
    public async getSudoNonce(sudoAddress) {
        
        try{
            // we need to prevent workers accessing and writing to the file concurrently
            await lockSudoFile();
            const chainNonce = await getCurrentNonce(sudoAddress);
            const chainNodeInt = parseInt(chainNonce);
    
            //if does not exist, create it
            if(!fs.existsSync(this.sudoNounceFileName))
                fs.writeFileSync('nunce.sudo','0');
            var dbNonce =  fs.readFileSync('nunce.sudo',{encoding:'utf8', flag:'r'});
    
            if(dbNonce === undefined || chainNodeInt > parseInt(dbNonce) ) {
                dbNonce = chainNodeInt;
            }
            const nextNonce = parseInt(dbNonce) +1;
    
            fs.writeFileSync(this.sudoNounceFileName,String(nextNonce));

        }finally{
            //unlock always!
            unlockSudoFile();
        }

       
        
        return dbNonce;
    }

}