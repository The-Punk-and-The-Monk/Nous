#!/usr/bin/env bash

set -u -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${1:-${SCRIPT_DIR}/env.txt}"

if [[ ! -f "${ENV_FILE}" ]]; then
	echo "Missing env file: ${ENV_FILE}" >&2
	exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

cd "${REPO_ROOT}"

if [[ -z "${OPENAI_BASE_URL:-}" || -z "${OPENAI_API_KEY:-}" || -z "${OPENAI_MODEL:-}" ]]; then
	echo "OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL must be set in ${ENV_FILE}" >&2
	exit 1
fi

CHAT_URL="${OPENAI_BASE_URL%/}/chat/completions"
REQUEST_BODY="$(cat <<JSON
{"model":"${OPENAI_MODEL}","messages":[{"role":"user","content":"你好，回复一句中文。"}],"max_tokens":64}
JSON
)"

print_section() {
	echo
	echo "== $1 =="
}

print_kv() {
	printf '%-18s %s\n' "$1" "$2"
}

redact_api_key() {
	local key="${1:-}"
	if [[ -z "${key}" ]]; then
		echo "(unset)"
		return
	fi
	local length=${#key}
	if (( length <= 8 )); then
		echo "****"
		return
	fi
	echo "${key:0:4}...${key:length-4:4}"
}

show_file_head() {
	local path="$1"
	local lines="${2:-20}"
	if [[ -f "${path}" ]]; then
		sed -n "1,${lines}p" "${path}"
	else
		echo "(no output file)"
	fi
}

run_curl_probe() {
	local label="$1"
	shift
	local headers_file body_file
	headers_file="$(mktemp)"
	body_file="$(mktemp)"
	print_section "${label}"
	local status
	curl -sS -o "${body_file}" -D "${headers_file}" \
		-H "Authorization: Bearer ${OPENAI_API_KEY}" \
		-H "Content-Type: application/json" \
		-d "${REQUEST_BODY}" \
		"${CHAT_URL}" "$@" >/dev/null 2>&1
	status=$?
	print_kv "curl_exit" "${status}"
	echo "-- headers --"
	show_file_head "${headers_file}" 20
	echo "-- body --"
	show_file_head "${body_file}" 40
	rm -f "${headers_file}" "${body_file}"
}

run_bun_fetch_probe() {
	print_section "bun fetch (current env)"
	local status
	local output_file
	output_file="$(mktemp)"
	bun -e '
		const start = Date.now();
		const url = (process.env.OPENAI_BASE_URL || "") + "/chat/completions";
		const body = {
			model: process.env.OPENAI_MODEL,
			messages: [{ role: "user", content: "你好，回复一句中文。" }],
			max_tokens: 64,
		};
		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: "Bearer " + process.env.OPENAI_API_KEY,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			});
			console.log(JSON.stringify({
				url,
				ok: response.ok,
				status: response.status,
				ms: Date.now() - start,
				text: await response.text(),
			}, null, 2));
		} catch (error) {
			console.error(JSON.stringify({
				url,
				ms: Date.now() - start,
				error: String(error),
			}, null, 2));
			process.exit(1);
		}
	' >"${output_file}" 2>&1
	status=$?
	print_kv "bun_fetch_exit" "${status}"
	show_file_head "${output_file}" 80
	rm -f "${output_file}"
}

run_nous_provider_probe() {
	print_section "Nous provider.chat (current env)"
	local status
	local output_file
	output_file="$(mktemp)"
	bun -e '
		import { createLLMProviderFromEnv } from "./packages/infra/src/cli/provider.ts";
		const { provider, providerName } = createLLMProviderFromEnv(process.env);
		const client = (provider && typeof provider === "object" && "client" in provider)
			? (provider as { client?: { baseURL?: string; organization?: string | null; project?: string | null } }).client
			: undefined;
		const start = Date.now();
		try {
			const response = await provider.chat({
				system: "Reply with plain text only.",
				messages: [{ role: "user", content: "Say hello in Chinese in one short sentence." }],
				maxTokens: 64,
				temperature: 0,
			});
			const text = response.content
				.filter((block) => block.type === "text")
				.map((block) => block.text)
				.join("\n");
			console.log(JSON.stringify({
				providerName,
				clientBaseURL: client?.baseURL,
				organizationHeaderEnabled: client?.organization != null,
				projectHeaderEnabled: client?.project != null,
				ms: Date.now() - start,
				stopReason: response.stopReason,
				text,
				usage: response.usage,
			}, null, 2));
		} catch (error) {
			console.error(JSON.stringify({
				providerName,
				clientBaseURL: client?.baseURL,
				organizationHeaderEnabled: client?.organization != null,
				projectHeaderEnabled: client?.project != null,
				ms: Date.now() - start,
				error: String(error),
			}, null, 2));
			process.exit(1);
		}
	' >"${output_file}" 2>&1
	status=$?
	print_kv "provider_exit" "${status}"
	show_file_head "${output_file}" 120
	rm -f "${output_file}"
}

print_section "Environment summary"
print_kv "env_file" "${ENV_FILE}"
print_kv "NOUS_HOME" "${NOUS_HOME:-"(unset)"}"
print_kv "OPENAI_BASE_URL" "${OPENAI_BASE_URL}"
print_kv "OPENAI_MODEL" "${OPENAI_MODEL}"
print_kv "OPENAI_WIRE_API" "${OPENAI_WIRE_API:-"(unset)"}"
print_kv "OPENAI_API_KEY" "$(redact_api_key "${OPENAI_API_KEY}")"

print_section "Proxy summary"
print_kv "http_proxy" "${http_proxy:-"(unset)"}"
print_kv "https_proxy" "${https_proxy:-"(unset)"}"
print_kv "ALL_PROXY" "${ALL_PROXY:-"(unset)"}"
print_kv "HTTP_PROXY" "${HTTP_PROXY:-"(unset)"}"
print_kv "HTTPS_PROXY" "${HTTPS_PROXY:-"(unset)"}"
print_kv "NO_PROXY" "${NO_PROXY:-"(unset)"}"
print_kv "no_proxy" "${no_proxy:-"(unset)"}"

run_curl_probe "curl (current env)"
run_curl_probe "curl (without proxy env)" \
	--proxy "" \
	--noproxy "*"
run_bun_fetch_probe
run_nous_provider_probe
