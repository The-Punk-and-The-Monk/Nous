#!/usr/bin/env bash

set -euo pipefail

usage() {
	cat <<'EOF'
Usage:
  scripts/codex_overnight.sh [options]

Options:
  --workdir <dir>         Repo/workspace to run in. Default: current directory.
  --session <name>        tmux session name. Default: codex-night-<timestamp>.
  --branch <name>         Git branch to create/switch to. Default: codex-overnight-<timestamp>.
  --max-runs <n>          Maximum Codex rounds to run. Default: 999.
  --model <name>          Optional Codex model override.
  --prompt-file <file>    File containing the initial prompt.
  --prompt <text>         Inline initial prompt. If omitted, a Nous-specific default is used.
  --resume-prompt <text>  Prompt used for subsequent resume rounds.
  --search                Enable Codex web search.
  --safe-workspace        Use Codex workspace-write sandbox with --full-auto (default).
  --dangerous             Use --dangerously-bypass-approvals-and-sandbox instead of --full-auto.
  --foreground            Run in the current shell instead of a detached tmux session.
  --no-branch             Do not create/switch to a new git branch.
  -h, --help              Show this help.

Examples:
  scripts/codex_overnight.sh
  scripts/codex_overnight.sh --prompt-file /tmp/night_prompt.txt
  scripts/codex_overnight.sh --safe-workspace --max-runs 3 --model gpt-5.4
EOF
}

require_cmd() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

timestamp="$(date +%Y%m%d-%H%M%S)"
workdir="$(pwd)"
session_name="codex-night-${timestamp}"
branch_name="codex-overnight-${timestamp}"
max_runs="999"
model=""
prompt_file=""
resume_prompt=""
enable_search="1"
safe_workspace="1"
dangerous="0"
foreground="0"
create_branch="1"

while [[ $# -gt 0 ]]; do
	case "$1" in
		--workdir)
			workdir="$2"
			shift 2
			;;
		--session)
			session_name="$2"
			shift 2
			;;
		--branch)
			branch_name="$2"
			shift 2
			;;
		--max-runs)
			max_runs="$2"
			shift 2
			;;
		--model)
			model="$2"
			shift 2
			;;
		--prompt-file)
			prompt_file="$2"
			shift 2
			;;
		--prompt)
			prompt_file=""
			inline_prompt="$2"
			shift 2
			;;
		--resume-prompt)
			resume_prompt="$2"
			shift 2
			;;
		--search)
			enable_search="1"
			shift
			;;
		--safe-workspace)
			safe_workspace="1"
			dangerous="0"
			shift
			;;
		--dangerous)
			dangerous="1"
			safe_workspace="0"
			shift
			;;
		--foreground)
			foreground="1"
			shift
			;;
		--no-branch)
			create_branch="0"
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $1" >&2
			usage >&2
			exit 1
			;;
	esac
done

workdir="$(cd "$workdir" && pwd)"
if [[ ! -d "$workdir" ]]; then
	echo "Workdir does not exist: $workdir" >&2
	exit 1
fi

require_cmd codex
require_cmd git
if [[ "$foreground" != "1" ]]; then
	require_cmd tmux
fi

if ! [[ "$max_runs" =~ ^[0-9]+$ ]] || [[ "$max_runs" -lt 1 ]]; then
	echo "--max-runs must be a positive integer" >&2
	exit 1
fi

log_root="${TMPDIR:-/tmp}/codex-overnight"
run_dir="${log_root}/${session_name}"
mkdir -p "$run_dir"

prompt_path="${run_dir}/initial_prompt.txt"
resume_prompt_path="${run_dir}/resume_prompt.txt"
runner_path="${run_dir}/runner.sh"

if [[ -n "${inline_prompt:-}" ]]; then
	printf '%s\n' "$inline_prompt" >"$prompt_path"
elif [[ -n "$prompt_file" ]]; then
	cp "$prompt_file" "$prompt_path"
else
	cat >"$prompt_path" <<'EOF'
Continue advancing Nous overnight.

Rules:
- Before making changes, first read:
  - ARCHITECTURE.md
  - docs/DEVELOPMENT_LOG.md
  - docs/PROGRESS_MATRIX.md
- Stay aligned with the Nous north star.
- Prefer architecture-first reasoning before implementation.
- Mandatory write boundary: do not perform any write operation outside the workdir `${WORKDIR}`. Do not create, modify, delete, move, or overwrite files anywhere else.
- Ignore any write to the external Obsidian note or any other non-repo diary/log target. Do not update Obsidian.
- Keep commits focused and coherent.
- After every code or repo-instruction update, update docs/DEVELOPMENT_LOG.md in the same work session.
- If one planned milestone finishes, pick the next highest-leverage continuation only if it is a natural continuation and does not require unresolved product judgment.
- Stop if blocked by credentials, irreversible ambiguity, or a choice that clearly needs the user.
- If comparing external frameworks, explain why they made a choice, what problem it solves, and what new problems it introduces before deciding what Nous should do.
EOF
fi

if [[ -n "$resume_prompt" ]]; then
	printf '%s\n' "$resume_prompt" >"$resume_prompt_path"
else
	cat >"$resume_prompt_path" <<'EOF'
Continue from the current repository state.

