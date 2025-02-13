import { sentinelClient } from '@/clients'
import { BASE_RPC_URL, TOKEN_ADDRESS } from '@/common/env'
import { prepend0x } from '@/common/functions'
import {
  Action,
  composeContext,
  Content,
  elizaLogger,
  generateObject,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelClass,
  State
} from '@elizaos/core'
import { EthAddressSchema } from '@memecoin/sdk'
import { createPublicClient, erc20Abi, http, parseEther } from 'viem'
import { base } from 'viem/chains'
import { z } from 'zod'

const JokeEvaluationSchema = z.object({
  isFunny: z.boolean(),
  explanation: z.string()
})

// Since we are tipping
// in ERC20 tokens, the joke should be really funny. Don't simply give out tips for every joke.

const jokeEvaluationTemplate = `Evaluate if the following joke or statement is funny and deserves
 a tip. Consider factors like creativity, wit, timing, and cultural relevance.
 
Recent conversation:
{{recentMessages}}

Respond with a JSON object containing:
- isFunny: boolean indicating if the joke deserves a tip
- explanation: brief explanation of why it is or isn't funny

Example response:
\`\`\`json
{
  "isFunny": true,
  "explanation": "Clever wordplay combined with perfect timing and cultural reference"
}
\`\`\`
`

export interface JokeEvaluationContent extends Content {
  isFunny: boolean
  explanation: string
}

export const tipForJokeAction: Action = {
  name: 'TIP_FOR_JOKE',
  similes: ['REWARD_JOKE', 'SEND_TIP'],
  description: 'Evaluate a joke and send ERC20 tokens if it is funny',
  validate: async () => {
    return true
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.log('Starting TIP_FOR_JOKE handler...')

    if (!state) {
      state = await runtime.composeState(message)
    } else {
      state = await runtime.updateRecentMessageState(state)
    }

    const jokeContext = composeContext({
      state,
      template: jokeEvaluationTemplate
    })

    const evaluation = (
      await generateObject({
        runtime,
        context: jokeContext,
        modelClass: ModelClass.LARGE,
        // @ts-expect-error Multiple zod package issue
        schema: JokeEvaluationSchema
      })
    ).object

    const res = JokeEvaluationSchema.parse(evaluation)

    if (!res.isFunny) {
      if (callback) {
        callback({
          text: `Sorry, that joke wasn't quite funny enough for a tip. ${res.explanation}`,
          content: res
        }).catch((error) => {
          elizaLogger.error('Error sending callback:', error)
        })
      }
      return true
    }

    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL)
      })

      // FIXME: how to get the recipient address?
      const recipientAddress = EthAddressSchema.parse('0xf4D70D2fd1DE59ff34aA0350263ba742cb94b1c8')
      if (!recipientAddress) {
        throw new Error('No recipient address found')
      }

      const { request } = await publicClient.simulateContract({
        address: TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipientAddress, parseEther('100')]
      })

      // FIXME: how to get the wallet info?
      const walletId = 4
      const walletAddress = '0x0000000000000000000000000000000000000000'

      const transaction = {
        to: request.to,
        value: request.value,
        data: request.data,
        nonce: await publicClient.getTransactionCount({ address: walletAddress }),
        gasLimit: await publicClient.estimateGas(request),
        chainId: request.chainId
      }

      const signedTxn = await sentinelClient.signTxnWithWallet(walletId, transaction)
      const hash = await publicClient.sendRawTransaction({
        serializedTransaction: prepend0x(signedTxn)
      })

      if (callback) {
        callback({
          text: `Great joke! I've sent you 100 tokens as a tip. Transaction: ${hash}`,
          content: { ...res, hash }
        }).catch((error) => {
          elizaLogger.error('Error sending callback:', error)
        })
      }

      return true
    } catch (error) {
      elizaLogger.error('Error processing tip:', error)
      if (callback) {
        callback({
          text: 'Sorry, there was an error processing the tip.',
          content: { error: 'Error processing tip' }
        }).catch((error) => {
          elizaLogger.error('Error sending callback:', error)
        })
      }
      return false
    }
  },
  examples: [
    [
      {
        user: '{{user1}}',
        content: {
          text: 'Why did the scarecrow win an award? Because he was outstanding in his field!'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: "That's a good one! Let me send you a tip for that joke.",
          action: 'TIP_FOR_JOKE'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: "Great joke! I've sent you 100 tokens as a tip."
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: {
          text: 'What do you call a bear with no teeth? A gummy bear!'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: "Haha that's hilarious! You deserve a tip for that one.",
          action: 'TIP_FOR_JOKE'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: "Great joke! I've sent you 100 tokens as a tip."
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: {
          text: 'What did the grape say when it got stepped on? Nothing, it just let out a little wine!'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'That joke was grape! Let me tip you for that.',
          action: 'TIP_FOR_JOKE'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: "Great joke! I've sent you 100 tokens as a tip."
        }
      }
    ]
  ]
}
