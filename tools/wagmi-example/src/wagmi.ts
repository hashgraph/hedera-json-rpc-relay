import {http, createConfig} from 'wagmi'
import {hedera, hederaTestnet, sepolia} from 'wagmi/chains'
import {coinbaseWallet, injected} from 'wagmi/connectors'

export const config = createConfig({
  chains: [hederaTestnet, hedera],
  connectors: [
    injected(),
    coinbaseWallet(),
  ],
  transports: {
    // [sepolia.id]: http(),
    [hederaTestnet.id]: http(),
    [hedera.id]: http()
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
