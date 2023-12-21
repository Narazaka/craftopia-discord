import * as path from "https://deno.land/std@0.127.0/path/mod.ts";

export type EnumValues = typeof CraftopiaServerSetting.enumValuesMap;
export type EnumValue<T extends EnumKey> = keyof EnumValues[T];
export type EnumKey = keyof EnumValues;

export class CraftopiaServerSetting {
    serverDirectory: string;
    serverSetting: string;

    static enumValuesMap = {
        difficulty: {
            Easy: 0,
            Normal: 1,
            Hard: 2,
            VeryHard: 3,
        },
        gameMode: {
            NormalWorld: 1,
            CreativeWorld_Build: 2,
            CreativeWorld_Play: 3,
        },
    } as const;

    static enumKeys = Object.keys(
        CraftopiaServerSetting.enumValuesMap,
    ) as EnumKey[];

    constructor(serverDirectory: string) {
        this.serverDirectory = serverDirectory;
        this.serverSetting = path.join(this.serverDirectory, "ServerSetting.ini");
    }

    read() {
        const data = new TextDecoder().decode(
            Deno.readFileSync(this.serverSetting),
        );
        const lines = data.split("\n");
        const result: { [key: string]: string } = {};
        for (const line of lines) {
            if (/^\s*;/.test(line)) continue;
            if (!/=/.test(line)) continue;
            const [key, value] = line.split("=");
            result[key] = value;
        }
        return result;
    }

    static possibleEnumValues<K extends EnumKey>(key: K): EnumValue<K>[];
    static possibleEnumValues(key: string): EnumValue<EnumKey>[];
    static possibleEnumValues(key: string) {
        return Object.keys(CraftopiaServerSetting.enumValuesMap[key as EnumKey]) ||
            [];
    }

    static getEnumValue<K extends EnumKey>(
        key: K,
        value: number,
    ): EnumValue<K> | undefined;
    static getEnumValue(
        key: string,
        value: number,
    ): EnumValue<EnumKey> | undefined;
    static getEnumValue(key: string, value: number) {
        const values = (CraftopiaServerSetting.enumValuesMap as any)[key];
        if (values) {
            return Object.keys(values).find((k) => values[k] === value) || undefined;
        }
    }

    static isEnumKey(key: string) {
        return CraftopiaServerSetting.enumKeys.includes(key as EnumKey);
    }

    static canSetEnum(key: string, value: string) {
        return (CraftopiaServerSetting.enumValuesMap as any)[key]?.[value] != null;
    }

    setEnum<K extends EnumKey>(key: K, value: EnumValue<K>): void;
    setEnum(key: string, value: string): void;
    setEnum(key: string, value: string) {
        if (CraftopiaServerSetting.canSetEnum(key, value)) {
            this.write(
                "difficulty",
                (CraftopiaServerSetting.enumValuesMap as any)[key][value].toString(),
            );
        }
    }

    setName(name: string) {
        this.write("name", name);
    }

    write(key: string, value: string) {
        const data = new TextDecoder().decode(
            Deno.readFileSync(this.serverSetting),
        );
        const newData = data.replace(
            new RegExp(`^${key}=.*$`, "m"),
            `${key}=${value}`,
        );
        Deno.writeFileSync(this.serverSetting, new TextEncoder().encode(newData));
    }
}
