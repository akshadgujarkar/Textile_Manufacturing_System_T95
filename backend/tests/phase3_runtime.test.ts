import { CryptoUtil } from '../src/utils/crypto';
import { AuthUser, SqlStateCode } from '../src/types';

async function runPhase3UnitTests() {
  console.log('====================================================');
  console.log('Running Everest Textile TMS: Phase 3 Runtime Tests');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Test Argon2id Password Hashing & Verification
  console.log('\n--- 1. Testing Password Security (Argon2id) ---');
  const password = 'SuperSecretMillPassword2026!';
  const hash = await CryptoUtil.hashPassword(password);
  
  assert(hash.startsWith('$argon2id$'), 'Hash format must be valid RFC 9106 Argon2id');
  
  const isValidMatch = await CryptoUtil.verifyPassword(hash, password);
  assert(isValidMatch === true, 'Correct password verifies successfully');

  const isInvalidMatch = await CryptoUtil.verifyPassword(hash, 'WrongPassword123');
  assert(isInvalidMatch === false, 'Incorrect password fails verification');

  // 2. Test JWT Token Generation & Verification
  console.log('\n--- 2. Testing JWT Session Context ---');
  const testUser: AuthUser = {
    userId: 101,
    username: 'anil_store',
    employeeId: 45,
    roles: ['gate_store'],
  };

  const accessToken = CryptoUtil.generateAccessToken(testUser);
  assert(typeof accessToken === 'string' && accessToken.length > 20, 'Generates valid JWT access token string');

  const decoded = CryptoUtil.verifyAccessToken(accessToken);
  assert(decoded.userId === 101, 'Decoded user ID matches');
  assert(decoded.username === 'anil_store', 'Decoded username matches');
  assert(decoded.roles.includes('gate_store'), 'Decoded role matches');

  // 3. Test SQLSTATE Mapping Constants
  console.log('\n--- 3. Testing PostgreSQL SQLSTATE Constants ---');
  assert(SqlStateCode.BR_IMMUTABLE_OR_DELETED === 'BR001', 'BR001 mapped correctly');
  assert(SqlStateCode.BR_ILLEGAL_STATUS_TRANSITION === 'BR002', 'BR002 mapped correctly');
  assert(SqlStateCode.BR_PERIOD_CLOSED === 'BR004', 'BR004 mapped correctly');
  assert(SqlStateCode.BR_DISPATCH_MISMATCH === 'BR007', 'BR007 mapped correctly');
  assert(SqlStateCode.LOCK_NOT_AVAILABLE === '55P03', '55P03 mapped correctly');

  console.log('\n====================================================');
  console.log(`Phase 3 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3UnitTests().catch((err) => {
  console.error('[TEST SUITE ERROR]', err);
  process.exit(1);
});
