// 数据库连接模块
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️  未设置 DATABASE_URL，数据库相关功能不可用（服务本身仍会启动）');
}

// 本地 Postgres（localhost）一般不需要 SSL，Railway 的 Postgres 需要
const isLocal = connectionString && connectionString.includes('localhost');

const pool = new Pool({
  connectionString,
  ssl: connectionString && !isLocal ? { rejectUnauthorized: false } : false,
});

// 启动时自动建表（表已存在则跳过）
async function initTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weather_reads (
      id SERIAL PRIMARY KEY,
      payload JSONB NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('🗄️  数据表已就绪 (weather_reads)');
}

module.exports = { pool, initTable };
