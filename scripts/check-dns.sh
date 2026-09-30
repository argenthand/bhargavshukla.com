#!/usr/bin/env bash
# Checks that bhargavshukla.com's mail records survive the move to Cloudflare DNS.
#
#   scripts/check-dns.sh <name>.ns.cloudflare.com   before the switch: ask Cloudflare directly
#   scripts/check-dns.sh                            after the switch: ask a public resolver
#
# Exits non-zero if any record is missing or wrong. See docs/infrastructure.md#domain-and-dns.
set -uo pipefail

DOMAIN=bhargavshukla.com
DKIM_HOST=d4lcctuitj4vncts3htjpiqi2y3obpk4ah22jxwrnjskwwavp7iwq.domains.proton.ch.
SERVER=${1:-1.1.1.1}
failures=0

q() { dig +short "@$SERVER" "$2" "$1" | sort; }

pass() { printf '  \342\234\223 %s\n' "$1"; }
fail() {
	printf '  \342\234\227 %s\n      expected: %s\n      got:      %s\n' "$1" "$2" "${3:-<nothing>}"
	failures=$((failures + 1))
}

# expect <label> <name> <type> <expected output, newline-separated and sorted>
expect() {
	local got
	got=$(q "$2" "$3")
	if [[ $got == "$4" ]]; then pass "$1"; else fail "$1" "$4" "$got"; fi
}

# contains <label> <name> <type> <line that must be in the output>
contains() {
	local got
	got=$(q "$2" "$3")
	if grep -qxF -- "$4" <<<"$got"; then pass "$1"; else fail "$1" "$4" "$got"; fi
}

echo "Querying @$SERVER for $DOMAIN"

echo "Nameservers"
ns=$(q "$DOMAIN" NS)
if [[ -n $ns ]] && ! grep -qv '\.ns\.cloudflare\.com\.$' <<<"$ns"; then
	pass "NS: $(tr '\n' ' ' <<<"$ns")"
else
	fail "NS all *.ns.cloudflare.com" "two *.ns.cloudflare.com. names" "$(tr '\n' ' ' <<<"$ns")"
fi

echo "Mail (Proton)"
expect "MX" "$DOMAIN" MX $'10 mail.protonmail.ch.\n20 mailsec.protonmail.ch.'
contains "SPF" "$DOMAIN" TXT '"v=spf1 include:_spf.protonmail.ch ~all"'
contains "Proton verification" "$DOMAIN" TXT '"protonmail-verification=3bd359c09da416c5dacb5afe76fc72005f41ca42"'
expect "DMARC" "_dmarc.$DOMAIN" TXT '"v=DMARC1; p=quarantine"'
for key in protonmail protonmail2 protonmail3; do
	expect "DKIM $key" "$key._domainkey.$DOMAIN" CNAME "$key.domainkey.$DKIM_HOST"
done

echo "DNSSEC"
ds=$(q "$DOMAIN" DS)
if [[ -n $ds ]]; then pass "DS record present"; else echo "  - no DS record (expected until DNSSEC is re-enabled)"; fi

echo
if ((failures)); then
	echo "$failures check(s) failed."
	exit 1
fi
echo "All checks passed."
