/**
 * PM2: one Next.js process per CPU core, on ports 3000, 3001, …  (match them in deploy/nginx.conf → upstream nea_app)
 *   pm2 start deploy/ecosystem.config.cjs && pm2 save
 * Environment comes from the server (or .env.local, which Next.js reads on start).
 */
const os = require("node:os");

const cores = Math.max(1, Number(process.env.NEA_PROCESSES || os.cpus().length));

module.exports = {
  apps: Array.from({ length: cores }, (_, i) => ({
    name: `nea-${i}`,
    cwd: __dirname + "/..",
    script: "node_modules/next/dist/bin/next",
    // listen on 127.0.0.1 only: visitors can reach the app only through Nginx, so X-Real-IP can be trusted
    args: `start -H 127.0.0.1 -p ${3000 + i}`,
    env: { NODE_ENV: "production" },
    max_memory_restart: "900M",
    kill_timeout: 10000,
    time: true,
  })),
};
