import { ChildProcess, execFile, path } from "./deps.ts";

export class CraftopiaServerManager {
    serverDirectory: string;
    exe: string;
    process?: ChildProcess;
    state: "idle" | "starting" | "running" | "stopping" = "idle";

    onMessage?: (message: string, stderr: boolean) => unknown;
    onJoin?: (params: { id: string; name: string }) => unknown;
    onLeave?: (params: { id: string; name: string }) => unknown;
    onStart?: () => unknown;
    onStop?: () => unknown;
    onPreWorldLoaded?: () => unknown;
    onWorldLoaded?: () => unknown;
    onStopped?: () => unknown;

    private closed?: Promise<unknown>;
    private resolveQuitPrompt?: () => unknown;
    private resolveClose?: () => unknown;

    constructor(serverDirectory: string) {
        this.serverDirectory = serverDirectory;
        this.exe = path.join(this.serverDirectory, "Craftopia.exe");
    }

    get canStart() {
        return this.state === "idle";
    }

    start() {
        if (this.process || !this.canStart) return;
        this.state = "starting";
        this.onStart?.();
        this.process = execFile(this.exe, {
            cwd: this.serverDirectory,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
        });
        this.process.stdout?.on("data", (data) => this.handleMessage(data, false));
        this.process.stderr?.on("data", (data) => this.handleMessage(data, true));
        this.closed = new Promise<void>((resolve) => (this.resolveClose = resolve));
        this.process.on("close", this.handleClose.bind(this));
    }

    get canStop() {
        return this.state === "running";
    }

    async stop() {
        if (!this.process || !this.canStop) return;
        this.state = "stopping";
        this.onStop?.();
        await this.sendLine("stop");
        await this.closed;
    }

    get canRestart() {
        return this.canStop;
    }

    async restart() {
        await this.stop();
        this.start();
    }

    async sendLine(line: string) {
        await this.sendString(line + "\n");
    }

    async sendString(str: string) {
        if (!this.process) return;
        await new Promise<void>((resolve, reject) =>
            this.process!.stdin?.write(
                str,
                (error) => (error ? reject(error) : resolve()),
            )
        );
    }

    private static activeSlaveRe = /^ActiveSlave:Id=(\w+) Active=(True|False) Name=(.*)/m;

    private handleMessage(message: string, stderr: boolean) {
        this.onMessage?.(message, stderr);
        if (this.resolveQuitPrompt && message.startsWith("type 'yes' to quit")) {
            this.resolveQuitPrompt();
            this.resolveQuitPrompt = undefined;
        } else if (/Unloading \d+ unused Assets to reduce memory usage. Loaded Objects now:/.test(message)) {
            this.onPreWorldLoaded?.();
            this.state = "running";
            this.onWorldLoaded?.();
        } else {
            const activeSlaveResult = CraftopiaServerManager.activeSlaveRe.exec(
                message,
            );
            if (activeSlaveResult) {
                const [, id, active, name] = activeSlaveResult;
                if (active === "True") {
                    this.onJoin?.({ id, name });
                } else {
                    this.onLeave?.({ id, name });
                }
            }
        }
    }

    private handleClose() {
        this.resolveClose?.();
        this.resolveClose = undefined;
        this.process = undefined;
        this.state = "idle";
        this.onStopped?.();
    }
}
