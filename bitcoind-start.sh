#!/bin/sh
if [ -r /opt/bitcoin/.bitcoin/bitcoin.conf ]; then
    /bin/su - bitcoin -c "/usr/local/bin/bitcoind -datadir=/opt/bitcoin/.bitcoin -conf=bitcoin.conf"
fi
# Block script from terminating in case the bitcoin.conf is not there yet
tail -f /dev/null;
