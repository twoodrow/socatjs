# Socatjs
Hackable tool for exchanging data between connections.

## Installation
```bash
# ensure that npm is installed
https://docs.npmjs.com/getting-started/installing-node

# install npm dependencies
npm install .


###############################
####  NOTE -- for WINDOWS  ####
###############################
# it is possible that the serialport module will break
# to fix, install node-gyp globally
npm install -g node-gyp
# then rebuild the serialport module
cd ./node_modules/serialport
node-gyp configure build
```
