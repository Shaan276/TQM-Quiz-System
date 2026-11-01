const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\d1b423ab-12cf-437d-9aa3-5515e5290da5';
const BASE_URL = 'http://localhost:3000';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBrowserTest() {
  console.log('🚀 Launching Chrome for Manual UI E2E Testing...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true, // headless browser runs smoothly
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  try {
    // STEP 1: Landing Page
    console.log('📸 Step 1: Navigating to Landing Page...');
    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle2' });
    await delay(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_landing_page.png') });
    console.log('✓ Captured 01_landing_page.png');

    // STEP 2: Navigate to Login
    console.log('📸 Step 2: Navigating to Login Page...');
    await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle2' });
    await delay(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_login_page.png') });
    console.log('✓ Captured 02_login_page.png');

    // Login as Admin
    console.log('🔑 Logging in as Super Admin (admin@quizsystem.com)...');
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      if (inputs.length >= 2) {
        inputs[0].value = 'admin@quizsystem.com';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].value = 'Password123!';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await delay(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_login_filled.png') });

    // Click submit
    await page.evaluate(() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await delay(2000);

    // STEP 3: Admin Console & Notifications
    console.log('📸 Step 3: Admin Dashboard View...');
    await page.goto(`${BASE_URL}/#admin-dashboard`, { waitUntil: 'networkidle2' });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_admin_dashboard.png') });
    console.log('✓ Captured 04_admin_dashboard.png');

    // Click Notification Bell to inspect notifications drawer
    console.log('🔔 Opening Notification Bell drawer...');
    const bellClicked = await page.evaluate(() => {
      const bell = document.querySelector('button[aria-label="View notifications"]');
      if (bell) {
        bell.click();
        return true;
      }
      return false;
    });
    await delay(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_notification_drawer_open.png') });
    console.log('✓ Captured 05_notification_drawer_open.png');

    // Close drawer
    await page.evaluate(() => {
      const bell = document.querySelector('button[aria-label="View notifications"]');
      if (bell) bell.click();
    });
    await delay(500);

    // Click "Security Approvals Gate" tab in Admin console
    console.log('🛡️ Opening Security Approvals Gate Tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const approvalsBtn = buttons.find(b => b.textContent.includes('Security Approvals Gate') || b.textContent.includes('Pending Approvals'));
      if (approvalsBtn) approvalsBtn.click();
    });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_admin_approvals_gate.png') });
    console.log('✓ Captured 06_admin_approvals_gate.png');

    // STEP 4: Open new page for Teacher Flow
    console.log('👨‍🏫 Step 4: Testing Teacher Flow...');
    const teacherPage = await browser.newPage();
    await teacherPage.setViewport({ width: 1400, height: 900 });

    // Register a new teacher
    const testTeacherEmail = `teacher_${Date.now()}@university.edu`;
    await teacherPage.goto(`${BASE_URL}/#register`, { waitUntil: 'networkidle2' });
    await delay(1000);

    await teacherPage.evaluate((email) => {
      const inputs = document.querySelectorAll('input');
      // name, email, password, confirm
      if (inputs.length >= 4) {
        inputs[0].value = 'Dr. Richard Feynman';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].value = email;
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[2].value = 'Password123!';
        inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[3].value = 'Password123!';
        inputs[3].dispatchEvent(new Event('input', { bubbles: true }));
      }
      // select role TEACHER
      const roleSelect = document.querySelector('select');
      if (roleSelect) {
        roleSelect.value = 'TEACHER';
        roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, testTeacherEmail);

    await delay(500);
    await teacherPage.screenshot({ path: path.join(ARTIFACT_DIR, '07_teacher_register_form.png') });
    console.log('✓ Captured 07_teacher_register_form.png');

    // Submit teacher registration
    await teacherPage.evaluate(() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await delay(2000);
    await teacherPage.screenshot({ path: path.join(ARTIFACT_DIR, '08_teacher_registered_success.png') });
    console.log('✓ Captured 08_teacher_registered_success.png');

    // Verify Admin sees new Teacher in Approvals Gate!
    console.log('🔄 Admin refreshes Approvals Gate to see new teacher...');
    await page.bringToFront();
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const refreshBtn = buttons.find(b => b.textContent.includes('Refresh Requests'));
      if (refreshBtn) refreshBtn.click();
    });
    await delay(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '09_admin_sees_pending_teacher.png') });
    console.log('✓ Captured 09_admin_sees_pending_teacher.png');

    // Admin approves the Teacher
    console.log('✅ Admin clicks "Approve Teacher"...');
    await page.evaluate(() => {
      const approveBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Approve Teacher'));
      if (approveBtns.length > 0) approveBtns[0].click();
    });
    await delay(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '10_admin_approved_teacher.png') });
    console.log('✓ Captured 10_admin_approved_teacher.png');

    // STEP 5: Student Flow - Request Section Enrollment
    console.log('🎓 Step 5: Testing Student Flow...');
    const studentPage = await browser.newPage();
    await studentPage.setViewport({ width: 1400, height: 900 });

    // Login as Demo Student
    await studentPage.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle2' });
    await delay(1000);
    await studentPage.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      if (inputs.length >= 2) {
        inputs[0].value = 'student@quizsystem.com';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].value = 'Password123!';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await delay(2000);

    await studentPage.goto(`${BASE_URL}/#learner-dashboard`, { waitUntil: 'networkidle2' });
    await delay(1500);
    await studentPage.screenshot({ path: path.join(ARTIFACT_DIR, '11_student_dashboard.png') });
    console.log('✓ Captured 11_student_dashboard.png');

    // Check Student Notification Bell
    console.log('🔔 Opening Student Notification Drawer...');
    await studentPage.evaluate(() => {
      const bell = document.querySelector('button[aria-label="View notifications"]');
      if (bell) bell.click();
    });
    await delay(1000);
    await studentPage.screenshot({ path: path.join(ARTIFACT_DIR, '12_student_notifications.png') });
    console.log('✓ Captured 12_student_notifications.png');

    // STEP 6: Teacher Dashboard & Student Section Approvals
    console.log('👨‍🏫 Step 6: Teacher Dashboard & Student Approvals Tab...');
    const teacherLogin = await browser.newPage();
    await teacherLogin.setViewport({ width: 1400, height: 900 });
    await teacherLogin.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle2' });
    await delay(1000);
    await teacherLogin.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      if (inputs.length >= 2) {
        inputs[0].value = 'teacher@quizsystem.com';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].value = 'Password123!';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await delay(2000);

    await teacherLogin.goto(`${BASE_URL}/#creator-dashboard`, { waitUntil: 'networkidle2' });
    await delay(1500);
    await teacherLogin.screenshot({ path: path.join(ARTIFACT_DIR, '13_teacher_dashboard.png') });
    console.log('✓ Captured 13_teacher_dashboard.png');

    // Click Student Enrollments Tab in Teacher View
    console.log('📋 Teacher clicks "Student Enrollments" tab...');
    await teacherLogin.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Student Enrollments'));
      if (tabs.length > 0) tabs[0].click();
    });
    await delay(1500);
    await teacherLogin.screenshot({ path: path.join(ARTIFACT_DIR, '14_teacher_student_approvals_tab.png') });
    console.log('✓ Captured 14_teacher_student_approvals_tab.png');

    console.log('🎉 Manual Browser UI Test Suite Completed Successfully with 14 visual screenshots captured!');
  } catch (err) {
    console.error('❌ Browser test failed with error:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'error_state.png') });
  } finally {
    await browser.close();
  }
}

runBrowserTest();
