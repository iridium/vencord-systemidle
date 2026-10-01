/*
 * Vencord, a Discord client mod
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Prints "idle" after <timeout-seconds> without keyboard/mouse input and "active" when input
 * resumes.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wayland-client.h>

#include "ext-idle-notify-v1.h"

static struct wl_seat *seat;
static struct ext_idle_notifier_v1 *notifier;
static uint32_t notifier_version;

static void reg_global(void *d, struct wl_registry *r, uint32_t name, const char *iface,
                       uint32_t ver) {
    if (!strcmp(iface, wl_seat_interface.name) && !seat)
        seat = wl_registry_bind(r, name, &wl_seat_interface, 1);
    else if (!strcmp(iface, ext_idle_notifier_v1_interface.name)) {
        notifier_version = ver < 2 ? ver : 2;
        notifier = wl_registry_bind(r, name, &ext_idle_notifier_v1_interface, notifier_version);
    }
}
static void reg_remove(void *d, struct wl_registry *r, uint32_t name) {}
static const struct wl_registry_listener reg_listener = {reg_global, reg_remove};

static void on_idled(void *d, struct ext_idle_notification_v1 *n) {
    puts("idle");
    fflush(stdout);
}
static void on_resumed(void *d, struct ext_idle_notification_v1 *n) {
    puts("active");
    fflush(stdout);
}
static const struct ext_idle_notification_v1_listener notif_listener = {on_idled, on_resumed};

int main(int argc, char **argv) {
    if (argc != 2) {
        fprintf(stderr, "usage: %s <timeout-seconds>\n", argv[0]);
        return 2;
    }
    uint32_t ms = (uint32_t)(atof(argv[1]) * 1000);
    struct wl_display *dpy = wl_display_connect(NULL);
    if (!dpy) {
        fprintf(stderr, "cannot connect to wayland display\n");
        return 1;
    }
    struct wl_registry *reg = wl_display_get_registry(dpy);
    wl_registry_add_listener(reg, &reg_listener, NULL);
    wl_display_roundtrip(dpy);
    if (!seat || !notifier) {
        fprintf(stderr, "compositor lacks wl_seat or ext_idle_notifier_v1\n");
        return 1;
    }
    /* v2's input idle notification ignores idle inhibitors (video players, games, etc.) */
    struct ext_idle_notification_v1 *n =
        notifier_version >= 2 ? ext_idle_notifier_v1_get_input_idle_notification(notifier, ms, seat)
                              : ext_idle_notifier_v1_get_idle_notification(notifier, ms, seat);
    ext_idle_notification_v1_add_listener(n, &notif_listener, NULL);
    while (wl_display_dispatch(dpy) != -1) {
    }
    return 1;
}
