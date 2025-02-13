import { sentinelClient } from '@/clients/sentinel'
import { IdentityService } from '@/services/identity'
import { WalletService } from '@/services/wallet'

export const walletService = new WalletService(sentinelClient)

export const identityService = new IdentityService(sentinelClient)
