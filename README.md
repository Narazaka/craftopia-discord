# craftopia-discord

Craftopia Dedicated Server 用のDiscord無理矢理連携。

今鯖に何人居るかとかをチャンネルに投げたり、起動、停止、設定変更なんかをコマンドで出来るやつ。

## インストール

[Release](https://github.com/Narazaka/craftopia-discord/releases/latest)からダウンロードしててきとうなところにおく

## 使い方

1. https://discord.com/developers/applications からdiscord botを作る

2. config.jsonを以下のように設定して`craftopia-discord.exe`を叩く

3. discord側で`!help`コマンドを叩くと色々出来ることがわかる

```json
{
    "token": "Discordのbotのtoken",
    "botId": "DiscordのAPPLICATION ID",
    "serverDirectory": "CraftopiaDedicatedServerのフォルダ",
    "channelId": "Discordの対象チャンネルID（開発者モードでコピー出来るやつ）",
    "log": "ログの場所。指定しなければログを書かない。",
    "steamCmdDirectory": "steamcmd.exeのフォルダ（アップデート用）"
}
```

## build

denoをインストールしてcompile.batを叩くと`craftopia-discord.exe`ができる

## License

[Zlib License](LICENSE)
