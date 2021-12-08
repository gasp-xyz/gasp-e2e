# See here for image contents: https://github.com/microsoft/vscode-dev-containers/tree/v0.205.2/containers/typescript-node/.devcontainer/base.Dockerfile

# [Choice] Node.js version (use -bullseye variants on local arm64/Apple Silicon): 16, 14, 12, 16-bullseye, 14-bullseye, 12-bullseye, 16-buster, 14-buster, 12-buster
ARG VARIANT="16-bullseye"
FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0-${VARIANT}

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

# Export variables
ENV TEST_PALLET_ADDRESS='5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2'
ENV API_URL='ws://127.0.0.1:9944'
ENV TEST_USER_NAME='//Alice'
ENV TEST_SUDO_NAME='//Maciatko'
ENV LOG_INFO='info'
ENV UI_URL='https://staging.mangata.finance/'
ENV TEST_PALLET_ADDRESS=5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2 
ENV E2E_XYK_PALLET_ADDRESS=5EYCAe5XGPRojsCSi9p1ZZQ5qgeJGFcTxPxrsFRzkASu6bT2 
ENV E2E_TREASURY_PALLET_ADDRESS=5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z 
ENV E2E_TREASURY_BURN_PALLET_ADDRESS=5EYCAe5ijiYfyeZ2JJezKNMZfdbiFMyQc4YVzxaiMebAZBcm 
# [Optional] Uncomment if you want to install an additional version of node using nvm
# ARG EXTRA_NODE_VERSION=10
# RUN su node -c "source /usr/local/share/nvm/nvm.sh && nvm install ${EXTRA_NODE_VERSION}"

# [Optional] Uncomment if you want to install more global node packages
# RUN su node -c "npm install -g <your-package-list -here>"
