
export function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

export function getEnvironmentRequiredVars(){
    const palletAddress = process.env.TEST_PALLET_ADDRESS ? process.env.TEST_PALLET_ADDRESS : '';
    const sudoUserName = process.env.TEST_SUDO_NAME ? process.env.TEST_SUDO_NAME : '';
    expect(palletAddress.length).not.toEqual(0);
    expect(sudoUserName.length).not.toEqual(0);
    const uri = process.env.API_URL ? process.env.API_URL: 'ws://127.0.0.1:9944';
    return {pallet: palletAddress, sudo: sudoUserName, chainUri:uri};
}