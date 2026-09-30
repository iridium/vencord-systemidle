# SystemIdle

> [!NOTE]
> This plugin was written by an LLM (Claude), directed and tested by a human.

A Vencord user plugin that makes Vesktop go idle when you actually step away, not when the Discord window loses focus.

- **Screen lock** sets you idle + AFK right away, and unlocking brings you back.
- **No keyboard/mouse input** anywhere on the system for `idleMinutes` (default 10) does the same. Idle inhibitors from games and video players are ignored.

AFK matters because Discord only sends push notifications to your phone while your desktop client is AFK.

Tested on KDE Plasma (Wayland). Other compositors that support `ext-idle-notify-v1` should work for the idle part; the lock part uses `org.freedesktop.ScreenSaver`.

## Requirements

- Vesktop with a custom Vencord build
- `gdbus` (glib2)
- A C compiler, `wayland-scanner`, and `wayland-protocols` to build the helper

## Install

```bash
cd /path/to/Vencord
git clone https://github.com/iridium/vencord-systemidle src/userplugins/systemIdle
make -C src/userplugins/systemIdle/helper install   # installs ~/.local/bin/vesktop-input-idle
pnpm build
```

In Vesktop: Settings → Vesktop Settings → Developer Options → Vencord Location, pick `Vencord/dist`, restart Vesktop, then enable **SystemIdle**. Keep **CustomIdle** disabled, since both patch the same code.

## How it works

- `native.ts` (Electron main process) runs `gdbus monitor` for `ScreenSaver.ActiveChanged` and starts the `vesktop-input-idle` helper.
- `helper/input-idle.c` uses `ext-idle-notify-v1`'s input idle notification (v2), which ignores idle inhibitors, and prints `idle` / `active`.
- `index.ts` polls that state every 5 seconds and dispatches Discord's `IDLE` and `AFK` actions. It also disables Discord's in-window idle timer.

An official native Wayland idle module is in progress upstream ([Vesktop#1280](https://github.com/Vencord/Vesktop/pull/1280), [Vencord#4375](https://github.com/Vendicated/Vencord/pull/4375)). Once that ships, it may replace the idle half of this plugin.

## License

GPL-3.0-or-later
