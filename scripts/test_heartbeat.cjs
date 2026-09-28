const assert = require('node:assert/strict');

const { writeMongoHeartbeat } = require('../netlify/functions/lib/mongodb');
const { writePostgresHeartbeat } = require('../netlify/functions/lib/postgres');
const { writeMysqlHeartbeat } = require('../netlify/functions/lib/mysql');
const { getScheduleDecision } = require('../netlify/functions/scheduled-ping');

async function testMongoHeartbeat() {
  const calls = [];
  const db = {
    collection(name) {
      assert.equal(name, 'keepalive_heartbeat');
      return {
        async updateOne(...args) {
          calls.push(args);
          return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
        },
      };
    },
  };
  const now = new Date('2026-01-02T03:04:05.000Z');

  const result = await writeMongoHeartbeat(db, now);

  assert.deepEqual(calls, [[
    { _id: 'database_keepalive' },
    {
      $set: {
        lastHeartbeatAt: now,
        service: 'mongodb-keep-alive-manager',
      },
    },
    { upsert: true },
  ]]);
  assert.equal(result.acknowledged, true);
}

async function testPostgresHeartbeat() {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      return { rows: queries.length === 2 ? [{ last_heartbeat_at: new Date(0) }] : [] };
    },
  };

  await writePostgresHeartbeat(client);

  assert.equal(queries.length, 2);
  assert.match(queries[0], /CREATE TABLE IF NOT EXISTS keepalive_heartbeat/);
  assert.match(queries[1], /INSERT INTO keepalive_heartbeat/);
  assert.match(queries[1], /ON CONFLICT \(id\) DO UPDATE/);
  assert.doesNotMatch(queries.join('\n'), /SELECT\s+1/i);
}

async function testMysqlHeartbeat() {
  const queries = [];
  const connection = {
    async query(sql) {
      queries.push(sql);
      return [[], []];
    },
  };

  await writeMysqlHeartbeat(connection);

  assert.equal(queries.length, 2);
  assert.match(queries[0], /CREATE TABLE IF NOT EXISTS keepalive_heartbeat/);
  assert.match(queries[1], /INSERT INTO keepalive_heartbeat/);
  assert.match(queries[1], /ON DUPLICATE KEY UPDATE/);
  assert.doesNotMatch(queries.join('\n'), /SELECT\s+1/i);
}

function testScheduleDecision() {
  const now = Date.parse('2026-01-02T03:04:05.000Z');

  assert.equal(getScheduleDecision({ interval: 1 }, null, now).due, true);
  assert.equal(getScheduleDecision(
    { interval: 1 },
    { createdAt: new Date(now - 59_000) },
    now,
  ).due, false);
  assert.equal(getScheduleDecision(
    { interval: 1 },
    { createdAt: new Date(now - 60_000) },
    now,
  ).due, true);
  assert.equal(getScheduleDecision({ interval: 0 }, null, now).intervalMinutes, 5);
  assert.equal(getScheduleDecision({ interval: 9999 }, null, now).intervalMinutes, 1440);
}

Promise.all([
  testMongoHeartbeat(),
  testPostgresHeartbeat(),
  testMysqlHeartbeat(),
])
  .then(() => {
    testScheduleDecision();
    console.log('Heartbeat checks passed: every database performs a bounded write and scheduling honors the saved interval.');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
