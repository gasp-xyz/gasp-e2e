How to generate the rolldown.json file

```
git clone https://github.com/mangata-finance/eigen-layer-monorepo.git
cd eigen-layer-monorepo
git submodule update --init --recursive
forge build
cp out/rolldown.sol mangata-e2e/utils/rollup/rolldown.json
```
forge build
```
++More info: https://github.com/mangata-finance/eigen-layer-monorepo/tree/feature/docker-compose#running-via-docker-compose
