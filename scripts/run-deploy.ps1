$env:ARC_TESTNET_RPC = 'https://rpc.testnet.arc.network'
Set-Location 'C:\Users\Ludarep\citation-agent'
& node --experimental-transform-types --no-warnings scripts/deploy-attestation.mts @args