#!/bin/bash

cd client
npm install # install the RxPaired-client's dependencies
cp .npmrc.sample .npmrc # set default config
npm run build # build it

cd ../inspector
npm install # install the RxPaired-inspector's dependencies
cp .npmrc.sample .npmrc # set default config
npm run build # build it
