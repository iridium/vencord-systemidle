/*
 * Vencord, a Discord client mod
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

const Native = VencordNative.pluginHelpers.SystemIdle as PluginNative<typeof import("./native")>;
const logger = new Logger("SystemIdle");

const settings = definePluginSettings({
    idleMinutes: {
        description: "Minutes of no keyboard/mouse input (system-wide) before going idle",
        type: OptionType.NUMBER,
        default: 10,
        isValid: (v: number) => v > 0 || "Must be greater than 0",
        onChange: () => Native.start(settings.store.idleMinutes * 60)
    }
});

let timer: ReturnType<typeof setInterval> | undefined;
let systemAway = false;
let lastError: string | null = null;

function setAway(away: boolean) {
    FluxDispatcher.dispatch({ type: "IDLE", idle: away, idleSince: away ? Date.now() : undefined });
    // AFK is what makes Discord forward push notifications to your phone
    FluxDispatcher.dispatch({ type: "AFK", afk: away });
}

async function poll() {
    const { idle, locked, error } = await Native.getState();
    if (error !== lastError) {
        lastError = error;
        if (error) logger.error("Idle/lock detection failed:", error);
    }
    const away = idle || locked;
    if (away !== systemAway) {
        systemAway = away;
        logger.info(away ? `Going idle (${locked ? "screen locked" : "no input"})` : "Back to active");
        setAway(away);
    }
}

export default definePlugin({
    name: "SystemIdle",
    description: "Sets you idle/AFK when the screen locks or there's no system-wide keyboard/mouse input (Wayland), ignoring idle inhibitors instead of activity in the Discord window",
    authors: [{ name: "lain", id: 0n }],
    settings,

    patches: [
        {
            // Same idle module CustomIdle patches: disable Discord's in-window idle timer and its "activity → online" reset
            find: 'type:"IDLE",idle:',
            replacement: [
                {
                    match: /(?<=Date\.now\(\)-\i>)\i\.\i\|\|/,
                    replace: "Infinity||"
                },
                {
                    match: /\i\.\i\.dispatch\({type:"IDLE",idle:!1}\)/,
                    replace: "$self.onWindowActivity()"
                }
            ]
        }
    ],

    onWindowActivity() {
        // Window activity only un-idles us if the system agrees we're here
        if (!systemAway) FluxDispatcher.dispatch({ type: "IDLE", idle: false });
    },

    start() {
        Native.start(settings.store.idleMinutes * 60);
        timer = setInterval(poll, 5000);
        poll();
    },

    stop() {
        clearInterval(timer);
        Native.stop();
        if (systemAway) setAway(false);
        systemAway = false;
    }
});
