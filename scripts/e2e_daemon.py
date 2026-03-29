#!/usr/bin/env python3
import argparse
import json
import os
import shlex
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(
        description="Minimal real daemon socket E2E harness for Nous."
    )
    parser.add_argument(
        "--nous-cmd",
        default=os.environ.get("NOUS_CMD", "bun run bin/nous.ts"),
        help='Command used to launch Nous (default: "bun run bin/nous.ts")',
    )
    parser.add_argument(
        "--home",
        default=None,
        help="Override NOUS_HOME. Defaults to a temporary directory.",
    )
    parser.add_argument(
        "--keep-home",
        action="store_true",
        help="Keep the temporary NOUS_HOME after the run.",
    )
    parser.add_argument(
        "--intent",
        default='Inspect this repository and summarize what Nous is doing.',
        help="Intent used in demo mode.",
    )
    parser.add_argument(
        "mode",
        choices=["demo", "status", "thread"],
        nargs="?",
        default="demo",
    )
    parser.add_argument("--thread-id", default="thread_ambient")
    return parser.parse_args()


def read_transport(home: Path):
    state_path = home / "daemon" / "daemon.json"
    deadline = time.time() + 10
    while time.time() < deadline:
        if state_path.exists():
            return json.loads(state_path.read_text())
        time.sleep(0.1)
    raise RuntimeError(f"daemon transport state not found: {state_path}")


def request(home: Path, payload: dict):
    transport = read_transport(home)
    if transport["mode"] == "unix":
        client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        client.connect(transport["socketPath"])
    else:
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.connect((transport["host"], int(transport["port"])))

    with client:
        client.sendall((json.dumps(payload) + "\n").encode())
        data = b""
        while b"\n" not in data:
            chunk = client.recv(65536)
            if not chunk:
                break
            data += chunk
        if not data:
            raise RuntimeError("daemon returned no response")
        line = data.split(b"\n", 1)[0].decode().strip()
        return json.loads(line)


def read_log_tail(log_path: Path, lines: int = 40) -> str:
    if not log_path.exists():
        return "(no daemon log captured)"
    content = log_path.read_text(errors="replace").splitlines()
    return "\n".join(content[-lines:])


def start_daemon(home: Path, nous_cmd: str):
    env = dict(os.environ)
    env["NOUS_HOME"] = str(home)
    log_path = home / "logs" / "e2e-daemon.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = log_path.open("w")
    proc = subprocess.Popen(
        shlex.split(nous_cmd) + ["daemon", "_serve"],
        env=env,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    try:
        read_transport(home)
    except Exception as exc:
        if proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        log_file.close()
        log_tail = read_log_tail(log_path)
        raise RuntimeError(
            f"{exc}\n--- daemon log: {log_path} ---\n{log_tail}"
        ) from exc
    return proc, log_file, log_path


def stop_daemon(proc: subprocess.Popen):
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    proc.wait(timeout=5)


def main():
    args = parse_args()
    temp_home = None
    if args.home:
        home = Path(args.home).expanduser().resolve()
        home.mkdir(parents=True, exist_ok=True)
    else:
        temp_home = tempfile.TemporaryDirectory(prefix="nous-e2e-")
        home = Path(temp_home.name)

    proc = None
    log_file = None
    log_path = None
    try:
        proc, log_file, log_path = start_daemon(home, args.nous_cmd)
        channel = {
            "id": "e2e_cli",
            "type": "cli",
            "scope": {"workingDirectory": str(Path.cwd()), "projectRoot": str(Path.cwd())},
        }

        if args.mode == "status":
            response = request(
                home,
                {
                    "id": "req_status",
                    "type": "get_status",
                    "channel": channel,
                    "payload": {},
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                },
            )
            print(json.dumps(response, indent=2))
            return

        if args.mode == "thread":
            response = request(
                home,
                {
                    "id": "req_thread",
                    "type": "get_thread",
                    "channel": channel,
                    "payload": {"threadId": args.thread_id},
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                },
            )
            print(json.dumps(response, indent=2))
            return

        attach = request(
            home,
            {
                "id": "req_attach",
                "type": "attach",
                "channel": channel,
                "payload": {
                    "channel": {
                        **channel,
                        "status": "connected",
                        "connectedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "lastSeenAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "subscriptions": ["progress", "result", "notification"],
                    },
                    "replayPending": True,
                },
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
        print("ATTACH")
        print(json.dumps(attach, indent=2))

        submit = request(
            home,
            {
                "id": "req_submit",
                "type": "submit_intent",
                "channel": channel,
                "payload": {
                    "text": args.intent,
                    "scope": channel["scope"],
                },
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
        print("SUBMIT")
        print(json.dumps(submit, indent=2))
        thread_id = submit["payload"]["threadId"]

        time.sleep(2)

        status = request(
            home,
            {
                "id": "req_status",
                "type": "get_status",
                "channel": channel,
                "payload": {},
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
        print("STATUS")
        print(json.dumps(status, indent=2))

        thread = request(
            home,
            {
                "id": "req_thread",
                "type": "get_thread",
                "channel": channel,
                "payload": {"threadId": thread_id},
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
        print("THREAD")
        print(json.dumps(thread, indent=2))
        print(f"NOUS_HOME={home}")
        if log_path is not None:
            print(f"DAEMON_LOG={log_path}")
    finally:
        if proc is not None:
            stop_daemon(proc)
        if log_file is not None:
            log_file.close()
        if temp_home is not None and not args.keep_home:
            temp_home.cleanup()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"e2e failed: {exc}", file=sys.stderr)
        sys.exit(1)
