#!/usr/bin/env bash
# Checks the CMS VPS against #10's acceptance criteria.
#
#   scripts/check-vps.sh <ipv4>
#
# Exits non-zero if any check fails. See docs/infrastructure.md#runbook.
set -uo pipefail

HOST=${1:?usage: scripts/check-vps.sh <ipv4>}
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
failures=0

pass() { printf '  \342\234\223 %s\n' "$1"; }
fail() {
	printf '  \342\234\227 %s\n      expected: %s\n      got:      %s\n' "$1" "$2" "${3:-<nothing>}"
	failures=$((failures + 1))
}

on_box() { ssh "${SSH_OPTS[@]}" "deploy@$HOST" "$@" 2>&1; }

echo "Checking $HOST"

echo "First boot"
got=$(on_box 'cloud-init status --wait >/dev/null; cloud-init status')
if [[ $got == *"status: done"* ]]; then pass "cloud-init done"; else fail "cloud-init done" "status: done" "$got"; fi

echo "SSH"
got=$(on_box 'docker compose version')
if [[ $got == "Docker Compose version"* ]]; then pass "deploy: $got"; else fail "ssh deploy@ docker compose version" "Docker Compose version …" "$got"; fi

got=$(ssh "${SSH_OPTS[@]}" "root@$HOST" true 2>&1)
if [[ $got == *"Permission denied"* ]]; then pass "root login refused"; else fail "root login refused" "Permission denied" "$got"; fi

# With only password auth offered, the server should list publickey as its sole method.
got=$(ssh -o BatchMode=yes -o ConnectTimeout=10 -o PubkeyAuthentication=no "deploy@$HOST" true 2>&1)
if [[ $got == *"Permission denied (publickey)."* ]]; then pass "password auth off"; else fail "password auth off" "Permission denied (publickey)." "$got"; fi

echo "Updates"
got=$(on_box 'apt-config dump APT::Periodic::Unattended-Upgrade; systemctl is-active unattended-upgrades')
if [[ $got == *'"1";'* && $got == *active ]]; then pass "unattended-upgrades on"; else fail "unattended-upgrades on" 'Unattended-Upgrade "1"; active' "$got"; fi

echo "Firewall (from here)"
for port in 22 80 443 1337; do
	if nc -z -G 5 "$HOST" "$port" 2>/dev/null; then open=yes; else open=no; fi
	if [[ $port == 22 ]]; then want=yes; else want=no; fi
	if [[ $open == "$want" ]]; then pass "port $port open=$open"; else fail "port $port" "open=$want" "open=$open"; fi
done

echo
if ((failures)); then
	echo "$failures check(s) failed."
	exit 1
fi
echo "All checks passed."
