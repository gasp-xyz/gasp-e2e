FROM node:18.16.0 AS node_base

RUN echo "NODE Version:" && node --version
RUN echo "NPM Version:" && npm --version

ARG GCC_VERSION=10
ARG CMAKE_VERSION=3.21.0
ARG BRANCH=main

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

#### docker run -it --network=host  --entrypoint=/bin/bash 8ae4fe093944  -c "yarn test-sequential"   ####