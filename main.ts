import type { DiscordenoUser } from "https://deno.land/x/discordeno@13.0.0-rc15/mod.ts";
import { createBot, startBot, sendMessage } from "https://deno.land/x/discordeno@13.0.0-rc15/mod.ts";
import { enableCachePlugin, enableCacheSweepers } from "https://deno.land/x/discordeno_cache_plugin@0.0.18/mod.ts";
import { CraftopiaManager } from "./CraftopiaManager.ts";

export const config: {
    token: string;
    botId: string;
    serverDirectory: string;
    channelId: string;
    log?: string;
} = JSON.parse(new TextDecoder("utf8").decode(Deno.readFileSync("config.json")));

const channelId = BigInt(config.channelId);

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
