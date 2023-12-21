import { blue, bold, red, white, yellow } from "./deps.ts";

export function colored(text: string) {
    if (text.startsWith(">")) return white(bold(text));
    if (text.startsWith("WARNING:")) return yellow(bold(text));
    if (text.startsWith("ERROR:")) return red(bold(text));
    return blue(bold(text));
}
