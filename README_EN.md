# RustDesk API (Self-Hosted Single User)

[中文文档](README.md)

A lightweight RustDesk API server tailored exclusively for **personal, self-hosted, single-user deployments**. All multi-tenant grouping, complex sharing permissions, and database audit overhead have been completely pruned in favor of a secure, lean architecture authenticated solely via **GitHub OAuth2**, paired with a modern **React + Tailwind CSS + Shadcn/ui** admin dashboard.

---

## Key Features

- **Personal Single-User Architecture (Self-Hosted)**
  - Stripped of multi-tenancy, user groups, device groups, public sharing links, and audit logs.
  - Reduced database tables from 17 down to 9 core tables, delivering a lean and secure footprint.
- **Strict & Secure Authentication (GitHub OAuth2 Only)**
  - All login mechanisms converged strictly to GitHub OAuth2.
  - Configure allowed GitHub usernames directly via environment variables (e.g., `ALLOWED_USERS`).
  - Whitelisted users automatically elevated to sole system Owner/Admin on login.
- **Brand-New Web Admin Console (Shadcn/ui)**
  - Completely rewritten with **React 19 + TypeScript + Tailwind CSS v4 + Shadcn/ui** accessible primitives.
  - Native **Dark Mode** and Light Mode support with persistent state.
  - **Dashboard**: RustDesk server parameters display, one-click copy, client config string generator, and active device summary.
  - **Peers**: Live online pulse indicators, OS badges, alias editing, hardware telemetry modal, one-click address book import, and batch deletion.
  - **Address Book**: Full bidirectional sync, password visibility toggle, one-click credentials copy, colored tags, and full CRUD.
  - **Tags**: Curated color presets, real-time preview, and instant tag maintenance.
- **100% Client Protocol Compatibility**
  - Fully compatible with official RustDesk desktop, mobile, and web clients.
  - Connection and file audit endpoints respond with silent `200 Success` (no-op), incurring zero database writes while keeping client handshakes intact.

---

## Quick Start

### 1. Register GitHub OAuth App

1. Go to GitHub Settings -> Developer settings -> [OAuth Apps](https://github.com/settings/developers) -> **New OAuth App**.
2. Fill in your server details:
   - **Homepage URL**: `https://your-domain.com` (or `http://your-ip:21114`)
   - **Authorization callback URL**: `https://your-domain.com/api/oidc/callback`
3. Generate and note down the **Client ID** and **Client Secret**.

---

### 2. Deploy with Docker Compose

Create a `docker-compose.yaml`:

```yaml
services:
  rustdesk-api:
    image: ghcr.io/devcxl/rustdesk-api:latest
    container_name: rustdesk-api
    restart: unless-stopped
    ports:
      - "21114:21114"
    volumes:
      - ./data:/app/data
    environment:
      # Required: GitHub OAuth Credentials
      - RUSTDESK_API_GITHUB_OAUTH_CLIENT_ID=your_github_client_id
      - RUSTDESK_API_GITHUB_OAUTH_CLIENT_SECRET=your_github_client_secret
      
      # Required: Allowed GitHub username whitelist (comma-separated for multiple)
      - ALLOWED_USERS=your-github-username
      
      # Optional: RustDesk Relay Server Parameters
      - RUSTDESK_API_RUSTDESK_ID_SERVER=1.2.3.4:21116
      - RUSTDESK_API_RUSTDESK_RELAY_SERVER=1.2.3.4:21117
      - RUSTDESK_API_RUSTDESK_KEY=your_public_key
      - RUSTDESK_API_RUSTDESK_API_SERVER=http://1.2.3.4:21114
```

Run:
```bash
docker compose up -d
```

Navigate to `http://your-ip:21114/_admin` in your browser, click "Login with GitHub", and access your personal control panel.

---

## Common Environment Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `ALLOWED_USERS` | Allowed GitHub username whitelist (Recommended) | `my-github-account` |
| `RUSTDESK_API_GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App Client ID | `Ov23li...` |
| `RUSTDESK_API_GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret | `6789abcd...` |
| `RUSTDESK_API_RUSTDESK_ID_SERVER` | RustDesk ID Server host & port | `rustdesk.example.com:21116` |
| `RUSTDESK_API_RUSTDESK_RELAY_SERVER` | RustDesk Relay Server host & port | `rustdesk.example.com:21117` |
| `RUSTDESK_API_RUSTDESK_KEY` | Public Key content (Either this or KEY_FILE) | `rU5tD3sK...=` |
| `RUSTDESK_API_RUSTDESK_KEY_FILE` | Public key file path (supports short alias `KEY_FILE` and auto-probe) | `/app/data/id_ed25519.pub` |
| `RUSTDESK_API_RUSTDESK_API_SERVER` | API Server Host (Default: current host) | `https://api.example.com` |

---

## Local Development & Build

### Prerequisites
- Go 1.23+
- Node.js 22+ & pnpm 11+

### Build & Run
```bash
# 1. Build frontend dashboard
cd admin
pnpm install
pnpm build
cd ..

# 2. Build and run backend
go run cmd/apimain.go
```

Or run the all-in-one build script:
```bash
./build.sh
```

---

## License

[Apache-2.0 License](LICENSE)
