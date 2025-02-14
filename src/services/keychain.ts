import { KEYPAIR_FILE } from '@/common/constants'
import { KeyPair, KeyPairSchema } from '@/common/types'
import { ApiKeyStamper } from '@turnkey/sdk-server'
import { createCipheriv, createDecipheriv, createHash } from 'crypto'
import EC from 'elliptic'
import * as fs from 'fs'

// eslint-disable-next-line new-cap
export const ec = new EC.ec('p256')

export class KeychainService {
  private readonly keyPairData: KeyPair

  public get publicKey(): string {
    return this.keyPairData.publicKey
  }

  public get turnkeyApiKeyStamper(): ApiKeyStamper {
    return new ApiKeyStamper({
      apiPublicKey: this.keyPairData.publicKey,
      apiPrivateKey: this.keyPairData.privateKey
    })
  }

  constructor() {
    const keyPairPath = KEYPAIR_FILE

    if (!fs.existsSync(keyPairPath)) {
      const keyPair = ec.genKeyPair()
      this.keyPairData = {
        publicKey: keyPair.getPublic(true, 'hex'),
        privateKey: keyPair.getPrivate('hex')
      }

      // 0o600 sets read/write permissions for owner only (no access for group/others)
      fs.writeFileSync(keyPairPath, JSON.stringify(this.keyPairData, null, 2), { mode: 0o600 })
    } else {
      const keyPairData = KeyPairSchema.parse(JSON.parse(fs.readFileSync(keyPairPath, 'utf-8')))
      this.keyPairData = keyPairData
    }
  }

  async sign(message: string): Promise<string> {
    const keyPair = ec.keyFromPrivate(this.keyPairData.privateKey, 'hex')
    const msgHash = createHash('sha256').update(message).digest()
    const signature = keyPair.sign(msgHash)
    return signature.toDER('hex')
  }

  public encrypt(plaintext: string): { encrypted: string; ephemPublicKey: string } {
    // Generate an ephemeral key pair for this encryption
    const ephemKeyPair = ec.genKeyPair()
    const sharedSecret = ephemKeyPair.derive(
      ec.keyFromPublic(this.keyPairData.publicKey, 'hex').getPublic()
    )

    // Use shared secret to create encryption key
    const encryptionKey = createHash('sha256').update(sharedSecret.toString(16)).digest()

    // Create initialization vector
    const iv = Buffer.from(
      createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 32),
      'hex'
    )

    const cipher = createCipheriv('aes-256-cbc', encryptionKey, iv)
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return {
      encrypted: iv.toString('hex') + encrypted,
      ephemPublicKey: ephemKeyPair.getPublic(true, 'hex')
    }
  }

  public decrypt(encryptedData: { encrypted: string; ephemPublicKey: string }): string {
    // Reconstruct shared secret using our private key and ephemeral public key
    const sharedSecret = ec
      .keyFromPrivate(this.keyPairData.privateKey, 'hex')
      .derive(ec.keyFromPublic(encryptedData.ephemPublicKey, 'hex').getPublic())

    // Reconstruct encryption key
    const encryptionKey = createHash('sha256').update(sharedSecret.toString(16)).digest()

    // Split IV and encrypted content
    const iv = Buffer.from(encryptedData.encrypted.slice(0, 64), 'hex')
    const encrypted = encryptedData.encrypted.slice(64)

    const decipher = createDecipheriv('aes-256-cbc', encryptionKey, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }
}
