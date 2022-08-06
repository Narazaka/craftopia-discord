import type { DiscordenoUser } from "https://deno.land/x/discordeno@13.0.0-rc15/mod.ts";
import { createBot, startBot, sendMessage } from "https://deno.land/x/discordeno@13.0.0-rc15/mod.ts";
import { enableCachePlugin, enableCacheSweepers } from "https://deno.land/x/discordeno_cache_plugin@0.0.18/mod.ts";
import { CraftopiaServerManager } from "./CraftopiaServerManager.ts";
import { CraftopiaServerSetting } from "./CraftopiaServerSetting.ts";
import { CraftopiaServerUpdater } from "./CraftopiaServerUpdater.ts";
import { CraftopiaWorldSaves } from "./CraftopiaWorldSaves.ts";

export const config: {
    token: string;
    botId: string;
    serverDirectory: string;
    channelId: string;
    log?: string;
    steamCmdDirectory?: string;
} = JSON.parse(new TextDecoder("utf8").decode(Deno.readFileSync("config.json")));

const channelId = BigInt(config.channelId);

let craftopiaWorldSaves: CraftopiaWorldSaves | undefined;
const craftopiaServerSetting = new CraftopiaServerSetting(config.serverDirectory);

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
            if (message.channelId === channelId && message.content.startsWith("!")) {
                const body = message.content.replace(/^!\s*/, "");
                if (body === "help") {
                    sendMessage(
                        bot,
                        message.channelId,
                        [
                            "start",
                            "stop",
                            "restart",
                            "info",
                            "worlds",
                            ...CraftopiaServerSetting.enumKeys.map(
                                (key) => `set ${key} [${CraftopiaServerSetting.possibleEnumValues(key).join("|")}]`,
                            ),
                            "update-server",
                        ].join("\n"),
                    );
                } else if (craftopiaServerUpdater?.updating) {
                    sendMessage(bot, message.channelId, "command is not available because updating...");
                } else {
                    if (body === "start") {
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
                    } else if (body === "info") {
                        const setting = craftopiaServerSetting.read();
                        const str = [
                            `ワールド名: ${setting.name}`,
                            `難易度: ${CraftopiaServerSetting.getEnumValue("difficulty", Number(setting.difficulty))}`,
                            `モード: ${CraftopiaServerSetting.getEnumValue("gameMode", Number(setting.gameMode))}`,
                            `最大プレイ人数: ${setting.maxPlayerNumber}`,
                        ].join("\n");

                        sendMessage(bot, message.channelId, str);
                    } else if (body === "worlds") {
                        if (!craftopiaWorldSaves) craftopiaWorldSaves = new CraftopiaWorldSaves(config.serverDirectory);
                        const names = craftopiaWorldSaves
                            .worldSaves()
                            .map((w) => w.fetchSaveData().WorldSave.value.name);
                        sendMessage(bot, message.channelId, `${names.length} worlds: ${names.join(", ")}`);
                    } else if (body.startsWith("set")) {
                        const matched = body.match(/^set\s+(\S+)\s+(\w+)$/);
                        if (matched) {
                            const [, key, value] = matched;
                            if (CraftopiaServerSetting.canSetEnum(key, value)) {
                                craftopiaServerSetting.setEnum(key, value);
                                sendMessage(bot, message.channelId, `${key} set to ${value}`);
                                if (manager.state !== "idle") {
                                    sendMessage(bot, message.channelId, "サーバー再起動しないと反映されません");
                                }
                            } else if (CraftopiaServerSetting.isEnumKey(key)) {
                                sendMessage(
                                    bot,
                                    message.channelId,
                                    `! set ${key} [${CraftopiaServerSetting.possibleEnumValues(key).join("|")}]`,
                                );
                            } else {
                                sendMessage(
                                    bot,
                                    message.channelId,
                                    `! set [${CraftopiaServerSetting.enumKeys.join("|")}] <value>`,
                                );
                            }
                        } else {
                            sendMessage(
                                bot,
                                message.channelId,
                                `! set [${CraftopiaServerSetting.enumKeys.join("|")}] <value>`,
                            );
                        }
                    } else if (body === "update-server") {
                        if (manager.canStart) {
                            if (craftopiaServerUpdater) {
                                sendMessage(bot, message.channelId, "updating...");
                                craftopiaServerUpdater.updateServer().then(
                                    () => {
                                        sendMessage(bot, message.channelId, "update done!");
                                    },
                                    (stderr) => {
                                        sendMessage(bot, message.channelId, "update failed!");
                                        sendMessage(bot, message.channelId, stderr);
                                    },
                                );
                            } else {
                                sendMessage(
                                    bot,
                                    message.channelId,
                                    "update-server is not enabled! steamCmdDirectory is not set",
                                );
                            }
                        } else {
                            sendMessage(bot, message.channelId, `Cannot update server! Server is ${manager.state}`);
                        }
                    }
                }
            }
        },
    },
});

const bot = enableCachePlugin(baseBot);

enableCacheSweepers(bot);

const manager = new CraftopiaServerManager(config.serverDirectory);

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
    craftopiaWorldSaves = undefined;
};

manager.onPreWorldLoaded = () => {
    sendMessage(bot, channelId, manager.state === "running" ? "world loaded" : "server started");
};

manager.onStop = () => {
    sendMessage(bot, channelId, "server stopping");
};

manager.onStopped = () => {
    sendMessage(bot, channelId, "server stopped");
};

const logFp = config.log ? await Deno.open(config.log, { create: true, append: true }) : undefined;
const textEncoder = new TextEncoder();

manager.onMessage = (message) => {
    console.log(message);
    logFp?.writeSync(textEncoder.encode(new Date().toISOString() + " " + message + "\n"));
};

sendMessage(bot, channelId, "manager started");
globalThis.onunload = () => {
    sendMessage(bot, channelId, "manager killed");
};

const craftopiaServerUpdater = config.steamCmdDirectory
    ? new CraftopiaServerUpdater(config.serverDirectory, config.steamCmdDirectory)
    : undefined;

if (craftopiaServerUpdater) {
    craftopiaServerUpdater.onMessage = (message) => {
        console.log(message);
        logFp?.writeSync(textEncoder.encode(new Date().toISOString() + " " + message + "\n"));
    };
}

await startBot(bot);
