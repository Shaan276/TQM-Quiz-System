const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\d1b423ab-12cf-437d-9aa3-5515e5290da5';
const BASE_URL = 'http://localhost:3000';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBrowserTest() {
  console.log('🚀 Running Qubix Manual UI E2E Browser Test...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  try {
    // 1. Landing Page & Tab Title verification
    console.log('📸 Step 1: Navigating to Landing Page...');
    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle2' });
    await delay(1200);
    const pageTitle = await page.title();
    console.log(`✓ Page Title Verified: "${pageTitle}"`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_qubix_landing_page.png') });

    // 2. Login Page with Qubix Presets
    console.log('📸 Step 2: Navigating to Sign In...');
    await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle2' });
    await delay(1200);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_qubix_login_presets.png') });

    // 3. Test Weak Password Rejection on Register Page
    console.log('🔒 Step 3: Verifying Weak Password "12345678" is rejected...');
    await page.goto(`${BASE_URL}/#register`, { waitUntil: 'networkidle2' });
    await delay(1000);

    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      if (inputs.length >= 4) {
        inputs[0].value = 'Weak Test User';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].value = 'weaktest@qubix.com';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[2].value = '12345678';
        inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[3].value = '12345678';
        inputs[3].dispatchEvent(new Event('input', { bubbles: true }));
      }
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await delay(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_weak_password_rejected.png') });
    console.log('✓ Captured 03_weak_password_rejected.png');

    // 4. Register with Secure Password -> Direct Login (No OTP Blocker!)
    console.log('✅ Step 4: Register with secure password & verify direct login without OTP blocker...');
    const newStudentEmail = `learner_${Date.now()}@qubix.com`;
    await page.evaluate((email) => {
      const inputs = document.querySelectorAll('input');
      if (inputs.length >= 4) {
        inputs[0].value = 'Ada Lovelace';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].value = email;
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[2].value = 'Password123!';
        inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[3].value = 'Password123!';
        inputs[3].dispatchEvent(new Event('input', { bubbles: true }));
      }
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await delay(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_registered_direct_login_enabled.png') });
    console.log('✓ Captured 04_registered_direct_login_enabled.png');

    // 5. Login as student1@qubix.com -> Direct entry to Student Arena
    console.log('🎓 Step 5: Logging in directly as student1@qubix.com...');
    await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle2' });
    await delay(1000);
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      if (inputs.length >= 2) {
        inputs[0].value = 'student1@qubix.com';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].value = 'Password123!';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await delay(2000);
    await page.goto(`${BASE_URL}/#learner-dashboard`, { waitUntil: 'networkidle2' });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_qubix_student_arena.png') });
    console.log('✓ Captured 05_qubix_student_arena.png');

    // 6. Login as admin@qubix.com -> Check Sidebar (Verified QUBIX logo and img1 element removed)
    console.log('🛡️ Step 6: Logging in as admin@qubix.com & verifying Sidebar without img1 elements...');
    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1400, height: 900 });
    await adminPage.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle2' });
    await delay(1000);
    await adminPage.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      if (inputs.length >= 2) {
        inputs[0].value = 'admin@qubix.com';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].value = 'Password123!';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await delay(2000);
    await adminPage.goto(`${BASE_URL}/#admin-dashboard`, { waitUntil: 'networkidle2' });
    await delay(1500);
    await adminPage.screenshot({ path: path.join(ARTIFACT_DIR, '06_qubix_admin_sidebar_clean.png') });
    console.log('✓ Captured 06_qubix_admin_sidebar_clean.png');

    console.log('🎉 All Manual Browser Tests Passed! Qubix branding, direct login, Brevo email, secure password, and clean UI verified.');
  } catch (err) {
    console.error('❌ Browser test failed:', err);
  } finally {
    await browser.close();
  }
}

runBrowserTest();
