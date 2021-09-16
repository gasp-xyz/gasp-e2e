#!/bin/bash

docker container stop $(docker container ls -q)
docker kill $(docker ps -q)
docker rm $(docker ps -a -q) --force
