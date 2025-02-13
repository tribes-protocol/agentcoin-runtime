import { tipForJokeAction } from '@/plugins/tipping/actions'
import { Plugin } from '@elizaos/core'

export const tippingPlugin: Plugin = {
  name: 'tipping',
  description: 'Plugin for tipping users with ERC20 tokens for funny jokes',
  actions: [tipForJokeAction]
}

export default tippingPlugin
