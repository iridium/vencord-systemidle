# Builds the input-idle helper used by the SystemIdle plugin and installs it to ~/.local/bin
PROTO := $(shell pkg-config --variable=pkgdatadir wayland-protocols)/staging/ext-idle-notify/ext-idle-notify-v1.xml
PREFIX ?= $(HOME)/.local

input-idle: input-idle.c ext-idle-notify-v1.h ext-idle-notify-v1.c
	$(CC) -O2 -Wall -o $@ input-idle.c ext-idle-notify-v1.c $(shell pkg-config --cflags --libs wayland-client)

ext-idle-notify-v1.h:
	wayland-scanner client-header $(PROTO) $@

ext-idle-notify-v1.c:
	wayland-scanner private-code $(PROTO) $@

install: input-idle
	install -Dm755 input-idle $(PREFIX)/bin/vesktop-input-idle

clean:
	rm -f input-idle ext-idle-notify-v1.h ext-idle-notify-v1.c

.PHONY: install clean
