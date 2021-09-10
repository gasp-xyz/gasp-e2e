#!/bin/bash

docker container stop $(docker container ls -q)
docker kill $(docker ps -q)
docker rm $(docker ps -a -q) --force
docker rmi $(docker images -q) --force
docker netwdocker system prune --all --force --volumes
