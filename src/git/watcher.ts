import { CODE_REPOSITORY } from "@/common/env"
import { execSync } from "child_process"
import simpleGit, { SimpleGit } from "simple-git"

const git: SimpleGit = simpleGit(CODE_REPOSITORY)

export const watchGitRepository = async (): Promise<void> => {
  setInterval(async () => {
    try {
      // Fetch latest changes
      await git.fetch()

      // Get status
      const status = await git.status()

      if (status.behind > 0) {
        console.log(
          `Repository is ${status.behind} commits behind, pulling changes...`
        )

        // Pull latest changes
        await git.pull()

        console.log("Running build command...")
        // Run build command
        execSync("bun i && bun run build", { cwd: CODE_REPOSITORY })

        console.log("Build complete, restarting process...")
        process.exit(0)
      }
    } catch (error) {
      console.error("Error in git watcher:", error)
    }
  }, 60000) // Run every minute
}
