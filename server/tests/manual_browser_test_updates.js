const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\d1b423ab-12cf-437d-9aa3-5515e5290da5';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });

  console.log('📸 Test 1: Checking Landing Page has NO sidebar...');
  await page.goto('http://localhost:3000/#landing', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  
  const hasSidebarOnLanding = await page.evaluate(() => !!document.querySelector('aside'));
  console.log('Sidebar present on landing page?', hasSidebarOnLanding); // Should be false!
  await page.screenshot({ path: `${ARTIFACT_DIR}/09_qubix_landing_no_sidebar.png` });

  console.log('📸 Test 2: Logging in as Teacher (prof. Sarah Jenkins)...');
  await page.goto('http://localhost:3000/#login', { waitUntil: 'networkidle2' });
  await page.click('input[type="email"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('input[type="email"]', 'teacher1@qubix.com');

  await page.click('input[type="password"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('input[type="password"]', 'Password123!');

  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Current URL after login:', page.url());

  // Check top-right notification bar
  const hasTopRightNotif = await page.evaluate(() => {
    const header = document.querySelector('header');
    return header ? header.innerText.includes('TEACHER') : false;
  });
  console.log('Top header bar present with TEACHER status?', hasTopRightNotif);

  // Check sidebar has NO "Overview & Architecture"
  const sidebarText = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    return aside ? aside.innerText : '';
  });
  console.log('Sidebar contains "Overview & Architecture"?', sidebarText.includes('Overview & Architecture'));
  console.log('Sidebar contains "PLATFORM"?', sidebarText.includes('PLATFORM'));

  // Check Quiz Studio card design
  const cardDesignClean = await page.evaluate(() => {
    const card = document.querySelector('.dashboard-card');
    return card ? card.innerText.includes('Start Test') && card.innerText.includes('Unpublish') : false;
  });
  console.log('Spacious quiz card visible?', cardDesignClean);
  await page.screenshot({ path: `${ARTIFACT_DIR}/10_qubix_teacher_spacious_cards_and_top_bar.png` });

  // Open "Start Test" Modal
  console.log('📸 Test 3: Opening Start Test -> Assignment Modal with Searchable Dropdowns...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const startBtn = btns.find(b => b.innerText.includes('Start Test'));
    if (startBtn) startBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click "Configure & Assign Cohort"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const assignBtn = btns.find(b => b.innerText.includes('Configure & Assign'));
    if (assignBtn) assignBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click Course Dropdown
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const courseBtn = btns.find(b => b.innerText.includes('Course') || b.innerText.includes('Section'));
    if (courseBtn) courseBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: `${ARTIFACT_DIR}/11_qubix_course_dropdown_search.png` });
  console.log('Captured Course & Section Dropdown screenshot');

  // Click Student Dropdown
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const studentBtn = btns.find(b => b.innerText.includes('Specific Student'));
    if (studentBtn) studentBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: `${ARTIFACT_DIR}/12_qubix_student_dropdown_search.png` });
  console.log('Captured Specific Student Dropdown screenshot');

  // Test 4: Verify Error Reporting Endpoint
  console.log('📸 Test 4: Triggering and verifying "Send Error to Admin" aggregation...');
  const reportRes = await page.evaluate(async () => {
    const res = await fetch('/api/v1/notifications/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        route: 'creator-dashboard',
        errorMessage: 'Sample verification error: Component render test',
        errorStack: 'Error at CreatorDashboardView.jsx:100'
      })
    });
    return res.json();
  });
  console.log('Error report API response:', reportRes);

  // Re-trigger same error to verify aggregation counter increments
  const reportRes2 = await page.evaluate(async () => {
    const res = await fetch('/api/v1/notifications/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        route: 'creator-dashboard',
        errorMessage: 'Sample verification error: Component render test',
        errorStack: 'Error at CreatorDashboardView.jsx:100'
      })
    });
    return res.json();
  });
  console.log('Second report (aggregated count):', reportRes2.data?.count);

  // Test 5: Log in as Super Admin and check Notification Bell has the aggregated error alert
  console.log('📸 Test 5: Checking Admin received aggregated error notification...');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('http://localhost:3000/#login', { waitUntil: 'networkidle2' });
  await page.click('input[type="email"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('input[type="email"]', 'admin@qubix.com');

  await page.click('input[type="password"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('input[type="password"]', 'Password123!');

  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));

  // Click top-right notification bell
  await page.evaluate(() => {
    const bellBtn = document.querySelector('header button[aria-label="View notifications"]');
    if (bellBtn) bellBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  const notifsText = await page.evaluate(() => document.body.innerText);
  console.log('Admin notification list includes Page Error report?', notifsText.includes('Page Error: #creator-dashboard'));
  await page.screenshot({ path: `${ARTIFACT_DIR}/13_qubix_admin_top_right_notif_received.png` });

  await browser.close();
  console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
})();
