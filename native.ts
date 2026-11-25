/*
 * Vencord, a Discord client mod
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChildProcess, spawn } from "child_process";
import { homedir } from "os";
import { join } from "path";

// Runs in Electron's main process. Tracks screen lock and system-wide input idle; the renderer polls getState().
// Input idle comes from the input-idle helper, which uses ext-idle-notify-v1's input idle notification and so
// ignores idle inhibitors (games, video players). Build and install it with: make -C src/userplugins/systemIdle/helper install
const HELPER = join(homedir(), ".local/bin/vesktop-input-idle");

let idle = false;
let locked = false;
let error: string | null = null;
let proc: ChildProcess | null = null;
let lockProc: ChildProcess | null = null;
let timeoutSec = 0;

// Run children under setpriv --pdeathsig so the kernel kills them when Vesktop exits, even on a crash or SIGKILL.
// Otherwise they're reparented to systemd and keep running (and holding inherited fds) forever.
function spawnTied(cmd: string, args: string[]) {
    return spawn("setpriv", ["--pdeathsig", "TERM", "--", cmd, ...args], { stdio: ["ignore", "pipe", "ignore"] });
}

function onLines(p: ChildProcess, cb: (line: string) => void) {
    let buf = "";
    p.stdout!.on("data", d => {
        buf += String(d);
        let i: number;
        while ((i = buf.indexOf("\n")) !== -1) {
            cb(buf.slice(0, i));
            buf = buf.slice(i + 1);
        }
    });
}

function startLockWatcher() {
    if (lockProc) return;
    // KDE's screen locker emits org.freedesktop.ScreenSaver.ActiveChanged(bool) on lock/unlock
    const p = spawnTied("gdbus", ["monitor", "--session", "--dest", "org.freedesktop.ScreenSaver"]);
    lockProc = p;
    onLines(p, line => {
        const m = /ActiveChanged \((true|false),\)/.exec(line);
        if (m) locked = m[1] === "true";
    });
    p.on("error", e => { error = `gdbus: ${e}`; });
    p.on("exit", () => { if (lockProc === p) lockProc = null; });
}

function startIdleWatcher(seconds: number) {
    const p = spawnTied(HELPER, [String(seconds)]);
    proc = p;
    onLines(p, line => {
        if (line === "idle") idle = true;
        else if (line === "active") idle = false;
    });
    p.on("error", e => { error = `input-idle: ${e} (build it with: make -C src/userplugins/systemIdle/helper install)`; });
    p.on("exit", code => {
        if (proc !== p) return;
        proc = null;
        idle = false;
        // setpriv exits 127 when it can't exec the helper
        error ??= code === 127
            ? `input-idle: ${HELPER} not found (build it with: make -C src/userplugins/systemIdle/helper install)`
            : `input-idle exited with code ${code}`;
    });
}

export function start(_: unknown, seconds: number) {
    startLockWatcher();
    if (proc && seconds === timeoutSec) return;
    stopIdleWatcher();
    timeoutSec = seconds;
    error = null;
    startIdleWatcher(seconds);
}

function stopIdleWatcher() {
    const p = proc;
    proc = null;
    p?.kill();
    idle = false;
    timeoutSec = 0;
}

export function stop() {
    stopIdleWatcher();
    const p = lockProc;
    lockProc = null;
    p?.kill();
    locked = false;
}

export function getState() {
    return { idle, locked, error };
}
