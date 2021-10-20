ARG VARIANT="16-buster"
FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0-${VARIANT}

# System dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        build-essential \
        libssl-dev
    
# Install cmake for xoshiro
RUN wget https://github.com/Kitware/CMake/releases/download/v3.20.2/cmake-3.20.2.tar.gz \
    && tar -zxvf cmake-3.20.2.tar.gz \
    && cd cmake-3.20.2 \
    && ./bootstrap \
    && make \
    && make install 

# Export variables
ENV TEST_PALLET_ADDRESS='5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2'
ENV API_URL='ws://node_alice:9944'
ENV TEST_USER_NAME='//Alice'
ENV LOG_INFO='info'
ENV UI_URL='https://staging.mangata.finance/'
ENV TEST_PALLET_ADDRESS=5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2 
ENV E2E_XYK_PALLET_ADDRESS=5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2 
ENV E2E_TREASURY_PALLET_ADDRESS=5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z 
ENV E2E_TREASURY_BURN_PALLET_ADDRESS=5EYCAe5ijiYfyeZ2JJezKNMZfdbiFMyQc4YVzxaiMebAZBcm 
ENV API_URL=ws://127.0.0.1:9944