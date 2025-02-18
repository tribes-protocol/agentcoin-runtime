import { KNOWLEDGE_DIR } from '@/common/constants'
import { Knowledge, KnowledgeSchema } from '@/common/types'
import {
  embed,
  getEmbeddingZeroVector,
  IAgentRuntime,
  RAGKnowledgeManager,
  splitChunks,
  stringToUuid,
  UUID
} from '@elizaos/core'
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import axios from 'axios'
import crypto from 'crypto'
import fs from 'fs/promises'
import { TextLoader } from 'langchain/document_loaders/fs/text'

import path from 'path'

export class KnowledgeService {
  private readonly knowledgeRoot: string
  private isRunning = false

  constructor(private readonly runtime: IAgentRuntime) {
    if (this.runtime.ragKnowledgeManager instanceof RAGKnowledgeManager) {
      this.knowledgeRoot = this.runtime.ragKnowledgeManager.knowledgeRoot
    } else {
      throw new Error('RAGKnowledgeManager not found')
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    console.log('📌 Knowledge indexing job started...')
    this.isRunning = true

    while (this.isRunning) {
      try {
        await this.processJsonFiles(KNOWLEDGE_DIR)
      } catch (error) {
        console.error('⚠️ Error in indexing job:', error)
      }

      // Wait for 1 minute before the next run
      await new Promise((resolve) => setTimeout(resolve, 60_000))
    }

    console.log('✅ Indexing job stopped gracefully.')
  }

  async stop(): Promise<void> {
    this.isRunning = false
  }

  private async processJsonFiles(jsonDirectory: string): Promise<void> {
    try {
      const dirExists = await fs
        .access(jsonDirectory)
        .then(() => true)
        .catch(() => false)
      if (!dirExists) {
        return
      }

      const files = (await fs.readdir(jsonDirectory)).filter((file) => file.endsWith('.json'))

      for (const jsonFile of files) {
        const filePath = path.join(jsonDirectory, jsonFile)
        const metadata = await fs.readFile(filePath, 'utf-8')

        let data: Knowledge
        try {
          data = KnowledgeSchema.parse(JSON.parse(metadata))
        } catch (error) {
          console.error(`Invalid JSON format in ${jsonFile}:`, error)
          continue
        }

        const itemId = stringToUuid(jsonFile)
        const existingKnowledge = await this.runtime.databaseAdapter.getKnowledge({
          id: itemId,
          agentId: this.runtime.agentId
        })

        switch (data.action) {
          case 'delete': {
            if (existingKnowledge.length > 0) {
              console.log(`Deleting knowledge item ${itemId}`)
              await fs.unlink(path.join(this.knowledgeRoot, data.filename))
              await this.runtime.ragKnowledgeManager.cleanupDeletedKnowledgeFiles()
            }
            break
          }
          case 'create': {
            if (existingKnowledge.length === 0) {
              await this.processFileMetadata(data, itemId)
            }
            break
          }
        }
      }
    } catch (error) {
      console.error('Error processing JSON files:', error)
      throw error
    }
  }

  private async processFileMetadata(data: Knowledge, itemId: UUID): Promise<void> {
    try {
      const content = await this.downloadFile(data)

      await this.runtime.databaseAdapter.createKnowledge({
        id: itemId,
        agentId: this.runtime.agentId,
        content: {
          text: '',
          metadata: { source: data.filename }
        },
        embedding: new Float32Array(getEmbeddingZeroVector()),
        createdAt: Date.now()
      })

      const chunks = await splitChunks(content, 750, 250)

      await Promise.all(
        chunks.map(async (chunk, index) => {
          const chunkEmbeddingArray = await embed(this.runtime, chunk)
          const chunkEmbedding = new Float32Array(chunkEmbeddingArray)

          const md5Hash = crypto.createHash('md5').update(`${itemId}-chunk-${index}`).digest('hex')
          const chunkId: UUID = `${md5Hash}-chunk-chunk-chunk-${index}`

          await this.runtime.databaseAdapter.createKnowledge({
            id: chunkId,
            agentId: this.runtime.agentId,
            content: {
              text: chunk,
              metadata: {
                isChunk: true,
                source: data.filename,
                originalId: itemId,
                chunkIndex: index
              }
            },
            embedding: chunkEmbedding,
            createdAt: Date.now()
          })
        })
      )
    } catch (error) {
      console.error(`Error processing file metadata for ${data.filename}:`, error)
    }
  }

  private async downloadFile(file: Knowledge): Promise<string> {
    await fs.mkdir(this.knowledgeRoot, { recursive: true })
    const outputPath = path.join(this.knowledgeRoot, file.filename)

    try {
      const response = await axios({
        method: 'GET',
        url: file.url,
        responseType: 'arraybuffer'
      })

      await fs.writeFile(outputPath, response.data)

      const loaderMap = {
        '.txt': TextLoader,
        '.md': TextLoader,
        '.csv': CSVLoader,
        '.pdf': PDFLoader,
        '.docx': DocxLoader
      } as const

      const isValidFileExtension = (ext: string): ext is keyof typeof loaderMap => {
        return ext in loaderMap
      }

      const fileExtension = path.extname(file.filename).toLowerCase()
      if (!isValidFileExtension(fileExtension)) {
        console.error(`Unsupported file type: ${fileExtension}`)
        throw new Error(`Unsupported file type: ${fileExtension}`)
      }

      const LoaderClass = loaderMap[fileExtension]

      try {
        const loader = new LoaderClass(outputPath)
        const docs = await loader.load()
        const content = docs.map((doc) => doc.pageContent).join('\n')
        console.log(`Successfully processed file: ${file.filename}`)
        return content
      } catch (error) {
        console.error(`Error parsing ${fileExtension} file: ${file.filename}`, error)
        return ''
      }
    } catch (error) {
      console.error(`Error processing file from ${file.url}:`, error)
      throw error
    }
  }
}
