// TEST FILE - Run this to test lock/unlock endpoints
// Run in terminal: node test_lock_unlock.js

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/admin';

async function testLockUnlock() {
  try {
    console.log('🧪 Testing Lock/Unlock Slot Endpoints\n');

    // Test data
    const testData = {
      slotId: 'S1',  // Change this to match your actual slot ID
      date: '2026-02-20',  // Change to a future date
      lockReason: 'Maintenance'
    };

    // TEST 1: Lock a single slot
    console.log('1️⃣ Testing LOCK SLOT...');
    const lockResponse = await axios.post(`${BASE_URL}/lock-slot`, testData);
    console.log('✅ Lock Response:', lockResponse.data);
    console.log('');

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // TEST 2: Try to lock again (should fail or show already locked)
    console.log('2️⃣ Testing LOCK AGAIN (should show already locked)...');
    try {
      const lockAgainResponse = await axios.post(`${BASE_URL}/lock-slot`, testData);
      console.log('Response:', lockAgainResponse.data);
    } catch (err) {
      console.log('⚠️ Expected behavior - already locked:', err.response?.data);
    }
    console.log('');

    // TEST 3: Unlock the slot
    console.log('3️⃣ Testing UNLOCK SLOT...');
    const unlockResponse = await axios.post(`${BASE_URL}/unlock-slot`, {
      slotId: testData.slotId,
      date: testData.date,
      unlockReason: 'Maintenance completed'
    });
    console.log('✅ Unlock Response:', unlockResponse.data);
    console.log('');

    console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    if (error.response) {
      console.error('Error Response:', error.response.data);
    }
  }
}

// Run the tests
testLockUnlock();
