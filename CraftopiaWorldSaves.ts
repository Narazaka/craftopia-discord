import * as path from "https://deno.land/std@0.127.0/path/mod.ts";
import { CraftopiaWorldSaveDataHandler } from "./CraftopiaWorldSaveDataHandler.ts";

export class CraftopiaWorldSaves {
    serverDirectory: string;
    worldsDirectory: string;

    constructor(serverDirectory: string) {
        this.serverDirectory = serverDirectory;
        this.worldsDirectory = path.join(
            this.serverDirectory,
            "DedicatedServerSave/Worlds",
        );
    }

    worldSaves() {
        return this.ocsList().map((file) => new CraftopiaWorldSaveDataHandler(file));
    }

    ocsList() {
        return Array.from(Deno.readDirSync(this.worldsDirectory))
            .filter((file) => file.isFile && file.name.endsWith(".ocs"))
            .map((file) => path.join(this.worldsDirectory, file.name));
    }
}
