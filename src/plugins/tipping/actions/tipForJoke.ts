import { TOKEN_ADDRESS } from '@/common/env'
import { isNull } from '@/common/functions'
import { AgentcoinRuntime } from '@/common/runtime'
import {
  Action,
  composeContext,
  Content,
  elizaLogger,
  generateObject,
  HandlerCallback,
  Memory,
  ModelClass,
  State
} from '@elizaos/core'
import { EthAddressSchema } from '@memecoin/sdk'
import { encodeFunctionData, erc20Abi, parseEther } from 'viem'
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
    runtime: AgentcoinRuntime,
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
      // FIXME: how to get the recipient address?
      const recipientAddress = EthAddressSchema.parse('0xf4D70D2fd1DE59ff34aA0350263ba742cb94b1c8')
      if (isNull(recipientAddress)) {
        throw new Error('No recipient address found')
      }

      const walletService = runtime.agentcoin.wallet
      const agentcoinService = runtime.agentcoin.agent
      const wallet = await agentcoinService.getDefaultWallet('evm')

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipientAddress, parseEther('100')]
      })

      const txHash = await walletService.signAndSubmitTransaction(wallet, {
        to: TOKEN_ADDRESS,
        data
      })

      if (callback) {
        callback({
          text: `Great joke! I've sent you 100 tokens as a tip, https://basescan.org/tx/${txHash}`,
          content: { ...res, txHash }
        }).catch((error) => {
          elizaLogger.error('Error sending callback:', error)
        })
      }

      return true
    } catch (error) {
      elizaLogger.error('Error processing tip:', JSON.stringify(error, null, 2))
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
