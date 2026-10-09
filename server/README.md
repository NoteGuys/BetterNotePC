# BetterNote Google account service

This service exchanges the one-time Google authorization code for an access token.
It does not read, store, upload, restore or delete notebook files.
Google account selection stays in the user's system browser.

## Current release status

The implementation and local tests are ready for review. It is not deployed.
The packaged app intentionally has no working public endpoint until the owner deploys and verifies one.
Do not distribute the current build claiming direct Google connection works for all users.

The current Google OAuth client is a Desktop app and uses a random loopback callback with PKCE.
The app sends the code, verifier, loopback URI and public Client ID over HTTPS to this service.
Only this service reads the app registration secret and calls Google's fixed token endpoint.
The returned access token stays in app memory. The service returns no app secret or refresh token.

## Owner setup on a host

Use a supported Node.js runtime with no additional npm dependencies.
Deploy server/googleOAuthBroker.cjs together with electron/googleTokenExchange.cjs,
keeping the same relative directories. The application package excludes server/.

Configure these values through the hosting provider's environment/secret manager:
- GOOGLE_OAUTH_CLIENT_ID: the public Desktop Client ID used by BetterNote.
- GOOGLE_OAUTH_CREDENTIALS_FILE: the absolute path of the mounted credentials JSON secret.
- BETTERNOTE_GOOGLE_PUBLIC_ORIGIN: the HTTPS origin, for example https://accounts.example.invalid.
- PORT: the HTTP port provided by the host, default 8080.
- BETTERNOTE_GOOGLE_BIND_HOST: set to the interface required by the host; default 127.0.0.1.

Run: node server/googleOAuthBroker.cjs

Use a managed HTTPS ingress or reverse proxy. The Node listener itself is HTTP behind that ingress;
it must not be exposed as a plain HTTP token service.
The desktop client rejects non-HTTPS endpoints and redirects.
Do not disable TLS verification to make a test succeed.

The public endpoint is HTTPS_ORIGIN/v1/google/token.
Put that public URL in electron/googleOAuthConfig.cjs for a release.
The public URL contains no credentials and may be committed.
Never add the credentials JSON or secret value to the repo, app assets, installer or container image.

For the owner's unpackaged development instance only,
BETTERNOTE_GOOGLE_OAUTH_FILE may point at the owner's original credentials JSON.
The packaged app ignores that development file path and uses the public endpoint.
End users are never asked for an OAuth Client ID, Client secret or credentials JSON.

## Protections and deployment limits

- Fixed Google token URL; callers cannot select an upstream URL or change app identity.
- Accept only an authorization-code grant with a loopback callback and a strong PKCE verifier.
- Refuse unknown fields, other Client IDs, remote callbacks and malformed or oversized JSON.
- Per-process concurrent exchanges capped at 8; request body at 8 KiB; Google timeout 15 seconds.
- Per-process client and global request limits. Caller-supplied forwarding headers are ignored.
- No request body, authorization code, verifier, token, registration secret or provider error logging.
- Responses use no-store and return only the access token, lifetime, token type and approved scopes.
- Refuse token responses that do not include the requested Drive file permission.

Configure host-level limits as well. These in-memory limits are per process, not a distributed rate limiter.
When ingress proxies requests, remoteAddress may identify the shared proxy; configure appropriate
ingress limits and review the per-process rate limits before opening a multi-instance production service.
Configure host request/body/time limits and secret access permissions. Run a live HTTPS smoke test
before publishing a build. The service has not undergone a production security audit.

## Google app publication

Keep the user type External and the actual requested scopes:
openid, https://www.googleapis.com/auth/userinfo.email,
https://www.googleapis.com/auth/drive.file.

Testing permits only the listed test accounts; it is not public availability.
After reviewing the working release, the owner must set Audience > Publish app > In production.
Complete applicable Google branding verification, homepage/domain/privacy-policy requirements.
Google Workspace administrators and account security policies can still restrict third-party access.
Publishing the OAuth app does not deploy this account service or implement cloud notebook uploads.

## What remains outside this connection change

There is no direct cloud upload ledger, refresh-token persistence or cloud restore in this change.
The existing Local and Drive Desktop backup paths are unchanged.
A connected account must not be presented as a confirmed notebook upload.
