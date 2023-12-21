import { execFile, path } from "./deps.ts";

export class CraftopiaServerUpdater {
    serverDirectory: string;
    steamCmdDirectory: string;
    updating = false;
    onMessage?: (message: string, stderr: boolean) => unknown;

    constructor(serverDirectory: string, steamCmdDirectory: string) {
        this.serverDirectory = serverDirectory;
        this.steamCmdDirectory = steamCmdDirectory;
    }

    updateServer() {
        return new Promise<string | undefined>((resolve, reject) => {
            if (this.updating) return;
            this.updating = true;
            const process = execFile(
                path.join(this.steamCmdDirectory, "steamcmd.exe"),
                [
                    "+force_install_dir",
                    this.serverDirectory,
                    "+login anonymous",
                    "",
                    "+app_update",
                    "1670340",
                    "validate",
                    "+exit",
                ],
                {
                    cwd: this.steamCmdDirectory,
                    encoding: "utf8",
                    stdio: ["pipe", "pipe", "pipe"],
                },
                (error, stdout) => {
                    this.updating = false;
                    if (error) {
                        reject(error);
                    } else {
                        resolve(stdout as string);
                    }
                },
            );
            process.stdout?.on("data", (data) => this.handleMessage(data, false));
            process.stderr?.on("data", (data) => this.handleMessage(data, true));
        });
    }

    handleMessage(message: string, stderr: boolean) {
        this.onMessage?.(message, stderr);
    }
}
