# logv — CLI for Vercel & Netlify deployment logs

Fast CLI tool to view deployment logs from Vercel and Netlify. Filter by type (error/warning), export to JSON/CSV, and tail in real-time (Pro).

## Why logv?
- **Fast:** Direct API calls, no heavy dashboard UI
- **Clear:** Focused filtering, readable output
- **Private:** Runs locally, no data stored on our servers
- **Cross-platform:** macOS, Linux, Windows (Node.js)

## Install

```bash
npm install -g logv
```

## Setup

```bash
export VERCEL_TOKEN=your_vercel_token
export NETLIFY_TOKEN=your_netlify_token
```

## Usage

### List deployments
```bash
logv vercel --list
```

### Vercel
```bash
# View logs for a deployment
logv vercel -d dpl_xxxxx

# Filter errors only
logv vercel -d dpl_xxxxx --filter error

# Limit output
logv vercel -d dpl_xxxxx -n 20
```

### Netlify
```bash
# View deployment logs
logv netlify -d abc123

# Filter warnings
logv netlify -d abc123 --filter warning

# Real-time tail (Pro)
logv netlify -d abc123 --tail
```

## Export (Pro)

```bash
logv vercel -d dpl_xxxxx --export out.json
logv netlify -d abc123 --export out.csv
```

## Pricing

- **Free:** Basic logs, filtering
- **Pro ($7/mo):** Real-time tail, unlimited export, team access

## Support

Issues & feature requests: [github.com/arikmozh/logv/issues](https://github.com/arikmozh/logv/issues)

## License

MIT
