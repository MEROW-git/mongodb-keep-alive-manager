const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { getMongoConfigs, pingMongoInstance, pingAllMongo } = require('../netlify/functions/lib/mongodb');
const { getPostgresConfigs, pingPostgres, pingAllPostgres } = require('../netlify/functions/lib/postgres');
const { getMysqlConfigs, pingMysql, pingAllMysql } = require('../netlify/functions/lib/mysql');

async function testAllDatabases() {
  console.log('========================================================');
  console.log('🚀 Multi-Database Keep-Alive Connection & Ping Diagnostic');
  console.log('========================================================\n');

  // 1. MongoDB
  const mongoConfigs = getMongoConfigs();
  console.log('🍃 MongoDB Instances Configured: ' + mongoConfigs.length + ' / 5');
  if (mongoConfigs.length === 0) {
    console.log('   ⚠️ No MongoDB URIs found (set MONGO_URI or MONGO_URI1..5)');
  } else {
    for (const cfg of mongoConfigs) {
      console.log('   👉 [' + cfg.label + '] Target DB: ' + cfg.dbName + ' (Primary Storage: ' + (cfg.isPrimary ? 'YES' : 'NO') + ')');
      const res = await pingMongoInstance(cfg.index);
      if (res.status === 'SUCCESS') {
        console.log('      ✅ Connected & Pinged in ' + res.responseTime + 'ms! Status: ONLINE');
      } else {
        console.log('      ❌ Ping FAILED (' + res.responseTime + 'ms): ' + (res.error || res.message));
      }
    }
  }

  // 2. PostgreSQL
  console.log('\n--------------------------------------------------------');
  const pgConfigs = getPostgresConfigs();
  console.log('🐘 PostgreSQL Instances Configured: ' + pgConfigs.length + ' / 5');
  if (pgConfigs.length === 0) {
    console.log('   ⚠️ No PostgreSQL URLs found (set postgresql_url or postgresql_url1..5)');
  } else {
    for (const cfg of pgConfigs) {
      console.log('   👉 [' + cfg.label + '] Target DB: ' + cfg.dbName);
      const res = await pingPostgres(cfg.index);
      if (res.status === 'SUCCESS') {
        console.log('      ✅ Connected & Pinged in ' + res.responseTime + 'ms! Database: ' + res.database + ' (Server Time: ' + res.timestamp + ')');
      } else {
        console.log('      ❌ Ping FAILED (' + res.responseTime + 'ms): ' + (res.error || res.message));
      }
    }
  }

  // 3. MySQL
  console.log('\n--------------------------------------------------------');
  const myConfigs = getMysqlConfigs();
  console.log('🐬 MySQL Instances Configured: ' + myConfigs.length + ' / 5');
  if (myConfigs.length === 0) {
    console.log('   ⚠️ No MySQL URLs found (set mysql_url or mysql_url1..5)');
  } else {
    for (const cfg of myConfigs) {
      console.log('   👉 [' + cfg.label + '] Target DB: ' + cfg.dbName);
      const res = await pingMysql(cfg.index);
      if (res.status === 'SUCCESS') {
        console.log('      ✅ Connected & Pinged in ' + res.responseTime + 'ms! Database: ' + res.database + ' (Server Time: ' + res.timestamp + ')');
      } else {
        console.log('      ❌ Ping FAILED (' + res.responseTime + 'ms): ' + (res.error || res.message));
      }
    }
  }

  console.log('\n========================================================');
  console.log('✨ Diagnostic complete!');
  console.log('========================================================\n');
}

testAllDatabases().then(() => process.exit(0)).catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
