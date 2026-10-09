# BetterNote 1.3.0.0 Store release review

Prepared on 2026-10-09T14:51:33.246Z. Source branch: sol-work; base commit: 71995e1045604eab336dc09ad4530206b0d9e216. The artifact includes the current working tree, including the offline guide and version notes; it has not been committed, pushed, installed over the user's app, or submitted to Microsoft.

## Upload artifact

- File: release/store-1.3.0.0-final/BetterNotePC-1.3.0.0-x64.appx
- Version / architecture: 1.3.0.0 / x64 (Intel/AMD Windows PC and Intel Surface). This is not an ARM64 build.
- Size: 211,879,901 bytes (202.1 MiB).
- SHA-256: 2f1d9bd23202be7eb81051ccad8d6aeb6a579c56d5d1f525fa4aff2da2081936
- Identity: JustStone.3453441DD0CC3
- Publisher: CN=01BEC724-2F5E-47FF-BC4E-71824A714A56
- Application ID: BetterNotePC
- Executable file/product version: 1.3.0.0.
- Appx was built without a signing certificate for Store submission; Microsoft signs approved Store packages. This file is not a signed sideloading installer.

## Release fixes

1. Aligned the checked-in AppxManifest.xml with 1.3.0.0. The generated package manifest was also verified.
2. Fixed a real icon packaging omission: BrowserWindow requested ../app-icon.ico, but the file was absent from the ASAR root. The original BetterNote ICO is now included at that path.
3. Assigned the stable com.betternote.studio taskbar group only to unpackaged Windows runs. Store runs keep the identity provided by Windows. No profile or database path was changed.
4. PDF print helper windows explicitly skip Taskbar and use the BetterNote icon. This only changes Windows presentation; the export content pipeline is unchanged.
5. Updated native restore regression tests for explicit device selection instead of retired automatic inbound sync. Updated the title test viewport for the current Surface overflow menu and the test-only CSS bundling helper. Added read-only exact-ASAR, guide, version and native window-icon checks.

## Review scope and evidence

All 128 JavaScript/JSX/CJS files under src and electron passed parsing. Source scans found no embedded private keys, eval/new Function, or production nodeIntegration:true/webSecurity:false. Reviewed the persistence/close-save, recovery, per-device backup writer/reader, export, native IPC/security, update and packaging boundaries. This is not a formal proof that all possible bugs are absent.

- Unit tests: 449 / 449 passed after the final icon changes.
- Current browser/native integration suites: 406 checks passed.
  - local-persistence: 162
  - backup-recovery: 16
  - backup-preparation: 11
  - restore-large: 3
  - bnote-roundtrip: 7
  - daily-update: 11
  - phase6-updates: 21
  - surface-library: 5
  - user-guide: 8
  - pdf-import: 30
  - navigation-input: 40
  - ink-input: 84
  - backup-migration-native: 6
  - daily-update-app: 2
- Exact ASAR extracted from final Appx: 8 check groups passed, using Electron 44.2.0 with an isolated profile and network requests blocked. Covers sandbox/contextIsolation/webSecurity, native workers, .bnote export/import, fonts, asset restrictions, WinRT helper availability, guide and version display.
- Actual live Windows WM_GETICON handles: 16x16 and 32x32 BetterNote icons; 0 mismatching opaque pixels against the matching source ICO frames. Executable icon, manifest logos and splash artwork visually inspected as BetterNote.
- Offline guide: all 44 PNGs present and readable under production CSP; 10 categories, 55 lessons.
- Native cold 91-page PDF export: passed without a prior one-page export; 15.672 seconds in this synthetic desktop run. Page count, first/middle/last text, Thai text, mixed orientation, ink colors and temporary-file cleanup verified. This timing is not a Surface/cloud download speed promise.
- Restore: 11-notebook set including a 91-page notebook passed. Read/plan cancellation kept all original local work. Native two-device 24-page restore preserved data hashes across restart.
- PDF preparation reuse: changing one page in a 91-page fixture rendered 1 page and reused 90; another unchanged pass reused all 91.
- npm audit --omit=dev: 0 reported production dependency vulnerabilities at audit time.
- MakeAppx packing/unpacking: succeeded. All 8659 SHA-256 block-map digests across 83 payload files match; extracted ASAR equals the packager's ASAR.
- ASAR allowlist inspection: no .env, .bnote, BetterNote_Latest_Backup.json, client_secret files, test fixtures, scratch folders or compile-cache folders. All 28 packaged Electron modules/scripts exactly match source.

## Legacy test limitations and remaining checks

The old backup-discovery, backup-sync and backup-migration browser scripts assert the retired automatic inbound/shared-root sync model. They are not release gates for the current manual per-device Restore model. The old backup-status browser script still uses the removed BetterNote_Latest_Backup.json alias/shared-root paths and is not counted as passing. It initially failed at that obsolete file-path assertion; app behavior was not changed to satisfy obsolete expectations. Current behavior is covered by backup-recovery, restore-large, surface-library, backup-preparation, native migration and the unit suites. These old harnesses should be migrated separately.

A remaining non-release-gating performance concern in existing code is the clipboard image-file fallback's synchronous exists/read calls in electron/main.cjs. Large or online-only files could stall that optional paste path. It was not broadened into an unrelated clipboard refactor for this icon/release task.

Windows App Certification Kit is not installed here, so a WACK report is not available. The package was not installed over a real Store build; Store-installed identity, live Store-update discovery and upgrade-from-previous-version need Microsoft/Partner Center validation or a signed Store test deployment. No live Google Drive upload or real Surface hardware test was repeated in this release audit; offline/synthetic slow-read and input regressions were used.

## Partner Center handoff

Upload only the final .appx above to the existing BetterNote product, verify its Identity/Publisher against Product identity, inspect package validation and device-family coverage, paste the supplied Thai/English release notes, review the existing privacy/listing and runFullTrust details, and submit after Microsoft accepts the package checks. Do not upload the earlier release/store-1.3.0.0 artifact; it predates the window-icon fix.

Microsoft requirements: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements
Store signing: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/publish-first-app

Raw QA evidence is in scratch/release-1.3.0.0; release-validation.json records source/artifact hashes.
