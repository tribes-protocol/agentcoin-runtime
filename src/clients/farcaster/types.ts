export type Profile = {
  fid: number
  name: string
  username: string
  pfp?: string
  bio?: string
  url?: string
  // location?: string;
  // twitter?: string;
  // github?: string;
}

export type NeynarCastResponse = {
  hash: string
  authorFid: number
  text: string
}

export type Cast = {
  hash: string
  authorFid: number
  text: string
  profile: Profile
  inReplyTo?: {
    hash: string
    fid: number
  }
  timestamp: Date
}

export type CastId = {
  hash: string
  fid: number
}

export type FidRequest = {
  fid: number
  pageSize: number
}

export type NeynarCastResponseRaw = {
  hash: string
  author: {
    fid: number
  }
  text: string
  parent_hash?: string
  parent_author?: {
    fid: number
  }
  timestamp: string
}
