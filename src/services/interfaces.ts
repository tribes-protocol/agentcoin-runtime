import {
  AgentWallet,
  AgentWalletKind,
  CreateMessage,
  HexString,
  HydratedMessage,
  Identity,
  Transaction,
  User
} from '@/common/types'

export interface IWalletService {
  signPersonalMessage(wallet: AgentWallet, message: string): Promise<string>
  signAndSubmitTransaction(wallet: AgentWallet, transaction: Transaction): Promise<HexString>
}

export interface IAgentcoinService {
  getDefaultWallet(kind: AgentWalletKind): Promise<AgentWallet>
  sendMessage(message: CreateMessage): Promise<HydratedMessage>
  getIdentity(): Promise<Identity>
  getUser(identity: Identity): Promise<User | undefined>
}
