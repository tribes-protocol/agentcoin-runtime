import { Character, ModelProviderName, settings } from '@elizaos/core'

export function getTokenForProvider(
  provider: ModelProviderName,
  character: Character
): string | undefined {
  switch (provider) {
    case ModelProviderName.OPENAI:
      return character.settings?.secrets?.OPENAI_API_KEY || settings.OPENAI_API_KEY
    case ModelProviderName.LLAMACLOUD:
      return (
        character.settings?.secrets?.LLAMACLOUD_API_KEY ||
        settings.LLAMACLOUD_API_KEY ||
        character.settings?.secrets?.TOGETHER_API_KEY ||
        settings.TOGETHER_API_KEY ||
        character.settings?.secrets?.XAI_API_KEY ||
        settings.XAI_API_KEY ||
        character.settings?.secrets?.OPENAI_API_KEY ||
        settings.OPENAI_API_KEY
      )
    case ModelProviderName.ANTHROPIC:
      return (
        character.settings?.secrets?.ANTHROPIC_API_KEY ||
        character.settings?.secrets?.CLAUDE_API_KEY ||
        settings.ANTHROPIC_API_KEY ||
        settings.CLAUDE_API_KEY
      )
    case ModelProviderName.REDPILL:
      return character.settings?.secrets?.REDPILL_API_KEY || settings.REDPILL_API_KEY
    case ModelProviderName.OPENROUTER:
      return character.settings?.secrets?.OPENROUTER || settings.OPENROUTER_API_KEY
    case ModelProviderName.GROK:
      return character.settings?.secrets?.GROK_API_KEY || settings.GROK_API_KEY
    case ModelProviderName.HEURIST:
      return character.settings?.secrets?.HEURIST_API_KEY || settings.HEURIST_API_KEY
    case ModelProviderName.GROQ:
      return character.settings?.secrets?.GROQ_API_KEY || settings.GROQ_API_KEY
    case ModelProviderName.ETERNALAI:
      return undefined
    case ModelProviderName.TOGETHER:
      return undefined
    case ModelProviderName.LLAMALOCAL:
      return undefined
    case ModelProviderName.GOOGLE:
      return undefined
    case ModelProviderName.CLAUDE_VERTEX:
      return undefined
    case ModelProviderName.OLLAMA:
      return undefined
    case ModelProviderName.GALADRIEL:
      return undefined
    case ModelProviderName.FAL:
      return undefined
    case ModelProviderName.GAIANET:
      return undefined
    case ModelProviderName.ALI_BAILIAN:
      return undefined
    case ModelProviderName.VOLENGINE:
      return undefined
    case ModelProviderName.NANOGPT:
      return undefined
    case ModelProviderName.HYPERBOLIC:
      return undefined
    case ModelProviderName.VENICE:
      return undefined
    case ModelProviderName.AKASH_CHAT_API:
      return undefined
    case ModelProviderName.LIVEPEER:
      return undefined
  }
}
