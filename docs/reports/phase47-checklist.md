# Phase 47 — Release Freeze & Store Binary Production

**Status:** DOCUMENTATION-ONLY. Gate G47: BLOCKED on real RC and signing keys.

## Required Operator Evidence

1. **Real G46 gate proven.** This document cannot self-certify.
2. **Protected `release/1.0.0` branch** from the verified RC commit.
3. **Android and iOS artifacts built from the exact same commit.**
4. **Both artifacts signed** with production keys (not debug).
5. **Signature verification** on both artifacts (apksigner / codesign).
6. **Store binary smoke test** on real devices before upload.
7. **Formal Go/No-Go documented** with sign-off.
8. **Tag, reports, and artifacts archived** in a secure, non-repository location.

## Checklist

- [ ] G46 gate passed (no open P0/P1 defects)
- [ ] release/1.0.0 branch created from verified RC commit
- [ ] Source, content, simulation, save schema, dependencies all frozen
- [ ] Android AAB signed with production key
- [ ] iOS IPA signed with distribution certificate
- [ ] Both artifacts: signature verified
- [ ] Store smoke test: AAB installed from file, IPA installed from file
- [ ] Artifact hashes recorded and cryptographically signed
- [ ] Go/No-Go decision documented
- [ ] Tag v1.0.0 created and pushed
- [ ] Artifacts archived securely (off-repository, encrypted backup)
