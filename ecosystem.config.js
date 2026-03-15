module.exports = {
  apps: [{
    name: 'servicall',
    script: 'dist/server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }],

  deploy: {
    production: {
      user: 'node',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'https://github.com/jdidima731-hash/servicall_v2.git',
      path: '/var/www/servicall',
      'post-deploy': 'pnpm install && pnpm run build && pnpm run db:migrate && pm2 reload ecosystem.config.js --env production'
    }
  }
};
