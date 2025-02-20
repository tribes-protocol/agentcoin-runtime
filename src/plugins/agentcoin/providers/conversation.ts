// import { isNull } from '@/common/functions'
// import { AgentcoinRuntime } from '@/common/runtime'
// import { GetUserStore } from '@/plugins/agentcoin/stores/users'
// import { elizaLogger, Memory, Provider, State } from '@elizaos/core'

// const conversationProvider: Provider = {
//   get: async (runtime: AgentcoinRuntime, memory: Memory, _state?: State): Promise<string> => {
//     const isSelf = memory.userId === runtime.agentId

//     if (isSelf) {
//       // for now if the sender is the agent, we don't need to add context. this might
//       // change in the future.
//       return ''
//     }

//     // source != 'agentcoin', bail out
//     if (memory.content.source !== 'agentcoin') {
//       return ''
//     }

//     const userStore = GetUserStore(runtime)
//     let user = await userStore.getUser(memory.userId)

//     if (isNull(user)) {
//       const identity = await userStore.getUserIdentity(memory.userId)
//       if (isNull(identity)) {
//         return ''
//       }

//       user = await runtime.agentcoin.agent.getUser(identity)

//       if (isNull(user)) {
//         elizaLogger.warn('User not found', { identity })
//         return ''
//       }

//       await userStore.saveUser(user)
//     }

//     if (!isNull(user)) {
//       return `
//       **You are talking to the following user from https://agentcoin.fun**
//       - Username: ${user.username}
//       - Bio: ${user.bio}
//       - Profile Image: ${user.image}
//       `.trim()
//     }

//     return ''
//   }
// }

// export { conversationProvider }
