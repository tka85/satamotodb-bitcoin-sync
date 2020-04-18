#!/bin/sh
case "$CONTAINER" in
    satamoto_bitcoin_node1)
        /bin/su - bitcoin -c "/usr/local/bin/bitcoind -datadir=/opt/bitcoin/.bitcoin -conf=bitcoin.conf"
        ;;
    **) echo "Invalid env variable CONTAINER value '$CONTAINER'. Exiting."
esac
