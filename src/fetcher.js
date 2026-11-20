// 定时任务的核心逻辑：从公共 API 获取数据并存入数据库
const { pool } = require('./db');

// Open-Meteo 是免费公共天气 API，无需注册、无需 API key
// 这里查询的是北京（纬度 39.9042，经度 116.4074）的实时天气
const API_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=39.9042&longitude=116.4074&current_weather=true';

async function fetchAndStore() {
  console.log('⏳ 正在从公共 API 获取数据...');

  const res = await fetch(API_URL);
  if (!res.ok) {
    throw new Error(`API 请求失败，状态码: ${res.status}`);
  }

  const data = await res.json();
  const weather = data.current_weather;

  await pool.query(
    'INSERT INTO weather_reads (payload) VALUES ($1)',
    [weather]
  );

  console.log(
    `✅ 数据已入库: 温度 ${weather.temperature}°C, 风速 ${weather.windspeed} km/h, 时间 ${weather.time}`
  );
}

module.exports = { fetchAndStore };
