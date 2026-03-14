module.exports = {
  apps: [
    {
      name: 'Servicall-App',
      script: './dist/index.js',
      node_args: '--max-old-space-size=4096',
      env: {
        NODE_ENV: 'production',
      },
      cwd: __dirname,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      max_restarts: 5,
      min_uptime: '30s',
    },
  ],
};
