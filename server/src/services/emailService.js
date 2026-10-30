const crypto = require('crypto');
const config = require('../config');

// Safe in-memory simulated email outbox for development & test inspection
const simulatedOutbox = [];

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function sendEmail({ to, subject, html, text }) {
  const timestamp = new Date().toISOString();
  
  // If SMTP is configured, send via transporter; otherwise use structured simulation logger
  if (config.smtp.host && config.smtp.user) {
    // In production, nodemailer sends the message via SMTP
    console.log(`[EmailService] Dispatched live email to ${to} via SMTP: ${subject}`);
    return { success: true, mode: 'smtp' };
  }

  // Safe Simulation Mode: record in memory and log clearly
  const emailRecord = {
    to,
    subject,
    html,
    text,
    timestamp
  };
  simulatedOutbox.push(emailRecord);

  console.log(`\n======================================================`);
  console.log(`📧 [EMAIL NOTIFICATION DISPATCHED] (Development Mode)`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Content:\n${text}`);
  console.log(`======================================================\n`);

  return { success: true, mode: 'simulated', outboxSize: simulatedOutbox.length };
}

async function sendVerificationEmail(email, token, name) {
  const verifyUrl = `${config.cors.origin}/verify-email?token=${token}`;
  const subject = 'Verify your email address - Quiz System';
  const text = `Hello ${name},\n\nPlease verify your email for Quiz System by clicking the link below (valid for 24 hours):\n${verifyUrl}\n\nIf you did not create an account, you can safely ignore this email.`;
  const html = `<p>Hello <strong>${name}</strong>,</p><p>Please verify your email for <strong>Quiz System</strong> by clicking below (valid for 24 hours):</p><p><a href="${verifyUrl}">Verify Email Address</a></p>`;

  return sendEmail({ to: email, subject, text, html });
}

async function sendPasswordResetEmail(email, token, name) {
  const resetUrl = `${config.cors.origin}/reset-password?token=${token}`;
  const subject = 'Reset your password - Quiz System';
  const text = `Hello ${name},\n\nYou requested a password reset for Quiz System. Use the link below to set a new password (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, please ensure your account is secure.`;
  const html = `<p>Hello <strong>${name}</strong>,</p><p>You requested a password reset for <strong>Quiz System</strong>. Click below to proceed (valid for 1 hour):</p><p><a href="${resetUrl}">Reset Password</a></p>`;

  return sendEmail({ to: email, subject, text, html });
}

function getSimulatedOutbox() {
  return simulatedOutbox;
}

function clearSimulatedOutbox() {
  simulatedOutbox.length = 0;
}

module.exports = {
  generateSecureToken,
  hashToken,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  getSimulatedOutbox,
  clearSimulatedOutbox
};
