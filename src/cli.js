#!/usr/bin/env node
const { Command } = require('commander');
const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');

const program = new Command();
const RC_PATH = path.join(os.homedir(), '.logvrc');
const INSTANCE_NAME = os.hostname();

program
  .name('logv')
  .description('CLI for Vercel/Netlify deployment logs')
  .version('0.3.0');

// ── License helpers ──

function readRC() {
  try {
    return JSON.parse(fs.readFileSync(RC_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeRC(data) {
  fs.writeFileSync(RC_PATH, JSON.stringify(data, null, 2));
}

function deleteRC() {
  try { fs.unlinkSync(RC_PATH); } catch {}
}

async function isProUser() {
  const rc = readRC();
  if (!rc || !rc.license_key || rc.status !== 'active') return false;

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (now - (rc.last_validated || 0) < ONE_DAY) return true;

  try {
    const res = await axios.post('https://api.lemonsqueezy.com/v1/licenses/validate', {
      license_key: rc.license_key,
      instance_name: INSTANCE_NAME,
    });
    const valid = res.data?.valid;
    writeRC({ ...rc, status: valid ? 'active' : 'expired', last_validated: now });
    return valid;
  } catch {
    return true; // offline grace — trust cache
  }
}

function showProGate() {
  console.log(chalk.yellow('\n  ⚡ This is a Pro feature.'));
  console.log(chalk.dim('  Upgrade at https://arikmozh.github.io/logv/#pricing'));
  console.log(chalk.dim('  Then run: logv activate <your-license-key>\n'));
  process.exit(0);
}

function exportLogs(logs, filepath) {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === '.json') {
    fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));
  } else if (ext === '.csv') {
    const header = 'time,type,message';
    const rows = logs.map(l => {
      const time = new Date(l.date).toISOString();
      const msg = `"${(l.text || '').replace(/"/g, '""')}"`;
      return `${time},${l.type},${msg}`;
    });
    fs.writeFileSync(filepath, [header, ...rows].join('\n'));
  } else {
    console.error('Unsupported format. Use .json or .csv');
    process.exit(1);
  }
  console.log(chalk.green(`Exported ${logs.length} logs to ${filepath}`));
}

// ── License commands ──

program
  .command('activate <key>')
  .description('Activate a Pro license key')
  .action(async (key) => {
    console.log(chalk.dim('Activating license...'));
    try {
      const res = await axios.post('https://api.lemonsqueezy.com/v1/licenses/activate', {
        license_key: key,
        instance_name: INSTANCE_NAME,
      });
      if (res.data?.activated) {
        writeRC({
          license_key: key,
          instance_id: res.data.instance.id,
          activated_at: Date.now(),
          last_validated: Date.now(),
          status: 'active',
        });
        console.log(chalk.green('\n  ✓ License activated! Pro features are now enabled.\n'));
      } else {
        console.error(chalk.red('Activation failed:'), res.data?.error || 'Invalid key');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      console.error(chalk.red('Activation failed:'), msg);
    }
  });

program
  .command('deactivate')
  .description('Deactivate your Pro license on this machine')
  .action(async () => {
    const rc = readRC();
    if (!rc || !rc.license_key) {
      console.log(chalk.yellow('No active license found.'));
      return;
    }
    try {
      await axios.post('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
        license_key: rc.license_key,
        instance_id: rc.instance_id,
      });
      deleteRC();
      console.log(chalk.green('License deactivated. Pro features disabled.'));
    } catch {
      deleteRC();
      console.log(chalk.yellow('Local license removed.'));
    }
  });

program
  .command('status')
  .description('Show current license status')
  .action(async () => {
    const rc = readRC();
    if (!rc || !rc.license_key) {
      console.log(chalk.bold('\n  Plan: ') + 'Free');
      console.log(chalk.dim('  Activate: logv activate <key>'));
      console.log(chalk.dim('  Get Pro:  https://arikmozh.github.io/logv/#pricing\n'));
      return;
    }
    const masked = rc.license_key.slice(0, 8) + '...' + rc.license_key.slice(-4);
    console.log(chalk.bold('\n  Plan:     ') + chalk.green('Pro'));
    console.log(chalk.bold('  Key:      ') + masked);
    console.log(chalk.bold('  Status:   ') + (rc.status === 'active' ? chalk.green('Active') : chalk.red(rc.status)));
    console.log(chalk.bold('  Activated:') + ' ' + new Date(rc.activated_at).toLocaleDateString());
    if (rc.last_validated) {
      console.log(chalk.bold('  Verified: ') + new Date(rc.last_validated).toLocaleDateString());
    }
    console.log();
  });

// ── Vercel ──

program
  .command('vercel')
  .description('Fetch Vercel logs')
  .option('-p, --project <name>', 'Project name')
  .option('-d, --deployment <id>', 'Deployment ID')
  .option('-l, --list', 'List recent deployments')
  .option('-n, --num <n>', 'Number of logs', '100')
  .option('-f, --filter <type>', 'Filter: error, warning, all', 'all')
  .option('-t, --tail', 'Real-time log tailing (Pro)')
  .option('-e, --export <file>', 'Export logs to JSON/CSV (Pro)')
  .action(async ({ project, deployment, list, num, filter, tail, export: exportFile }) => {
    if (!process.env.VERCEL_TOKEN) {
      console.error('Set VERCEL_TOKEN environment variable');
      console.log('Usage: export VERCEL_TOKEN=your_token');
      process.exit(1);
    }

    const headers = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };

    try {
      // List deployments
      if (list || (!deployment && !project)) {
        const url = project
          ? `https://api.vercel.com/v6/deployments?projectId=${project}&limit=10`
          : `https://api.vercel.com/v6/deployments?limit=10`;
        const res = await axios.get(url, { headers });
        const deps = res.data?.deployments || [];
        if (!deps.length) { console.log('No deployments found.'); return; }
        console.log(chalk.bold('\nRecent Deployments:\n'));
        deps.forEach(d => {
          const state = d.state === 'ERROR' ? chalk.red(d.state) :
                       d.state === 'READY' ? chalk.green(d.state) : chalk.yellow(d.state);
          const date = new Date(d.created).toLocaleString();
          console.log(`  ${chalk.cyan(d.uid)} ${state} ${chalk.dim(d.name)} ${chalk.dim(date)}`);
        });
        console.log(chalk.dim('\nUse: logv vercel -d <deployment-id> to view logs\n'));
        return;
      }

      // Fetch deployment logs
      const res = await axios.get(
        `https://api.vercel.com/v2/deployments/${deployment}/events`,
        { headers }
      );

      const events = Array.isArray(res.data) ? res.data : [];

      let logs = events.map(e => ({
        type: e.type,
        text: e.payload?.text || '',
        date: e.created,
      }));

      if (filter === 'error') {
        logs = logs.filter(l => l.type === 'stderr');
      } else if (filter === 'warning') {
        logs = logs.filter(l => l.text.toLowerCase().includes('warn'));
      }

      // Pro feature gate
      if ((tail || exportFile) && !(await isProUser())) {
        showProGate();
      }

      // Export mode
      if (exportFile) {
        exportLogs(logs, exportFile);
        return;
      }

      // Tail mode — poll for new logs every 3s
      if (tail) {
        let seen = new Set(logs.map(l => `${l.date}-${l.text}`));
        logs.slice(0, parseInt(num)).forEach(log => {
          const time = chalk.dim(new Date(log.date).toLocaleTimeString());
          const prefix = log.type === 'stderr' ? chalk.red('ERR') : chalk.gray('OUT');
          console.log(`${time} ${prefix} ${log.text}`);
        });
        console.log(chalk.cyan('\n  Tailing logs... (Ctrl+C to stop)\n'));
        const poll = async () => {
          try {
            const r = await axios.get(
              `https://api.vercel.com/v2/deployments/${deployment}/events`,
              { headers }
            );
            const fresh = (Array.isArray(r.data) ? r.data : []).map(e => ({
              type: e.type,
              text: e.payload?.text || '',
              date: e.created,
            }));
            let filtered = fresh;
            if (filter === 'error') filtered = fresh.filter(l => l.type === 'stderr');
            else if (filter === 'warning') filtered = fresh.filter(l => l.text.toLowerCase().includes('warn'));
            filtered.forEach(log => {
              const key = `${log.date}-${log.text}`;
              if (!seen.has(key)) {
                seen.add(key);
                const time = chalk.dim(new Date(log.date).toLocaleTimeString());
                const prefix = log.type === 'stderr' ? chalk.red('ERR') : chalk.gray('OUT');
                console.log(`${time} ${prefix} ${log.text}`);
              }
            });
          } catch (_) {}
        };
        setInterval(poll, 3000);
        return;
      }

      // Normal output
      logs.slice(0, parseInt(num)).forEach(log => {
        const time = chalk.dim(new Date(log.date).toLocaleTimeString());
        const prefix = log.type === 'stderr' ? chalk.red('ERR') : chalk.gray('OUT');
        console.log(`${time} ${prefix} ${log.text}`);
      });

      if (!logs.length) console.log(chalk.yellow('No logs found for this filter.'));
    } catch (err) {
      console.error('Error:', err.response?.data?.error?.message || err.message);
    }
  });

