import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

/**
 * Class to manage all application paths based on a configurable root directory
 */
export class PathManager {
  private rootDir: string

  constructor(rootDir?: string) {
    // If rootDir is provided and not absolute, make it relative to CWD
    if (rootDir && !path.isAbsolute(rootDir)) {
      rootDir = path.resolve(process.cwd(), rootDir)
    }

    this.rootDir =
      rootDir ?? process.env.AGENTCOIN_FUN_DIR ?? path.join(os.homedir(), '.agentcoin-fun')
    this.ensureRootDirExists()
  }

  /**
   * Get the root directory path
   */
  get AGENTCOIN_FUN_DIR(): string {
    return this.rootDir
  }

  /**
   * Get the agent provision file path
   */
  get AGENT_PROVISION_FILE(): string {
    return path.join(this.rootDir, 'agent-provision.json')
  }

  /**
   * Get the character file path
   */
  get CHARACTER_FILE(): string {
    return path.join(this.rootDir, 'character.json')
  }

  /**
   * Get the environment file path
   */
  get ENV_FILE(): string {
    return path.join(this.rootDir, 'env.production')
  }

  /**
   * Get the registration file path
   */
  get REGISTRATION_FILE(): string {
    return path.join(this.rootDir, 'registration.json')
  }

  /**
   * Get the keypair file path
   */
  get KEYPAIR_FILE(): string {
    return path.join(this.rootDir, 'agent-keypair.json')
  }

  /**
   * Get the git state file path
   */
  get GIT_STATE_FILE(): string {
    return path.join(this.rootDir, 'agent-git.json')
  }

  /**
   * Get the code directory path
   */
  get CODE_DIR(): string {
    return path.join(this.rootDir, 'code')
  }

  /**
   * Get the runtime server socket file path
   */
  get RUNTIME_SERVER_SOCKET_FILE(): string {
    return path.join(this.rootDir, 'runtime-server.sock')
  }

  /**
   * Set a new root directory and update all paths
   */
  setRootDir(newRootDir: string): void {
    // If newRootDir is not absolute, make it relative to CWD
    if (!path.isAbsolute(newRootDir)) {
      newRootDir = path.resolve(process.cwd(), newRootDir)
    }

    this.rootDir = newRootDir
    this.ensureRootDirExists()
  }

  /**
   * Ensure the root directory exists
   */
  private ensureRootDirExists(): void {
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true })
    }
  }
}
