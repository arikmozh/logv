#!/usr/bin/env node
const { Command } = require('commander');
const axios = require('axios');
const chalk = require('chalk');

const program = new Command();

program
  .name('logv')
  .description('CLI for Vercel/Netlify deployment logs')
  .version('0.1.0');

program
  .command('vercel')
  .description('Fetch Vercel logs')
  .option('-p, --project <name>', 'Project name')
  .option('-d, --deployment <id>', 'Deployment ID')
  .option('-l, --list', 'List recent deployments')
  .option('-n, --num <n>', 'Number of logs', '100')
  .option('-f, --filter <type>', 'Filter: error, warning, all', 'all')
  .action(async ({ project, deployment, list, num, filter }) => {
    if (!process.env.VERCEL_TOKEN) {
      console.error('❌ Set VERCEL_TOKEN environment variable');
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

      logs.slice(0, parseInt(num)).forEach(log => {
        const time = chalk.dim(new Date(log.date).toLocaleTimeString());
        const prefix = log.type === 'stderr' ? chalk.red('ERR') : chalk.gray('OUT');
        console.log(`${time} ${prefix} ${log.text}`);
      });

      if (!logs.length) console.log(chalk.yellow('No logs found for this filter.'));
    } catch (err) {
      console.error('❌ Error:', err.response?.data?.error?.message || err.message);
    }
  });

program
  .command('netlify')
  .description('Fetch Netlify deployment logs')
  .option('-s, --site <id>', 'Site ID or name')
  .option('-d, --deployment <id>', 'Deploy ID')
  .option('-l, --list', 'List recent deploys')
  .option('-n, --num <n>', 'Number of logs', '100')
  .option('-f, --filter <type>', 'Filter: error, warning, all', 'all')
  .action(async ({ site, deployment, list, num, filter }) => {
    if (!process.env.NETLIFY_TOKEN) {
      console.error('❌ Set NETLIFY_TOKEN environment variable');
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

      logs.slice(0, parseInt(num)).forEach(log => {
        const time = chalk.dim(new Date(log.date).toLocaleTimeString());
        const prefix = log.type === 'error' ? chalk.red('ERR') :
                      log.type === 'warning' ? chalk.yellow('WRN') : chalk.gray('OUT');
        console.log(`${time} ${prefix} ${log.text}`);
      });

      if (!logs.length) console.log(chalk.yellow('No logs found for this filter.'));
    } catch (err) {
      console.error('❌ Error:', err.response?.data?.message || err.message);
    }
  });

program.parse(process.argv);
