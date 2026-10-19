# RustDesk API (Self-Hosted Single User)

An API server that implements the RustDesk client and web admin API tailored exclusively for **personal, self-hosted, single-user deployment**. All multi-tenant grouping, shared collections, commands, and audit logs have been pruned in favor of a lean, secure architecture bound strictly to a single GitHub Owner.

## Language

### Accounts & Ownership

**Owner / Admin**:
The sole administrator and resource owner of this server, authenticated via GitHub OAuth2. An account whitelisted via environment variables (`ALLOWED_USERS`, `GITHUB_ALLOWED_USERS`, `RUSTDESK_ALLOWED_USERS`, or `RUSTDESK_API_GITHUB_OAUTH_USERS`) is automatically elevated to `is_admin = true` on login.
_Avoid_: Multi-tenant, operator, customer, member

**Status**:
The Owner user's enabled or disabled state.
_Avoid_: Active flag

**User Token**:
A long-lived authentication token issued to the Owner for client devices and web admin sessions, with automatic refresh on active usage.
_Avoid_: API key, session ticket

### Devices

**Peer**:
A client device running RustDesk, identified by its RustDesk ID. All incoming heartbeats and sysinfo automatically associate with the system Owner.
_Avoid_: Host, machine, slave

**Alias**:
A user-chosen display name or note for a Peer, distinct from the hostname reported by the OS.
_Avoid_: Nickname, label

**Sysinfo**:
The hardware/OS telemetry reported by a Peer upon connection (hostname, OS, CPU, memory, version).
_Avoid_: Inventory, device telemetry

**Heartbeat**:
A Peer's periodic liveness ping (`/api/heartbeat`) refreshing its online timestamp and last known IP.
_Avoid_: Keepalive, ping

### Address Book & Categorization

**Address Book**:
The Owner's personal list of remote devices, alias, connection passwords, and assigned tags, synchronized bidirectionally across RustDesk desktop and mobile clients.
_Avoid_: Contacts, favourites

**Tag**:
A coloured label attached to Address Book entries and Peers, represented by an ARGB numeric color value with curated palette presets.
_Avoid_: Category, folder, device group

### Authentication & Integration

**GitHub OAuth2**:
The sole external identity provider for this deployment. Supports auto-OIDC redirection and strict whitelist verification against configured environment variables.
_Avoid_: LDAP, Google SSO, OIDC generic, LinuxDo

**RustAuth**:
Authentication of RustDesk desktop/mobile clients against this API via the `Authorization` header.
_Avoid_: Basic auth, peer handshake

**Silent Audit (No-op)**:
Client connection and file audit endpoints (`/api/audit/conn`, `/api/audit/file`) respond with `200 Success` without persisting logs, guaranteeing client compatibility with zero database overhead.
_Avoid_: Audit logging, session archiving
