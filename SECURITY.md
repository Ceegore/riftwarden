# Security and private reporting

Riftwarden has no telemetry, account, ad, remote-code or runtime-network feature. Repository reports and issues must never contain credentials, signing material, personal data, private save payloads or unrestricted device logs.

For a suspected secret or signing-material exposure:

1. stop commits and CI publication;
2. revoke or rotate the credential outside Git;
3. identify every affected ref and artifact;
4. open a private security report with the smallest safe evidence;
5. clean history only through an approved incident plan;
6. rerun repository, binary, permission and release provenance checks.

P0 examples include exposed signing keys, unauthorized network behavior, save loss or a privacy-contract violation. No P0/P1 waiver is allowed.
