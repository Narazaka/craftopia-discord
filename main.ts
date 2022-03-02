import type { DiscordenoUser } from "https://deno.land/x/discordeno@13.0.0-rc15/mod.ts";
import { createBot, startBot, sendMessage } from "https://deno.land/x/discordeno@13.0.0-rc15/mod.ts";
import { enableCachePlugin, enableCacheSweepers } from "https://deno.land/x/discordeno_cache_plugin@0.0.18/mod.ts";
import * as path from "https://deno.land/std@0.127.0/path/mod.ts";
import { execFile } from "https://deno.land/std@0.127.0/node/child_process.ts";
import type { ChildProcess } from "https://deno.land/std@0.127.0/node/internal/child_process.ts";

const config: {
    token: string;
    botId: string;
    serverDirectory: string;
    channelId: string;
    log?: string;
} = JSON.parse(new TextDecoder("utf8").decode(Deno.readFileSync("config.json")));

const channelId = BigInt(config.channelId);

class CraftopiaManager {
    serverDirectory: string;
    exe: string;
    process?: ChildProcess;
    state: "idle" | "starting" | "running" | "stopping" = "idle";

    onMessage?: (message: string, stderr: boolean) => unknown;
    onJoin?: (params: { id: string; name: string }) => unknown;
    onLeave?: (params: { id: string; name: string }) => unknown;
    onStart?: () => unknown;
    onStop?: () => unknown;
    onStarted?: () => unknown;
    onStopped?: () => unknown;

    private closed?: Promise<unknown>;
    private resolveQuitPrompt?: () => unknown;
    private resolveClose?: () => unknown;

    constructor(serverDirectory: string) {
        this.serverDirectory = serverDirectory;
        this.exe = path.join(config.serverDirectory, "Craftopia.exe");
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
        const waitPrompt = new Promise<void>((resolve) => (this.resolveQuitPrompt = resolve));
        await this.sendLine("quit");
        await waitPrompt;
        await this.sendLine("yes");
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
            this.process!.stdin?.write(str, (error) => (error ? reject(error) : resolve())),
        );
    }

    private static activeSlaveRe = /^ActiveSlave:Id=(\w+) Active=(True|False) Name=(.*)/m;

    private handleMessage(message: string, stderr: boolean) {
        this.onMessage?.(message, stderr);
        if (this.resolveQuitPrompt && message.startsWith("type 'yes' to quit")) {
            this.resolveQuitPrompt();
            this.resolveQuitPrompt = undefined;
        } else if (message.startsWith("World is loaded!")) {
            this.state = "running";
            this.onStarted?.();
        } else {
            const activeSlaveResult = CraftopiaManager.activeSlaveRe.exec(message);
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

let botUser: DiscordenoUser;
const baseBot = createBot({
    token: config.token,
    botId: BigInt(config.botId),
    intents: ["Guilds", "GuildMessages"],
    events: {
        ready(_bot, { user }) {
            botUser = user;
            console.log("ready");
        },
        messageCreate(_bot, message) {
            if (message.mentionedUserIds.includes(botUser.id)) {
                const body = message.content.replace(/^.*?>\s*/, "");
                if (body === "help") {
                    sendMessage(bot, message.channelId, "start, stop, restart");
                } else if (body === "start") {
                    if (manager.canStart) {
                        manager.start();
                    } else {
                        sendMessage(bot, message.channelId, `Cannot start! Server is ${manager.state}`);
                    }
                } else if (body === "restart") {
                    if (manager.canRestart) {
                        manager.restart();
                    } else {
                        sendMessage(bot, message.channelId, `Cannot restart! Server is ${manager.state}`);
                    }
                } else if (body === "stop") {
                    if (manager.canStop) {
                        manager.stop();
                    } else {
                        sendMessage(bot, message.channelId, `Cannot stop! Server is ${manager.state}`);
                    }
                }
            }
        },
    },
});

const bot = enableCachePlugin(baseBot);

enableCacheSweepers(bot);

const manager = new CraftopiaManager(config.serverDirectory);

const usernamesMap: { [name: string]: boolean } = {};

function sendCurrentPlayers() {
    const usernames = Object.keys(usernamesMap);
    sendMessage(
        bot,
        channelId,
        `${usernames.length} users: ${usernames.map((username) => `[${username}]`).join(", ")} playing`,
    );
}

manager.onJoin = ({ name }) => {
    usernamesMap[name] = true;
    sendMessage(bot, channelId, `[${name}] joined`);
    sendCurrentPlayers();
};

manager.onLeave = ({ name }) => {
    delete usernamesMap[name];
    sendMessage(bot, channelId, `[${name}] leaved`);
    sendCurrentPlayers();
};

manager.onStart = () => {
    sendMessage(bot, channelId, "server starting");
};

manager.onStarted = () => {
    sendMessage(bot, channelId, "server started");
};

manager.onStop = () => {
    sendMessage(bot, channelId, "server stopping");
};

manager.onStopped = () => {
    sendMessage(bot, channelId, "server stopped");
};

const logFp = config.log ? await Deno.open(config.log, { create: true, append: true }) : undefined;
const textEncoder = new TextEncoder();

manager.onMessage = (message, stderr) => {
    if (stderr) {
        console.warn("ERR", `[[[${message}]]]`);
    } else {
        console.log("OUT", `[[[${message}]]]`);
    }
    logFp?.writeSync(textEncoder.encode(new Date().toISOString() + " " + message + "\n"));
};

await startBot(bot);