Rules:
- Before making further changes, first re-read:
  - ARCHITECTURE.md
  - docs/DEVELOPMENT_LOG.md
  - docs/PROGRESS_MATRIX.md
- Mandatory write boundary: do not perform any write operation outside the workdir `${WORKDIR}`. Do not create, modify, delete, move, or overwrite files anywhere else.
- Ignore any write to the external Obsidian note or any other non-repo diary/log target. Do not update Obsidian.
- Finish the current highest-leverage milestone if it is still in progress.
- If it is complete, choose the next natural continuation that still aligns with the Nous north star.
- Do not branch into speculative side quests that need product judgment.
- Stop and explain the blocker if human judgment, credentials, or risky ambiguity are required.
EOF
fi

if git -C "$workdir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	if [[ "$create_branch" == "1" ]]; then
		if git -C "$workdir" show-ref --verify --quiet "refs/heads/${branch_name}"; then
			git -C "$workdir" switch "$branch_name" >/dev/null
		else
			git -C "$workdir" switch -c "$branch_name" >/dev/null
		fi
	fi
else
	echo "Warning: $workdir is not a git repository. The script will still run Codex there." >&2
fi

cat >"$runner_path" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

cd "$WORKDIR"

echo "== Codex overnight runner =="
echo "workdir: $WORKDIR"
echo "log_dir: $RUN_DIR"
echo "branch: ${BRANCH_NAME:-"(unchanged)"}"
echo "max_runs: $MAX_RUNS"
echo "started_at: $(date '+%Y-%m-%d %H:%M:%S')"

mode_flags=()
if [[ "$DANGEROUS" == "1" ]]; then
	mode_flags+=(--dangerously-bypass-approvals-and-sandbox)
else
	mode_flags+=(--full-auto --sandbox workspace-write)
fi

if [[ -n "$MODEL" ]]; then
	mode_flags+=(--model "$MODEL")
fi

if [[ "$ENABLE_SEARCH" == "1" ]]; then
	mode_flags+=(--search)
fi

for run in $(seq 1 "$MAX_RUNS"); do
	echo ""
	echo "== run $run / $MAX_RUNS at $(date '+%Y-%m-%d %H:%M:%S') =="

	if [[ "$run" == "1" ]]; then
		if codex exec "${mode_flags[@]}" --json -o "$RUN_DIR/last_message_${run}.txt" - <"$PROMPT_PATH" >"$RUN_DIR/run_${run}.jsonl" 2>"$RUN_DIR/run_${run}.stderr.log"; then
			echo "run $run completed successfully"
		else
			status=$?
			echo "run $run failed with status $status"
			echo "$status" >"$RUN_DIR/run_${run}.exit_code"
			break
		fi
	else
		if codex exec resume --last "${mode_flags[@]}" --json -o "$RUN_DIR/last_message_${run}.txt" - <"$RESUME_PROMPT_PATH" >"$RUN_DIR/run_${run}.jsonl" 2>"$RUN_DIR/run_${run}.stderr.log"; then
			echo "run $run completed successfully"
		else
			status=$?
			echo "run $run failed with status $status"
			echo "$status" >"$RUN_DIR/run_${run}.exit_code"
			break
		fi
	fi

	git status --short >"$RUN_DIR/git_status_after_run_${run}.txt" 2>/dev/null || true
	git log --oneline -5 >"$RUN_DIR/git_log_after_run_${run}.txt" 2>/dev/null || true
done

echo ""
echo "finished_at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "logs available at: $RUN_DIR"
EOF

chmod +x "$runner_path"

export WORKDIR="$workdir"
export RUN_DIR="$run_dir"
export BRANCH_NAME="$branch_name"
export MAX_RUNS="$max_runs"
export MODEL="$model"
export ENABLE_SEARCH="$enable_search"
export SAFE_WORKSPACE="$safe_workspace"
export DANGEROUS="$dangerous"
export PROMPT_PATH="$prompt_path"
export RESUME_PROMPT_PATH="$resume_prompt_path"

echo "Prepared Codex overnight run:"
echo "  workdir: $workdir"
echo "  branch:  $(git -C "$workdir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '(non-git)')"
echo "  session: $session_name"
echo "  logs:    $run_dir"
echo "  max runs: $max_runs"
echo "  mode:    $( [[ "$dangerous" == "1" ]] && echo dangerous || echo safe-workspace )"

if [[ "$foreground" == "1" ]]; then
	echo "Running in foreground..."
	exec bash "$runner_path"
fi

if tmux has-session -t "$session_name" 2>/dev/null; then
	echo "tmux session already exists: $session_name" >&2
	exit 1
fi

tmux new-session -d -s "$session_name" "WORKDIR='$WORKDIR' RUN_DIR='$RUN_DIR' BRANCH_NAME='$BRANCH_NAME' MAX_RUNS='$MAX_RUNS' MODEL='$MODEL' ENABLE_SEARCH='$ENABLE_SEARCH' DANGEROUS='$DANGEROUS' PROMPT_PATH='$PROMPT_PATH' RESUME_PROMPT_PATH='$RESUME_PROMPT_PATH' bash '$runner_path'"

echo ""
echo "Detached tmux session started."
echo "  Attach: tmux attach -t $session_name"
echo "  Stop:   tmux kill-session -t $session_name"
echo "  Logs:   $run_dir"
