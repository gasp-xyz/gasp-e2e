FROM node:18.16.0 AS node_base

RUN echo "NODE Version:" && node --version
RUN echo "NPM Version:" && npm --version

ARG GCC_VERSION=10
ARG CMAKE_VERSION=3.21.0
ARG BRANCH=main
ARG FE_BRANCH=main
ARG GITHUB_TOKEN
# env variables for micropps
ARG MANGATA_ASSETS_URL=https://storage.googleapis.com/mangata-assets
ARG MANGATA_EXPLORER_URL=https://mangatax.subscan.io
# this points to stash service mock
ARG MANGATA_STASH_URL=http://localhost:3456
#this points to chopsticks mangata ws
ARG MANGATA_API_URL=ws://127.0.0.1:9946
ARG MANGATA_PARACHAIN_ID=2110
ARG MANGATA_TOKEN_ID=0
ARG MANGATA_ANNUAL_MGX_POOL_REWARDS=300000000000000000000000000

RUN apt-get install -y wget git

# Add a user for running applications.
RUN useradd apps
RUN mkdir -p /home/apps && chown apps:apps /home/apps

# Set the Chrome repo.
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list
# Install Chrome.
RUN apt-get update && apt-get -y install google-chrome-stable

RUN git clone -b ${BRANCH} https://github.com/mangata-finance/mangata-e2e.git 
WORKDIR /mangata-e2e

RUN rm -rf ./node_modules yarn.lock 
RUN yarn


# uncomment if api-key is provided, and comment the ADD command!
# WORKDIR /
# RUN if test -z ${GITHUB_TOKEN} ; then  git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/" ;  git clone -b ${FE_BRANCH} https://github.com/mangata-finance/microapps.git ; fi

ADD . /microapps/
WORKDIR /microapps
RUN rm -rf ./node_modules yarn.lock
RUN rm .env
RUN yarn


RUN echo MANGATA_ASSETS_URL=${MANGATA_ASSETS_URL} >> .env
RUN echo MANGATA_EXPLORER_URL=${MANGATA_EXPLORER_URL} >> .env
RUN echo MANGATA_STASH_URL=${MANGATA_STASH_URL} >> .env
RUN echo MANGATA_API_URL=${MANGATA_API_URL} >> .env
RUN echo MANGATA_PARACHAIN_ID=${MANGATA_PARACHAIN_ID} >> .env
RUN echo MANGATA_TOKEN_ID=${MANGATA_TOKEN_ID} >> .env
RUN echo MANGATA_ANNUAL_MGX_POOL_REWARDS=${MANGATA_ANNUAL_MGX_POOL_REWARDS} >> .env

#RUN yarn nx serve dex
### how to build ##
#### cd ~/projects/microapps ;  docker build  -f /home/goncer/projects/mangata-e2e/devops/dockerfiles/feTests/Dockerfile .
## how to run
#### docker run -it --network=host  --entrypoint=/bin/bash ca7dfc5ecc66 -c "yarn nx serve dex & sleep 10000000000"    ####