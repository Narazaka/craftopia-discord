import { createBot, GatewayIntents, sendMessage, startBot } from "./deps.ts";
import { CraftopiaServerManager } from "./CraftopiaServerManager.ts";
import { CraftopiaServerSetting } from "./CraftopiaServerSetting.ts";
import { CraftopiaServerUpdater } from "./CraftopiaServerUpdater.ts";
import { CraftopiaWorldSaves } from "./CraftopiaWorldSaves.ts";
import { colored } from "./colored.ts";

export const config: {
    token: string;
    botId: string;
    serverDirectory: string;
    channelId: string;
    log?: string;
    steamCmdDirectory?: string;
    autoStart?: boolean;
} = JSON.parse(
    new TextDecoder("utf8").decode(Deno.readFileSync("config.json")),
);

const channelId = BigInt(config.channelId);

let craftopiaWorldSaves: CraftopiaWorldSaves | undefined;
const craftopiaServerSetting = new CraftopiaServerSetting(
    config.serverDirectory,
);

const bot = createBot({
    token: config.token,
    botId: BigInt(config.botId),
    intents: GatewayIntents.Guilds | GatewayIntents.GuildMessages | GatewayIntents.MessageContent,
    events: {
        ready(_bot) {
            console.log("ready");
            if (config.autoStart && manager.canStart) {
                manager.start();
            }
        },
        messageCreate(_bot, message) {
            if (message.channelId === channelId && message.content.startsWith("!")) {
                console.log(colored(`> ${message.content}`));
                const body = message.content.replace(/^!\s*/, "");
                if (body === "help") {
                    sendMessage(
                        bot,
                        message.channelId,
                        {
                            content: [
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
                        },
                    );
                } else if (craftopiaServerUpdater?.updating) {
                    sendMessage(bot, message.channelId, {
                        content: "command is not available because updating...",
                    });
                } else {
                    if (body === "start") {
                        if (manager.canStart) {
                            manager.start();
                        } else {
                            sendMessage(bot, message.channelId, {
                                content: `Cannot start! Server is ${manager.state}`,
                            });
                        }
                    } else if (body === "restart") {
                        if (manager.canRestart) {
                            manager.restart();
                        } else {
                            sendMessage(bot, message.channelId, {
                                content: `Cannot restart! Server is ${manager.state}`,
                            });
                        }
                    } else if (body === "stop") {
                        if (manager.canStop) {
                            manager.stop();
                        } else {
                            sendMessage(bot, message.channelId, {
                                content: `Cannot stop! Server is ${manager.state}`,
                            });
                        }
                    } else if (body === "info") {
                        try {
                            const setting = craftopiaServerSetting.read();
                            const str = [
                                `ワールド名: ${setting.name}`,
                                `難易度: ${
                                    CraftopiaServerSetting.getEnumValue(
                                        "difficulty",
                                        Number(setting.difficulty),
                                    )
                                }`,
                                `モード: ${
                                    CraftopiaServerSetting.getEnumValue(
                                        "gameMode",
                                        Number(setting.gameMode),
                                    )
                                }`,
                                `最大プレイ人数: ${setting.maxPlayerNumber}`,
                            ].join("\n");

                            sendMessage(bot, message.channelId, { content: str });
                        } catch (_e) {
                            sendMessage(bot, message.channelId, { content: "error" });
                            return;
                        }
                    } else if (body === "worlds") {
                        if (!craftopiaWorldSaves) {
                            craftopiaWorldSaves = new CraftopiaWorldSaves(
                                config.serverDirectory,
                            );
                        }
                        const names = craftopiaWorldSaves
                            .worldSaves()
                            .map((w) => w.fetchSaveData().WorldSave.value.name);
                        sendMessage(bot, message.channelId, {
                            content: `${names.length} worlds: ${names.join(", ")}`,
                        });
                    } else if (body.startsWith("set")) {
                        const matched = body.match(/^set\s+(\S+)\s+(\w+)$/);
                        if (matched) {
                            const [, key, value] = matched;
                            if (CraftopiaServerSetting.canSetEnum(key, value)) {
                                craftopiaServerSetting.setEnum(key, value);
                                sendMessage(bot, message.channelId, {
                                    content: `${key} set to ${value}`,
                                });
                                if (manager.state !== "idle") {
                                    sendMessage(bot, message.channelId, {
                                        content: "サーバー再起動しないと反映されません",
                                    });
                                }
                            } else if (CraftopiaServerSetting.isEnumKey(key)) {
                                sendMessage(
                                    bot,
                                    message.channelId,
                                    {
                                        content: `! set ${key} [${
                                            CraftopiaServerSetting.possibleEnumValues(key).join("|")
                                        }]`,
                                    },
                                );
                            } else {
                                sendMessage(
                                    bot,
                                    message.channelId,
                                    {
                                        content: `! set [${CraftopiaServerSetting.enumKeys.join("|")}] <value>`,
                                    },
                                );
                            }
                        } else {
                            sendMessage(
                                bot,
                                message.channelId,
                                {
                                    content: `! set [${CraftopiaServerSetting.enumKeys.join("|")}] <value>`,
                                },
                            );
                        }
                    } else if (body === "update-server") {
                        if (manager.canStart) {
                            if (craftopiaServerUpdater) {
                                sendMessage(bot, message.channelId, { content: "updating..." });
                                craftopiaServerUpdater.updateServer().then(
                                    () => {
                                        sendMessage(bot, message.channelId, {
                                            content: "update done!",
                                        });
                                    },
                                    (stderr) => {
                                        sendMessage(bot, message.channelId, {
                                            content: "update failed!",
                                        });
                                        sendMessage(bot, message.channelId, { content: `ERROR:\n${stderr}` });
                                    },
                                );
                            } else {
                                sendMessage(
                                    bot,
                                    message.channelId,
                                    {
                                        content: "update-server is not enabled! steamCmdDirectory is not set",
                                    },
                                );
                            }
                        } else {
                            sendMessage(bot, message.channelId, {
                                content: `Cannot update server! Server is ${manager.state}`,
                            });
                        }
                    }
                }
            }
        },
    },
});

const manager = new CraftopiaServerManager(config.serverDirectory);

const usernamesMap: { [name: string]: boolean } = {};

function sendCurrentPlayers() {
    const usernames = Object.keys(usernamesMap);
    sendMessage(
        bot,
        channelId,
        {
            content: `${usernames.length} users: ${usernames.map((username) => `[${username}]`).join(", ")} playing`,
        },
    );
}

manager.onJoin = ({ name }) => {
    usernamesMap[name] = true;
    sendMessage(bot, channelId, { content: `[${name}] joined` });
    sendCurrentPlayers();
};

manager.onLeave = ({ name }) => {
    delete usernamesMap[name];
    sendMessage(bot, channelId, { content: `[${name}] leaved` });
    sendCurrentPlayers();
};

manager.onStart = () => {
    sendMessage(bot, channelId, { content: "server starting" });
    craftopiaWorldSaves = undefined;
};

manager.onPreWorldLoaded = () => {
    sendMessage(bot, channelId, {
        content: manager.state === "running" ? "world loaded" : "server started",
    });
};

manager.onStop = () => {
    sendMessage(bot, channelId, { content: "server stopping" });
};

manager.onStopped = () => {
    sendMessage(bot, channelId, { content: "server stopped" });
};

const logFp = config.log ? await Deno.open(config.log, { create: true, append: true }) : undefined;
const textEncoder = new TextEncoder();

manager.onMessage = (message) => {
    console.log(colored(message));
    logFp?.writeSync(
        textEncoder.encode(new Date().toISOString() + " " + message + "\n"),
    );
};

sendMessage(bot, channelId, { content: "manager started" });
globalThis.onunload = () => {
    sendMessage(bot, channelId, { content: "manager killed" });
};

const craftopiaServerUpdater = config.steamCmdDirectory
    ? new CraftopiaServerUpdater(config.serverDirectory, config.steamCmdDirectory)
    : undefined;

if (craftopiaServerUpdater) {
    craftopiaServerUpdater.onMessage = (message) => {
        console.log(message);
        logFp?.writeSync(
            textEncoder.encode(new Date().toISOString() + " " + message + "\n"),
        );
    };
}

await startBot(bot);
