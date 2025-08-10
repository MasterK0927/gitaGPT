#!/usr/bin/env node

/**
 * Production Environment Check Script
 * Validates environment variables and service connectivity
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

console.log('🔍 GitaGPT Production Environment Check');
console.log('=====================================\n');

// Check Node.js version
console.log('📋 System Information:');
console.log(`  Node.js Version: ${process.version}`);
console.log(`  Platform: ${process.platform}`);
console.log(`  Architecture: ${process.arch}`);
console.log(`  Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used\n`);

// Check environment variables
console.log('🔧 Environment Variables:');
const envVars = {
  'NODE_ENV': process.env.NODE_ENV || 'not set',
  'PORT': process.env.PORT || 'not set',
  'SUPABASE_URL': process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing',
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
  'GEMINI_API_KEY': process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing',
  'ELEVENLABS_API_KEY': process.env.ELEVENLABS_API_KEY ? '✅ Set' : '❌ Missing',
  'CLERK_SECRET_KEY': process.env.CLERK_SECRET_KEY ? '✅ Set' : '❌ Missing',
  'REDIS_URL': process.env.REDIS_URL ? '✅ Set' : '❌ Missing'
};

Object.entries(envVars).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('\n🔗 Service Connectivity Tests:');

// Test Supabase connection
async function testSupabase() {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('  Supabase: ❌ Missing credentials');
      return false;
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.log(`  Supabase: ❌ Connection failed - ${error.message}`);
      return false;
    }

    console.log('  Supabase: ✅ Connected successfully');
    return true;
  } catch (error) {
    console.log(`  Supabase: ❌ Connection failed - ${error.message}`);
    return false;
  }
}

// Test OpenAI API
async function testOpenAI() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('  OpenAI: ❌ API key missing');
      return false;
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      console.log('  OpenAI: ✅ API key valid');
      return true;
    } else {
      console.log(`  OpenAI: ❌ API key invalid - ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`  OpenAI: ❌ Connection failed - ${error.message}`);
    return false;
  }
}

// Test Redis connection
async function testRedis() {
  try {
    if (!process.env.REDIS_URL) {
      console.log('  Redis: ❌ URL missing');
      return false;
    }

    // Simple Redis connection test
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 5000,
      lazyConnect: true
    });

    await redis.ping();
    await redis.disconnect();
    
    console.log('  Redis: ✅ Connected successfully');
    return true;
  } catch (error) {
    console.log(`  Redis: ❌ Connection failed - ${error.message}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = {
    supabase: await testSupabase(),
    openai: await testOpenAI(),
    redis: await testRedis()
  };

  console.log('\n📊 Summary:');
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  
  console.log(`  Tests Passed: ${passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('  Status: ✅ All systems operational');
    process.exit(0);
  } else {
    console.log('  Status: ⚠️ Some services unavailable');
    console.log('\n💡 Recommendations:');
    
    if (!results.supabase) {
      console.log('  - Check Supabase credentials and network connectivity');
    }
    if (!results.openai) {
      console.log('  - Verify OpenAI API key and account status');
    }
    if (!results.redis) {
      console.log('  - Check Redis URL and service availability');
    }
    
    process.exit(1);
  }
}

// Run the checks
runTests().catch(error => {
  console.error('\n❌ Production check failed:', error);
  process.exit(1);
});
