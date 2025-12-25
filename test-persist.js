// Simple test to verify localStorage persistence
// This script will test if localStorage can be accessed and if the persist plugin is working

// Test 1: Check if localStorage is available
function testLocalStorage() {
  console.log('=== Testing localStorage ===')

  try {
    localStorage.setItem('test-key', 'test-value')
    const value = localStorage.getItem('test-key')
    console.log('✅ localStorage is working:', value)
    localStorage.removeItem('test-key')
    return true
  } catch (error) {
    console.log('❌ localStorage is not available:', error.message)
    return false
  }
}

// Test 2: Check if Pinia stores are being persisted
function testPiniaPersist() {
  console.log('\n=== Testing Pinia Persistence ===')

  // Check if there are any existing persisted stores
  const keys = Object.keys(localStorage).filter(key => key.startsWith('innochat-'))

  if (keys.length === 0) {
    console.log('ℹ️ No existing innochat stores found in localStorage')
    console.log('📝 This is expected on first run. Visit /test-persist to create test data.')
  } else {
    console.log('✅ Found persisted stores:', keys)
    keys.forEach(key => {
      try {
        const value = JSON.parse(localStorage.getItem(key))
        console.log(`  - ${key}:`, value)
      } catch {
        console.log(`  - ${key}: [raw data]`, localStorage.getItem(key))
      }
    })
  }

  return keys.length
}

// Test 3: Check if the persist plugin script is loaded (this would need to be run in browser)
function testPluginLoad() {
  console.log('\n=== Testing Plugin Load ===')
  console.log('📝 This test requires visiting /test-persist in a browser')
  console.log('📝 Open browser console and check for:')
  console.log('   - No errors on page load')
  console.log('   - Test store state is initialized')
  console.log('   - localStorage contains "innochat-test" key after interaction')
}

// Run tests
console.log('🧪 Pinia Persistence Test Suite')
console.log('================================')

const localStorageWorks = testLocalStorage()
testPiniaPersist()
testPluginLoad()

if (localStorageWorks) {
  console.log('\n✅ Basic localStorage functionality is working')
  console.log('📝 Next steps:')
  console.log('   1. Visit http://localhost:3000/test-persist')
  console.log('   2. Interact with the test buttons')
  console.log('   3. Refresh the page to verify persistence')
  console.log('   4. Check browser dev tools → Application → Local Storage')
} else {
  console.log('\n❌ localStorage is not available - persistence cannot work')
}

console.log('\n🔍 If persistence is not working, check:')
console.log('   1. Browser localStorage is enabled')
console.log('   2. No browser privacy mode that blocks localStorage')
console.log('   3. No browser extensions blocking localStorage')
console.log('   4. The persist plugin is loaded without errors')