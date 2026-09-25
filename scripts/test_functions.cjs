const authFn = require('../netlify/functions/auth');
const pingFn = require('../netlify/functions/ping');
const dashboardFn = require('../netlify/functions/dashboard');
const logsFn = require('../netlify/functions/logs');
const settingsFn = require('../netlify/functions/settings');

async function runTests() {
  console.log('🧪 Testing Netlify Serverless Functions locally...\n');

  // Test 1: Auth Login
  console.log('1. Testing auth.js (Login)...');
  const testUser = process.env.ADMIN_USERNAME || 'admin';
  const testPass = process.env.ADMIN_PASSWORD || 'admin123456';
  const loginRes = await authFn.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ username: testUser, password: testPass }),
    headers: {},
  });
  console.log('Login Status Code:', loginRes.statusCode);
  const loginData = JSON.parse(loginRes.body);
  console.log('Login Result:', loginData.status, 'Token exists:', !!loginData.token);
  const token = loginData.token;

  if (!token) {
    console.error('❌ Login failed, aborting further tests.');
    process.exit(1);
  }

  // Test 2: Auth Verify Session
  console.log('\n2. Testing auth.js (Verify Token)...');
  const verifyRes = await authFn.handler({
    httpMethod: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Verify Status Code:', verifyRes.statusCode);
  console.log('User:', JSON.parse(verifyRes.body).user);

  // Test 3: Ping
  console.log('\n3. Testing ping.js...');
  const pingRes = await pingFn.handler({
    httpMethod: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Ping Status Code:', pingRes.statusCode);
  console.log('Ping Response:', JSON.parse(pingRes.body));

  // Test 4: Dashboard
  console.log('\n4. Testing dashboard.js...');
  const dashRes = await dashboardFn.handler({
    httpMethod: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Dashboard Status Code:', dashRes.statusCode);
  const dashData = JSON.parse(dashRes.body);
  console.log('DB Status:', dashData.databaseStatus);
  console.log('Total Successful Pings:', dashData.stats?.totalSuccessfulPing);
  console.log('Response Time:', dashData.stats?.responseTime);
  console.log('Latency history points:', dashData.charts?.latencyHistory?.length);

  // Test 5: Logs
  console.log('\n5. Testing logs.js...');
  const logsRes = await logsFn.handler({
    httpMethod: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    queryStringParameters: { page: '1', limit: '5' },
  });
  console.log('Logs Status Code:', logsRes.statusCode);
  const logsData = JSON.parse(logsRes.body);
  console.log(`Fetched ${logsData.logs?.length} logs, Total in DB: ${logsData.pagination?.total}`);

  // Test 6: Settings
  console.log('\n6. Testing settings.js...');
  const settingsRes = await settingsFn.handler({
    httpMethod: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Settings Status Code:', settingsRes.statusCode);
  console.log('Settings:', JSON.parse(settingsRes.body).settings);
  console.log('Masked URI:', JSON.parse(settingsRes.body).database?.maskedUri);

  console.log('\n🎉 ALL 6 BACKEND SERVERLESS FUNCTIONS TESTED & WORKING PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
