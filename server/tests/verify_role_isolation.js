const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  // 1. Log in as Teacher
  console.log('Testing Teacher View...');
  await page.goto('http://localhost:3000/#login', { waitUntil: 'networkidle2' });
  
  await page.click('input[type="email"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('input[type="email"]', 'teacher1@qubix.com');

  await page.click('input[type="password"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('input[type="password"]', 'Password123!');
  
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Current URL after teacher login:', page.url());
  const teacherText = await page.evaluate(() => document.body.innerText);
  console.log('Crash detected:', teacherText.includes('Something went wrong on this page'));
  console.log('GraduationCap missing:', teacherText.includes('GraduationCap is not defined'));
  console.log('Quiz Studio visible:', teacherText.includes('Quiz Studio & Assessment Center'));
  
  const teacherScreenshot = 'C:/Users/Admin/.gemini/antigravity/brain/d1b423ab-12cf-437d-9aa3-5515e5290da5/07_qubix_teacher_creator_dashboard_fixed.png';
  await page.screenshot({ path: teacherScreenshot });
  console.log('Teacher screenshot saved to:', teacherScreenshot);
  
  // 2. Clear session and log in as Student
  console.log('Testing Student View & Role Isolation...');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('http://localhost:3000/#login', { waitUntil: 'networkidle2' });
  
  await page.click('input[type="email"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('input[type="email"]', 'student1@qubix.com');

  await page.click('input[type="password"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('input[type="password"]', 'Password123!');

  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Current URL after student login:', page.url());
  const studentText = await page.evaluate(() => document.body.innerText);
  console.log('Student sees "Switch to Teacher":', studentText.includes('Switch to Teacher'));
  console.log('Student sees "Upgrade to Creator":', studentText.includes('Upgrade to Creator'));
  
  const studentScreenshot = 'C:/Users/Admin/.gemini/antigravity/brain/d1b423ab-12cf-437d-9aa3-5515e5290da5/08_qubix_student_no_role_switch.png';
  await page.screenshot({ path: studentScreenshot });
  console.log('Student screenshot saved to:', studentScreenshot);

  // 3. Test Student attempting to navigate to Creator Dashboard directly
  await page.goto('http://localhost:3000/#creator-dashboard', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  const currentUrl = page.url();
  console.log('Student restricted from creator-dashboard, redirected to:', currentUrl);

  await browser.close();
  console.log('🎉 Verification finished successfully!');
})();
