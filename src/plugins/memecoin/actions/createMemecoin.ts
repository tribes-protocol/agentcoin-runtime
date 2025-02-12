import { validateMemecoinConfig } from '@/plugins/memecoin/environment'
import {
  Action,
  composeContext,
  Content,
  elizaLogger,
  generateImage,
  generateObject,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelClass,
  State
} from '@elizaos/core'
import { HexStringSchema, MemecoinSDK } from '@memecoin/sdk'
import { privateKeyToAccount } from 'viem/accounts'
import { z } from 'zod'

const MemecoinSchema = z.object({
  name: z.string(),
  imagePrompt: z.string(),
  ticker: z.string(),
  launchType: z.enum(['BONDING_CURVE', 'DIRECT']).default('BONDING_CURVE'),
  description: z.string().optional().nullable()
})

export interface MemecoinContent extends Content {
  name: string
  imagePrompt: string
  ticker: string
  launchType: 'BONDING_CURVE' | 'DIRECT'
  description?: string
}

const memecoinTemplate = `Create a creative and engaging memecoin configuration based on the 
provided information. If any details are missing, generate appropriate values that match the theme.

Required fields:
- name: Name of the memecoin (use provided if given, otherwise generate)
- description: Create an engaging description that explains the memecoin's purpose and appeal
- imagePrompt: Design a detailed prompt that will generate an attractive and thematic logo
- ticker: 2-4 letter ticker symbol (use provided if given, otherwise derive from name)
- launchType: BONDING_CURVE or DIRECT (use BONDING_CURVE by default unless specified)

Example responses:
\`\`\`json
{
    "name": "DogCoin",
    "description": "The ultimate memecoin for dog lovers! Supporting canine charities while bringing
    the community together with wagging tails and happy barks.",
    "imagePrompt": "A stylized cartoon dog wearing sunglasses and a crown, digital art style,
    vibrant colors, white background, minimalist crypto logo design",
    "ticker": "DOG",
    "launchType": "BONDING_CURVE"
}
\`\`\`

\`\`\`json
{
    "name": "CatCoin",
    "description": "The purrfect cryptocurrency for feline enthusiasts. Every transaction comes 
    with a virtual purr!",
    "imagePrompt": "A geometric cat face logo with glowing eyes, modern minimal design, crypto art
    style, clean lines, professional finish",
    "ticker": "CAT",
    "launchType": "DIRECT"
}
\`\`\`

{{recentMessages}}

Based on the conversation above, generate a creative and complete memecoin configuration.
Ensure all values are filled appropriately and maintain thematic consistency. 
Respond with a JSON markdown block containing the configuration.`

