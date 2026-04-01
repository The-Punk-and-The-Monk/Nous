#!/usr/bin/env bash

set -euo pipefail

escape_applescript() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

escape_jxa() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

usage() {
	cat <<'EOF'
Usage:
  scripts/macos_notify.sh [options] <message>

Options:
  --title <title>   Notification title. Default: Nous
  -h, --help        Show this help

Examples:
  scripts/macos_notify.sh "Iteration committed abc123"
  scripts/macos_notify.sh --title "Nous" "Stopping after blocker"
EOF
}

title="Nous"
message=""

while [[ $# -gt 0 ]]; do
	case "$1" in
		--title)
			title="$2"
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			if [[ -n "$message" ]]; then
				message="${message} $1"
			else
				message="$1"
			fi
			shift
			;;
	esac
done

if [[ -z "$message" ]]; then
	echo "Missing notification message." >&2
	usage >&2
	exit 1
fi

if ! command -v osascript >/dev/null 2>&1; then
	echo "osascript is not available on this machine." >&2
	exit 1
fi

apple_script=$(cat <<EOF
display notification "$(escape_applescript "$message")" with title "$(escape_applescript "$title")"
EOF
)

if osascript -e "$apple_script" >/dev/null 2>&1; then
	exit 0
fi

jxa_script=$(cat <<EOF
ObjC.import("Foundation");
ObjC.import("AppKit");
var notification = $.NSUserNotification.alloc.init;
notification.title = "$(escape_jxa "$title")";
notification.informativeText = "$(escape_jxa "$message")";
$.NSUserNotificationCenter.defaultUserNotificationCenter.deliverNotification(notification);
EOF
)

if osascript -l JavaScript -e "$jxa_script" >/dev/null 2>&1; then
	exit 0
fi

echo "Failed to send macOS notification via AppleScript and JXA fallback." >&2
exit 1
