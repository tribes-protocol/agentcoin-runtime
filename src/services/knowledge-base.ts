import { drizzleDB } from '@/common/db'
import { calculateChecksum, ensureUUID } from '@/common/functions'
import { AgentcoinRuntime } from '@/common/runtime'
import { Knowledges, RagKnowledgeItemContent } from '@/common/schema'
import { ServiceKind } from '@/common/types'
import { IKnowledgeBaseService } from '@/services/interfaces'
import {
  elizaLogger,
  embed,
  IAgentRuntime,
  RAGKnowledgeItem,
  Service,
  ServiceType,
  stringToUuid,
  UUID
} from '@elizaos/core'
import { and, cosineDistance, desc, eq, gt, sql } from 'drizzle-orm'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

export class KnowledgeBaseService extends Service implements IKnowledgeBaseService {
  private readonly textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 7000, // text-embedding-ada-002 has a max token limit of ~8000
    chunkOverlap: 500,
    separators: ['\n## ', '\n### ', '\n#### ', '\n', ' ', '']
  })

  constructor(private readonly runtime: AgentcoinRuntime) {
    super()
  }

  static get serviceType(): ServiceType {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return ServiceKind.knowledgeBase as unknown as ServiceType
  }

  async initialize(_: IAgentRuntime): Promise<void> {}

  async list(): Promise<RAGKnowledgeItem[]> {
    // not efficient. need to implement pagination in the future
    const databaseAdapter = this.runtime.databaseAdapter
    const knowledges = await databaseAdapter.getKnowledge({ agentId: this.runtime.agentId })
    return knowledges
  }

  async search(options: {
    q: string
    limit: number
    matchThreshold?: number
  }): Promise<RAGKnowledgeItem[]> {
    const { q, limit, matchThreshold = 0.5 } = options
    const embedding = await embed(this.runtime, q)

    console.log('[Embeddings] Generating embedding for query:', q)
    const similarity = sql<number>`1 - (${cosineDistance(Knowledges.embedding, embedding)})`
    const results = await drizzleDB
      .select({
        id: Knowledges.id,
        agentId: Knowledges.agentId,
        content: Knowledges.content,
        embedding: Knowledges.embedding,
        createdAt: Knowledges.createdAt,
        isMain: Knowledges.isMain,
        originalId: Knowledges.originalId,
        chunkIndex: Knowledges.chunkIndex,
        isShared: Knowledges.isShared,
        similarity
      })
      .from(Knowledges)
      .where(and(gt(similarity, matchThreshold), eq(Knowledges.agentId, this.runtime.agentId)))
      .orderBy((t) => desc(t.similarity))
      .limit(limit)

    // Convert the database results to RAGKnowledgeItem format
    const entries = results.map((result) => {
      // Extract content text
      let text = ''
      if (typeof result.content === 'object' && result.content && 'text' in result.content) {
        text = String(result.content.text)
      } else {
        text = JSON.stringify(result.content)
      }

      // Extract or create metadata
      const metadata: Record<string, unknown> = {}

      // Add properties from result
      if (result.isMain !== null && result.isMain !== undefined) {
        metadata.isMain = result.isMain
      }
      if (result.originalId) {
        metadata.originalId = result.originalId
      }
      if (result.chunkIndex !== null && result.chunkIndex !== undefined) {
        metadata.chunkIndex = result.chunkIndex
      }
      if (result.isShared !== null && result.isShared !== undefined) {
        metadata.isShared = result.isShared
      }

      // Add metadata from content if available
      if (
        typeof result.content === 'object' &&
        result.content &&
        'metadata' in result.content &&
        typeof result.content.metadata === 'object' &&
        result.content.metadata
      ) {
        Object.assign(metadata, result.content.metadata)
      }

      const item: RAGKnowledgeItem = {
        id: ensureUUID(result.id),
        agentId: ensureUUID(result.agentId),
        content: {
          text,
          metadata
        },
        similarity: result.similarity,
        ...(result.embedding ? { embedding: new Float32Array(result.embedding) } : {}),
        ...(result.createdAt ? { createdAt: result.createdAt.getTime() } : {})
      }
      return item
    })

    return entries
  }

  async get(id: UUID): Promise<RAGKnowledgeItem | undefined> {
    return this.runtime.databaseAdapter.getKnowledge({
      id,
      agentId: this.runtime.agentId
    })[0]
  }

  async add(id: UUID, knowledge: RagKnowledgeItemContent): Promise<void> {
    const shouldChunk = knowledge.text.length > this.textSplitter.chunkSize
    const databaseAdapter = this.runtime.databaseAdapter
    const agentId = this.runtime.agentId
    const checksum = calculateChecksum(knowledge.text)
    const kbType = knowledge.metadata?.type ?? 'unknown'
    const storedKB: RAGKnowledgeItem | undefined = (
      await databaseAdapter.getKnowledge({
        id,
        agentId,
        limit: 1
      })
    )[0]

    if (storedKB?.content.metadata?.checksum === checksum) {
      elizaLogger.info(`[${kbType}] knowledge=[${id}] already exists. skipping...`)
      return
    }

    // elizaLogger.info(
    //   `knowledge=[${id}/${kbType}] ${checksum} vs ${storedKB?.content.metadata?.checksum}`
    // )

    // create main knowledge item
    const knowledgeItem: RAGKnowledgeItem = {
      id,
      agentId,
      content: {
        text: shouldChunk ? '' : knowledge.text,
        metadata: {
          ...knowledge.metadata,
          // Move checksum and other properties to metadata
          isMain: true,
          isChunk: false,
          originalId: undefined,
          chunkIndex: undefined,
          checksum
        }
      },
      embedding: shouldChunk
        ? undefined
        : new Float32Array(await embed(this.runtime, knowledge.text)),
      createdAt: Date.now()
    }

    // delete old knowledge item
    if (storedKB) {
      await databaseAdapter.removeKnowledge(id)
    }

    // create main knowledge item
    await databaseAdapter.createKnowledge(knowledgeItem)

    if (!shouldChunk) {
      // no need to chunk, done!
      return
    }

    // Split the content into chunks
    const chunks = await this.textSplitter.createDocuments([knowledge.text])
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkId: UUID = stringToUuid(`${id}-${i}`)

      elizaLogger.info(`processing chunk id=${chunkId} page=${i} id=${id}`)

      const embeddings = await embed(this.runtime, chunk.pageContent)
      const knowledgeItem: RAGKnowledgeItem = {
        id: chunkId,
        agentId,
        content: {
          text: chunk.pageContent,
          metadata: {
            ...knowledge.metadata,
            isMain: false,
            isChunk: true,
            originalId: id,
            chunkIndex: i,
            source: undefined,
            type: kbType,
            checksum
          }
        },
        embedding: new Float32Array(embeddings),
        createdAt: Date.now()
      }

      await databaseAdapter.createKnowledge(knowledgeItem)
    }
  }

  async remove(id: UUID): Promise<void> {
    await this.runtime.databaseAdapter.removeKnowledge(id)
  }
}
