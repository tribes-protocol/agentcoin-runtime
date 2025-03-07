import { Character, ModelProviderName } from '@elizaos/core'

export function getDefaultCharacter(): Character {
  return {
    bio: [],
    lore: [],
    knowledge: [],
    messageExamples: [],
    postExamples: [],
    topics: [],
    style: {
      all: [],
      chat: [],
      post: []
    },
    adjectives: [],
    name: 'N1',
    clients: [],
    modelProvider: ModelProviderName.OPENAI,
    settings: {},
    plugins: []
  }
}