export const createMemecoinAction: Action = {
  name: 'CREATE_MEMECOIN',
  similes: ['LAUNCH_MEMECOIN'],
  description: 'Create an ERC20 memecoin',
  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    await validateMemecoinConfig(runtime)
    return true
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.log('Starting memecoin CREATE_MEMECOIN handler...')

    if (!state) {
      state = await runtime.composeState(message)
    } else {
      state = await runtime.updateRecentMessageState(state)
    }

    const memecoinContext = composeContext({
      state,
      template: memecoinTemplate
    })

    const content = (
      await generateObject({
        runtime,
        context: memecoinContext,
        modelClass: ModelClass.MEDIUM,
        // @ts-expect-error Multiple zod package issue
        schema: MemecoinSchema
      })
    ).object

    if (!MemecoinSchema.safeParse(content).success) {
      elizaLogger.error('Invalid content for CREATE_MEMECOIN action.')
      if (callback) {
        callback({
          text: 'Unable to process memecoin creation request. Invalid content provided.',
          content: { error: 'Invalid memecoin content' }
        }).catch((error) => {
          elizaLogger.error('Error creating memecoin:', error)
        })
      }
      return false
    }

    try {
      const privateKey = HexStringSchema.parse(
        runtime.getSetting('BOT_PRIVATE_KEY') || process.env.BOT_PRIVATE_KEY
      )

      const account = privateKeyToAccount(privateKey)

      const sdk = new MemecoinSDK({
        privateKey,
        rpcUrl: runtime.getSetting('BASE_RPC_URL') || process.env.BASE_RPC_URL
      })

      const { name, ticker, launchType, description, imagePrompt } = MemecoinSchema.parse(content)

      const { data } = await generateImage(
        {
          prompt: imagePrompt,
          width: 512,
          height: 512
        },
        runtime
      )

      if (callback) {
        callback({
          text: `Generating your memecoin hold on tight!`
        }).catch((error) => {
          elizaLogger.error('Error generating image:', error)
        })
      }

      const launchParams = await sdk.estimateLaunch({
        name,
        ticker,
        marketCap: launchType === 'DIRECT' ? BigInt(0) : BigInt(69420000000),
        account: account.address,
        antiSnipeAmount: BigInt(0)
      })

      const { txHash } = await sdk.launch({
        ...launchParams,
        description,
        image: data[0],
        marketCap: launchType === 'DIRECT' ? BigInt(0) : BigInt(69420000000),
        name,
        ticker,
        antiSnipeAmount: BigInt(0)
      })

      elizaLogger.info('Memecoin created successfully:', txHash)

      if (callback) {
        callback({
          text: `Memecoin created successfully: ${txHash}`
        }).catch((error) => {
          elizaLogger.error('Error creating memecoin:', error)
        })
      }
    } catch (error) {
      elizaLogger.error('Error creating memecoin:', error)
      if (callback) {
        callback({
          text: 'Unable to process memecoin creation request. Error creating memecoin.',
          content: { error: 'Error creating memecoin' }
        }).catch((error) => {
          elizaLogger.error('Error creating memecoin:', error)
        })
      }
    }

    return true
  },
  examples: [
    [
      {
        user: '{{user1}}',
        content: {
          text: "Create a memecoin called 'MemeCoin' with ticker 'MC'"
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'Sure, I will create a memecoin called "MemeCoin" with ticker "MC"',
          action: 'CREATE_MEMECOIN'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'MemeCoin has been created successfully, tx: 0x1234567890abcdef'
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: {
          text: "Let's create a dog-themed memecoin called WOOFCOIN, launch it directly to uniswap"
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'I will help you create a memecoin called "WOOFCOIN" with ticker "WOOF" and launch it directly to uniswap',
          action: 'CREATE_MEMECOIN'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'WOOFCOIN has been successfully deployed to the network, transaction hash: 0xabc123def456'
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: {
          text: 'I want to launch a meme token for my AI project. Name it AITOKEN and launch it with Bonding Curve'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'I will create an ERC20 memecoin named "AITOKEN" with ticker "AIT" on the bonding curve',
          action: 'CREATE_MEMECOIN'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'AITOKEN has been created and deployed. Transaction details: 0xdef789abc012'
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: {
          text: 'Hi, I am thinking of launching a memecoin today.'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'That sounds great! What do you have in mind?'
        }
      },
      {
        user: '{{user1}}',
        content: {
          text: 'Something around cats, I think'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'I will create an ERC20 memecoin named "CATCOIN" with ticker "CAT" on the bonding curve',
          action: 'CREATE_MEMECOIN'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'CATCOIN has been created and deployed. Transaction details: 0xdef789abc012'
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: {
          text: 'Its never a bad idea to launch a memecoin, right?'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'Oh, I think you are right! I am here to help you create a memecoin'
        }
      },
      {
        user: '{{user1}}',
        content: {
          text: 'I think I want to launch a memecoin for homeless dogs for charity'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'I will create an ERC20 memecoin named "DOGCOIN" with ticker "DOG" on the bonding curve',
          action: 'CREATE_MEMECOIN'
        }
      },
      {
        user: '{{user2}}',
        content: {
          text: 'DOGCOIN has been created and deployed. Transaction details: 0xdef789abc012'
        }
      }
    ]
  ]
}