// ── Netlify ──

program
  .command('netlify')
  .description('Fetch Netlify deployment logs')
  .option('-s, --site <id>', 'Site ID or name')
  .option('-d, --deployment <id>', 'Deploy ID')
  .option('-l, --list', 'List recent deploys')
  .option('-n, --num <n>', 'Number of logs', '100')
  .option('-f, --filter <type>', 'Filter: error, warning, all', 'all')
  .option('-t, --tail', 'Real-time log tailing (Pro)')
  .option('-e, --export <file>', 'Export logs to JSON/CSV (Pro)')
  .action(async ({ site, deployment, list, num, filter, tail, export: exportFile }) => {
    if (!process.env.NETLIFY_TOKEN) {
      console.error('Set NETLIFY_TOKEN environment variable');
      console.log('Usage: export NETLIFY_TOKEN=your_token');
      process.exit(1);
    }

    const headers = { Authorization: `Bearer ${process.env.NETLIFY_TOKEN}` };

    try {
      // List recent deploys
      if (list || (!deployment && !site)) {
        const url = site
          ? `https://api.netlify.com/api/v1/sites/${site}/deploys?per_page=10`
          : `https://api.netlify.com/api/v1/deploys?per_page=10`;
        const res = await axios.get(url, { headers });
        const deps = Array.isArray(res.data) ? res.data : [];
        if (!deps.length) { console.log('No deploys found.'); return; }
        console.log(chalk.bold('\nRecent Deploys:\n'));
        deps.forEach(d => {
          const state = d.state === 'error' ? chalk.red(d.state) :
                       d.state === 'ready' ? chalk.green(d.state) : chalk.yellow(d.state);
          const date = new Date(d.created_at).toLocaleString();
          console.log(`  ${chalk.cyan(d.id)} ${state} ${chalk.dim(d.name || d.site_id)} ${chalk.dim(date)}`);
        });
        console.log(chalk.dim('\nUse: logv netlify -d <deploy-id> to view logs\n'));
        return;
      }

      // Fetch deploy log
      const res = await axios.get(
        `https://api.netlify.com/api/v1/deploys/${deployment}/log`,
        { headers }
      );

      const events = Array.isArray(res.data) ? res.data : [];

      let logs = events.map(e => ({
        type: e.level || 'info',
        text: e.message || '',
        date: e.ts,
      }));

      if (filter === 'error') {
        logs = logs.filter(l => l.type === 'error');
      } else if (filter === 'warning') {
        logs = logs.filter(l => l.type === 'warning' || l.text.toLowerCase().includes('warn'));
      }

      // Pro feature gate
      if ((tail || exportFile) && !(await isProUser())) {
        showProGate();
      }

      // Export mode
      if (exportFile) {
        exportLogs(logs, exportFile);
        return;
      }

      // Tail mode
      if (tail) {
        let seen = new Set(logs.map(l => `${l.date}-${l.text}`));
        logs.slice(0, parseInt(num)).forEach(log => {
          const time = chalk.dim(new Date(log.date).toLocaleTimeString());
          const prefix = log.type === 'error' ? chalk.red('ERR') :
                        log.type === 'warning' ? chalk.yellow('WRN') : chalk.gray('OUT');
          console.log(`${time} ${prefix} ${log.text}`);
        });
        console.log(chalk.cyan('\n  Tailing logs... (Ctrl+C to stop)\n'));
        const poll = async () => {
          try {
            const r = await axios.get(
              `https://api.netlify.com/api/v1/deploys/${deployment}/log`,
              { headers }
            );
            const fresh = (Array.isArray(r.data) ? r.data : []).map(e => ({
              type: e.level || 'info',
              text: e.message || '',
              date: e.ts,
            }));
            let filtered = fresh;
            if (filter === 'error') filtered = fresh.filter(l => l.type === 'error');
            else if (filter === 'warning') filtered = fresh.filter(l => l.type === 'warning' || l.text.toLowerCase().includes('warn'));
            filtered.forEach(log => {
              const key = `${log.date}-${log.text}`;
              if (!seen.has(key)) {
                seen.add(key);
                const time = chalk.dim(new Date(log.date).toLocaleTimeString());
                const prefix = log.type === 'error' ? chalk.red('ERR') :
                              log.type === 'warning' ? chalk.yellow('WRN') : chalk.gray('OUT');
                console.log(`${time} ${prefix} ${log.text}`);
              }
            });
          } catch (_) {}
        };
        setInterval(poll, 3000);
        return;
      }

      // Normal output
      logs.slice(0, parseInt(num)).forEach(log => {
        const time = chalk.dim(new Date(log.date).toLocaleTimeString());
        const prefix = log.type === 'error' ? chalk.red('ERR') :
                      log.type === 'warning' ? chalk.yellow('WRN') : chalk.gray('OUT');
        console.log(`${time} ${prefix} ${log.text}`);
      });

      if (!logs.length) console.log(chalk.yellow('No logs found for this filter.'));
    } catch (err) {
      console.error('Error:', err.response?.data?.message || err.message);
    }
  });

program.parse(process.argv);
