// 应用入口：Express 服务 + 每小时定时任务
require('dotenv').config();

const express = require('express');
const cron = require('node-cron');
const { pool, initTable } = require('./db');
const { fetchAndStore } = require('./fetcher');

const app = express();
const PORT = process.env.PORT || 3000; // Railway 会自动注入 PORT，必须使用它

// ---------- API 接口 ----------

// 首页：简单说明
app.get('/', (req, res) => {
  res.json({
    app: 'railway-weather-api',
    endpoints: {
      health: '/health',
      latest: '/api/latest',
      history: '/api/history?limit=10',
    },
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 核心接口：返回最近一次获取到的数据
app.get('/api/latest', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, payload, fetched_at FROM weather_reads ORDER BY id DESC LIMIT 1'
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '数据库中还没有数据，请等待定时任务首次执行' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('查询失败:', err.message);
    res.status(500).json({ error: '查询失败', detail: err.message });
  }
});

// 附加接口：最近 N 条历史记录
app.get('/api/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const { rows } = await pool.query(
      'SELECT id, payload, fetched_at FROM weather_reads ORDER BY id DESC LIMIT $1',
      [limit]
    );
    res.json({ count: rows.length, records: rows });
  } catch (err) {
    console.error('查询失败:', err.message);
    res.status(500).json({ error: '查询失败', detail: err.message });
  }
});

// ---------- 启动逻辑 ----------

// 计算下一个整点时间（我们的 cron 是每小时整点触发）
function nextRunAt() {
  const next = new Date();
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

async function main() {
  const startedAt = Date.now();

  app.listen(PORT, () => {
    console.log(`🚀 服务已启动，端口: ${PORT}`);
  });

  // 心跳日志：每 30 秒打一条，在 Railway Logs 里确认服务活着
  // 用 setInterval 而不是 cron，因为它是简单的固定间隔，且不依赖数据库
  setInterval(() => {
    const totalSec = Math.floor((Date.now() - startedAt) / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const uptime = h > 0 ? `${h}小时${m}分${s}秒` : m > 0 ? `${m}分${s}秒` : `${s}秒`;
    console.log(`💓 [心跳] 服务运行中 | 已运行 ${uptime} | ${new Date().toISOString()}`);
  }, 30_000);

  // 如果配置了数据库，则初始化并启动定时任务
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  未配置 DATABASE_URL，跳过数据库初始化与定时任务');
    return;
  }

  try {
    await initTable();

    // 启动时立即抓取一次，避免部署后一小时内接口无数据
    await fetchAndStore().catch((err) =>
      console.error('首次抓取失败（不影响服务运行）:', err.message)
    );

    // 每小时整点执行一次（cron 表达式: 分 时 日 月 周）
    // timezone: 'UTC' 明确按 UTC 计算"整点"，与 Railway 容器时区一致
    cron.schedule(
      '0 * * * *',
      () => {
        console.log(`⏰ [cron] 定时任务触发: ${new Date().toISOString()}`);
        fetchAndStore()
          .then(() => console.log(`✅ [cron] 本轮抓取成功完成: ${new Date().toISOString()}`))
          .catch((err) =>
            console.error(`❌ [cron] 本轮抓取失败: ${new Date().toISOString()} | 原因: ${err.message}`)
          );
      },
      { timezone: 'UTC' }
    );
    console.log(`⏰ 定时任务已启动: 每小时整点(UTC)抓取，下次预计: ${nextRunAt().toISOString()}`);
  } catch (err) {
    console.error('数据库初始化失败:', err.message);
    process.exit(1);
  }
}

main();
