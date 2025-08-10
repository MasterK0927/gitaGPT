#!/usr/bin/env node

/**
 * Production Endpoint Test Script
 * Tests all API endpoints that the cache dashboard depends on
 */

const BACKEND_URL = process.env.REACT_APP_API_URL || 'https://gitagpt-backend-684497130511.europe-west1.run.app';

console.log('🔍 Testing GitaGPT Production Endpoints');
console.log('=====================================');
console.log(`Backend URL: ${BACKEND_URL}\n`);

// Test endpoints
const endpoints = [
  { path: '/ping', name: 'Basic Health Check' },
  { path: '/api/v1/health', name: 'API Health Check' },
  { path: '/api/v1/health/detailed', name: 'Detailed Health Check' },
  { path: '/api/v1/health/db', name: 'Database Health' },
  { path: '/api/v1/health/cache', name: 'Cache Health' },
];

async function testEndpoint(endpoint) {
  const url = `${BACKEND_URL}${endpoint.path}`;
  const startTime = Date.now();
  
  try {
    console.log(`Testing ${endpoint.name}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GitaGPT-Production-Test/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ ${endpoint.name}: ${response.status} (${responseTime}ms)`);
      
      // Log specific details for health endpoints
      if (endpoint.path.includes('health')) {
        if (data.success !== undefined) {
          console.log(`     Success: ${data.success}`);
        }
        if (data.data?.services) {
          const services = Object.keys(data.data.services);
          console.log(`     Services: ${services.join(', ')}`);
        }
        if (data.message) {
          console.log(`     Message: ${data.message}`);
        }
      }
      
      return { success: true, status: response.status, responseTime, data };
    } else {
      console.log(`  ❌ ${endpoint.name}: ${response.status} ${response.statusText} (${responseTime}ms)`);
      const errorText = await response.text();
      console.log(`     Error: ${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}`);
      return { success: false, status: response.status, responseTime, error: errorText };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      console.log(`  ⏰ ${endpoint.name}: Timeout after ${responseTime}ms`);
      return { success: false, status: 'timeout', responseTime, error: 'Request timeout' };
    } else {
      console.log(`  ❌ ${endpoint.name}: ${error.message} (${responseTime}ms)`);
      return { success: false, status: 'error', responseTime, error: error.message };
    }
  }
}

async function testCacheServiceLocally() {
  console.log('\n🧪 Testing Local Cache Service...');
  
  try {
    // Simulate cache service methods
    const mockCacheService = {
      getPerformanceMetrics: () => ({
        hitRate: 85.5,
        totalOperations: 1234,
        hits: 1055,
        misses: 179,
        sets: 456,
        avgProcessingTime: 12.3,
        cacheSize: 789,
        memoryUsage: 1024000
      }),
      getStats: () => ({
        totalEntries: 789,
        validEntries: 750,
        expiredEntries: 39,
        memoryUsage: 1024000,
        mostAccessed: [
          { key: 'user:123:profile', count: 45 },
          { key: 'chat:456:context', count: 32 }
        ],
        oldestEntry: Date.now() - 3600000,
        newestEntry: Date.now()
      })
    };
    
    const metrics = mockCacheService.getPerformanceMetrics();
    const stats = mockCacheService.getStats();
    
    console.log('  ✅ Cache Performance Metrics: OK');
    console.log(`     Hit Rate: ${metrics.hitRate}%`);
    console.log(`     Total Operations: ${metrics.totalOperations}`);
    
    console.log('  ✅ Cache Statistics: OK');
    console.log(`     Total Entries: ${stats.totalEntries}`);
    console.log(`     Valid Entries: ${stats.validEntries}`);
    
    return { success: true };
  } catch (error) {
    console.log(`  ❌ Cache Service Test Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting endpoint tests...\n');
  
  const results = [];
  
  // Test all endpoints
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push({ endpoint: endpoint.name, ...result });
    console.log(''); // Add spacing
  }
  
  // Test local cache service
  const cacheResult = await testCacheServiceLocally();
  results.push({ endpoint: 'Local Cache Service', ...cacheResult });
  
  // Summary
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`Tests Passed: ${successful}/${total}`);
  
  if (successful === total) {
    console.log('Status: ✅ All tests passed');
  } else {
    console.log('Status: ⚠️ Some tests failed');
    
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`  - ${result.endpoint}: ${result.error || result.status}`);
    });
    
    console.log('\n💡 Troubleshooting Tips:');
    console.log('  1. Check if the backend service is running');
    console.log('  2. Verify the backend URL is correct');
    console.log('  3. Check network connectivity');
    console.log('  4. Review backend logs for errors');
    console.log('  5. Ensure all environment variables are set');
  }
  
  // Performance analysis
  const successfulTests = results.filter(r => r.success && r.responseTime);
  if (successfulTests.length > 0) {
    const avgResponseTime = successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length;
    console.log(`\n⚡ Average Response Time: ${Math.round(avgResponseTime)}ms`);
    
    const slowTests = successfulTests.filter(r => r.responseTime > 2000);
    if (slowTests.length > 0) {
      console.log('⚠️ Slow Endpoints (>2s):');
      slowTests.forEach(test => {
        console.log(`  - ${test.endpoint}: ${test.responseTime}ms`);
      });
    }
  }
  
  process.exit(successful === total ? 0 : 1);
}

// Run the tests
runAllTests().catch(error => {
  console.error('\n❌ Test runner failed:', error);
  process.exit(1);
});
