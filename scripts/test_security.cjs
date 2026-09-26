const assert = require('node:assert/strict');

const mongodbModulePath = require.resolve('../netlify/functions/lib/mongodb');
const postgresModulePath = require.resolve('../netlify/functions/lib/postgres');
const mysqlModulePath = require.resolve('../netlify/functions/lib/mysql');
const authModulePath = require.resolve('../netlify/functions/lib/auth');
const dashboardModulePath = require.resolve('../netlify/functions/dashboard');

const internalConfigs = [
  {
    index: 1,
    id: 'mongodb_1',
    label: 'MongoDB',
    dbName: 'system_reset',
    isPrimary: true,
    uri: 'mongodb+srv://user:password@example.invalid/database',
  },
  {
    index: 2,
    id: 'postgres_2',
    label: 'PostgreSQL 2',
    dbName: 'app',
    url: 'postgresql://user:password@example.invalid/app',
  },
  {
    index: 3,
    id: 'mysql_3',
    label: 'MySQL 3',
    dbName: 'app',
    url: 'mysql://user:password@example.invalid/app',
    password: 'must-not-leak',
    futureSecret: 'must-not-leak-either',
  },
];

function mockModule(modulePath, exports) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports,
  };
}

const emptyCursor = {
  limit() {
    return this;
  },
  async toArray() {
    return [];
  },
};

const fakeDb = {
  collection(name) {
    if (name === 'settings') {
      return {
        async findOne() {
          return { enabled: true, interval: 5, updatedAt: new Date(0) };
        },
        async insertOne() {
          throw new Error('The existing settings control should not insert data');
        },
      };
    }

    if (name === 'logs') {
      return {
        async countDocuments() {
          return 0;
        },
        async findOne() {
          return null;
        },
        find() {
          return emptyCursor;
        },
        aggregate() {
          return emptyCursor;
        },
      };
    }

    throw new Error(`Unexpected collection requested: ${name}`);
  },
};

mockModule(mongodbModulePath, {
  async connectToDatabase() {
    return { db: fakeDb };
  },
  getMongoConfigs() {
    return [internalConfigs[0]];
  },
});
mockModule(postgresModulePath, {
  getPostgresConfigs() {
    return [internalConfigs[1]];
  },
});
mockModule(mysqlModulePath, {
  getMysqlConfigs() {
    return [internalConfigs[2]];
  },
});
mockModule(authModulePath, {
  CORS_HEADERS: { 'Content-Type': 'application/json' },
  verifyToken() {
    return { username: 'security-test', role: 'admin' };
  },
  jsonResponse(statusCode, data) {
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  },
});

delete require.cache[dashboardModulePath];
const { handler, toPublicDatabaseConfig } = require(dashboardModulePath);

const publicConfigs = internalConfigs.map(toPublicDatabaseConfig);

assert.deepEqual(publicConfigs, [
  {
    index: 1,
    id: 'mongodb_1',
    label: 'MongoDB',
    dbName: 'system_reset',
    isPrimary: true,
  },
  {
    index: 2,
    id: 'postgres_2',
    label: 'PostgreSQL 2',
    dbName: 'app',
  },
  {
    index: 3,
    id: 'mysql_3',
    label: 'MySQL 3',
    dbName: 'app',
  },
]);

const serialized = JSON.stringify(publicConfigs);
for (const secret of ['mongodb+srv://', 'postgresql://', 'mysql://', 'must-not-leak']) {
  assert.equal(serialized.includes(secret), false, `Public config leaked: ${secret}`);
}

assert.equal(serialized.includes('must-not-leak-either'), false, 'Public config leaked a future secret field');

async function testDashboardResponse() {
  const response = await handler({
    httpMethod: 'GET',
    headers: { authorization: 'Bearer security-test-token' },
  }, {});

  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);

  assert.deepEqual(data.database.mongoList, [publicConfigs[0]]);
  assert.deepEqual(data.database.postgresList, [publicConfigs[1]]);
  assert.deepEqual(data.database.mysqlList, [publicConfigs[2]]);

  const responseBody = response.body;
  for (const secret of ['mongodb+srv://', 'postgresql://', 'mysql://', 'must-not-leak']) {
    assert.equal(responseBody.includes(secret), false, `Dashboard response leaked: ${secret}`);
  }

  assert.equal(
    responseBody.includes('must-not-leak-either'),
    false,
    'Dashboard response leaked a future secret field',
  );
}

testDashboardResponse()
  .then(() => {
    console.log('Security regression checks passed: dashboard responses exclude database connection secrets.');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
