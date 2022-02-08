 docker run -e RUST_LOG=debug,sync=info,afg=info,libp2p_swarm=info,multistream_select=info,libp2p_core=info,sub-libp2p=info,libp2p_tcp=info,wasm_overrides=info,wasm-heap=info,libp2p_ping=info,runtime=debug \
             -v ~/:/tmp/ mangatasolutions/mangata-node:latest  --name "GonCer"  --tmp \
            --collator \
            --force-authoring \
            --bootnodes /ip4/157.230.76.246/tcp/30333/p2p/12D3KooWSCufgHzV4fCwRijfH2k3abrpAJxTKxEvN1FDuRXA2U9x  \
            --port 30333 \
            --rpc-port 6633 \
            --ws-port 6666 \
            --unsafe-ws-external \
            --unsafe-rpc-external \
            --rpc-cors all \
            -- \
            --execution wasm \
            --chain /tmp/chainspec_prod_v4.json \
            --port 30334 \
            --rpc-port 9934 \
            --ws-port 9945 \
            --unsafe-ws-external \
            --unsafe-rpc-external \
            --rpc-cors all \
            --unsafe-pruning \
            --pruning 1000
            

#            --bootnodes /dns/v4-prod-alice.mangatafinance.cloud/p2p/12D3KooWEyoppNCUx8Yx66oV9fJnriXwCcXwDDUA2kj6vnc6iDEp \