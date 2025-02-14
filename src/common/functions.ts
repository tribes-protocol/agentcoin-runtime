import { AgentIdentitySchema, Identity } from '@/common/types'
import { EthAddressSchema } from '@memecoin/sdk'

export function prepend0x(value: string): `0x${string}` {
  if (value.startsWith('0x')) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return value as `0x${string}`
  }
  return `0x${value}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isRequiredString(arg: any): arg is string {
  return typeof arg === 'string'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isBigInt(value: any): value is bigint {
  return typeof value === 'bigint'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isNull(obj: any): obj is null | undefined {
  return obj === null || obj === undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJsonTree(obj: any): any {
  if (isNull(obj)) {
    return null
  }

  // transform each item for arrays
  if (Array.isArray(obj)) {
    return obj.map(toJsonTree)
  }

  // transform URLs to string
  if (obj instanceof URL) {
    return obj.toString()
  }

  // transform BigInt to string
  if (isBigInt(obj)) {
    return obj.toString()
  }

  // transfer BN to decimal string
  // if (BN.isBN(obj)) {
  //   return obj.toString(10)
  // }

  // return primitives and null/undefined unchanged
  if (typeof obj !== 'object' || isNull(obj)) {
    return obj
  }

  // use toJSON() if available
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (typeof obj.toJSON === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return obj.toJSON()
  }

  // transform each value for objects
  return Object.fromEntries(Object.entries(obj).map(([key, val]) => [key, toJsonTree(val)]))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ensureString(value: any, message: string | undefined = undefined): string {
  if (!value) {
    throw new Error(message || 'Value is undefined')
  }
  return value
}

export function serializeIdentity(identity: Identity): string {
  const parsedAddress = EthAddressSchema.safeParse(identity)
  if (parsedAddress.success) return parsedAddress.data

  const parsedAgent = AgentIdentitySchema.safeParse(identity)
  if (parsedAgent.success) return `agent-${parsedAgent.data.id.toString()}`
  throw new Error('Invalid identity')
}

export function deserializeIdentity(identityString: string): Identity {
  if (identityString.startsWith('agent-')) {
    return AgentIdentitySchema.parse({ id: parseInt(identityString.slice(6)) })
  }
  const parsedAddress = EthAddressSchema.safeParse(identityString)
  if (parsedAddress.success) return parsedAddress.data
  throw new Error('Invalid identity')
}

export function sortIdentities(first: Identity, second: Identity): [Identity, Identity] {
  const firstStr = serializeIdentity(first).toLowerCase()
  const secondStr = serializeIdentity(second).toLowerCase()
  return firstStr <= secondStr ? [first, second] : [second, first]
}
