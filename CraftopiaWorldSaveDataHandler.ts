import { gzipDecode } from "https://deno.land/x/wasm_gzip@v1.0.0/mod.ts";
import { CraftopiaWorldSaveData } from "./CraftopiaWorldSaveData.ts";
export class CraftopiaWorldSaveDataHandler {
    static unpackWorldSaveDataFromPath(path: string) {
        const data = Deno.readFileSync(path);
        return CraftopiaWorldSaveDataHandler.unpackWorldSaveData(data);
    }

    static unpackWorldSaveData(data: Uint8Array): CraftopiaWorldSaveData {
        const unpacked = gzipDecode(data);
        const json = JSON.parse(new TextDecoder().decode(unpacked));
        return json;
    }

    path: string;
    data?: Uint8Array;
    saveData?: CraftopiaWorldSaveData;

    constructor(path: string, data?: Uint8Array) {
        this.path = path;
        this.data = data;
    }

    fetchData() {
        if (!this.data) {
            this.data = Deno.readFileSync(this.path);
        }
        return this.data;
    }

    fetchSaveData() {
        if (!this.saveData) {
            this.saveData = CraftopiaWorldSaveDataHandler.unpackWorldSaveData(this.fetchData());
        }
        return this.saveData;
    }
}
