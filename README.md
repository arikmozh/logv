# logv

> Fast CLI to view deployment logs from **Vercel** and **Netlify** — right in your terminal.

No dashboards. No browser tabs. Just logs.

```
$ logv vercel --list

Recent Deployments:

  dpl_8xKz2mP  READY  my-app  3/8/2026, 10:15:00 AM
  dpl_3nRt7qW  READY  my-app  3/7/2026, 4:30:00 PM
  dpl_1bYx9vL  ERROR  my-app  3/7/2026, 2:10:00 PM

Use: logv vercel -d <deployment-id> to view logs
```

## Install

```bash
npm install -g deploy-logv
```

## Setup

Set your API tokens as environment variables:

```bash
# Vercel — get your token at https://vercel.com/account/tokens
export VERCEL_TOKEN=your_vercel_token

# Netlify — get your token at https://app.netlify.com/user/applications#personal-access-tokens
export NETLIFY_TOKEN=your_netlify_token
```

> **Tip:** Add these to your `~/.zshrc` or `~/.bashrc` to persist across sessions.

## Usage

### Vercel

```bash
# List recent deployments
logv vercel --list

# List deployments for a specific project
logv vercel --list -p <project-name>

# View logs for a deployment
logv vercel -d dpl_xxxxx

# Filter errors only
logv vercel -d dpl_xxxxx --filter error

# Filter warnings only
logv vercel -d dpl_xxxxx --filter warning

# Limit output to N lines
logv vercel -d dpl_xxxxx -n 20
```

### Netlify

```bash
# List recent deploys
logv netlify --list

# List deploys for a specific site
logv netlify --list -s <site-id>

# View deployment logs
logv netlify -d <deploy-id>

# Filter errors
logv netlify -d <deploy-id> --filter error

# Filter warnings
logv netlify -d <deploy-id> --filter warning

# Limit output
logv netlify -d <deploy-id> -n 50
```

### Real-time tailing (Pro)

Watch logs as they come in:

```bash
logv vercel -d dpl_xxxxx --tail
logv netlify -d <deploy-id> --tail
```

### Export (Pro)

Export logs to JSON or CSV:

```bash
logv vercel -d dpl_xxxxx --export logs.json
logv vercel -d dpl_xxxxx --export logs.csv
logv netlify -d <deploy-id> --export logs.json
```

## Options Reference

| Flag | Short | Description |
|------|-------|-------------|
| `--list` | `-l` | List recent deployments |
| `--deployment <id>` | `-d` | Specify deployment/deploy ID |
| `--project <name>` | `-p` | Filter by project (Vercel) |
| `--site <id>` | `-s` | Filter by site (Netlify) |
| `--filter <type>` | `-f` | Filter: `error`, `warning`, `all` |
| `--num <n>` | `-n` | Number of log lines (default: 100) |
| `--tail` | `-t` | Real-time log tailing (Pro) |
| `--export <file>` | `-e` | Export to `.json` or `.csv` (Pro) |

## Pricing

| | Free | Pro ($7/mo) |
|---|---|---|
| View deployment logs | Yes | Yes |
| Filter by error/warning | Yes | Yes |
| Limit output | Yes | Yes |
| Real-time tail | - | Yes |
| Export to JSON/CSV | - | Yes |
| Team access | - | Yes |

## Why logv?

- **Fast** — Direct API calls, no heavy dashboard UI
- **Clear** — Focused filtering, readable color-coded output
- **Private** — Runs locally, no data stored on external servers
- **Cross-platform** — macOS, Linux, Windows (Node.js 16+)

## Support

Issues & feature requests: [github.com/arikmozh/logv/issues](https://github.com/arikmozh/logv/issues)

## License

MIT
