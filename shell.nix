with import <nixpkgs> {};

stdenv.mkDerivation {
    name = "node";
    buildInputs = [
        nodejs
        yarn
    ];
    shellHook = ''
        export PATH="$PWD/node_modules/.bin/:$PATH"
        export TEST_SUDO_NAME=//Maciatko 
        export TEST_PALLET_ADDRESS=5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2 
        export E2E_XYK_PALLET_ADDRESS=5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2 
        export E2E_TREASURY_PALLET_ADDRESS=5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z 
        export E2E_TREASURY_BURN_PALLET_ADDRESS=5EYCAe5ijiYfyeZ2JJezKNMZfdbiFMyQc4YVzxaiMebAZBcm 
        export API_URL=ws://127.0.0.1:9944  
    '';
}
