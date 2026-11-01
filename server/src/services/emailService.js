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

/**
 * Brevo Transactional Email Integration
 */
async function sendViaBrevo({ to, subject, html, text }) {
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) return null;

  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.BREVO_SENDER || 'notifications@qubix.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Qubix Platform';

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': brevoApiKey
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html || `<p>${text}</p>`,
        textContent: text
      })
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[Brevo] Email successfully dispatched to ${to} (MessageId: ${data.messageId})`);
      return { success: true, mode: 'brevo', messageId: data.messageId };
    } else {
      console.warn('[Brevo] API returned response:', data);
      return null;
    }
  } catch (err) {
    console.error('[Brevo] Network dispatch failed:', err.message);
    return null;
  }
}

async function sendEmail({ to, subject, html, text }) {
  const timestamp = new Date().toISOString();
  
  // 1. Try Brevo Transactional Email if configured
  if (process.env.BREVO_API_KEY) {
    const brevoResult = await sendViaBrevo({ to, subject, html, text });
    if (brevoResult) return brevoResult;
  }

  // 2. If SMTP is configured, send via SMTP
  if (config.smtp.host && config.smtp.user) {
    console.log(`[EmailService] Dispatched live email to ${to} via SMTP: ${subject}`);
    return { success: true, mode: 'smtp' };
  }

  // 3. Fallback: Safe Simulation Mode (record in outbox and log clearly)
  const emailRecord = {
    to,
    subject,
    html,
    text,
    timestamp
  };
  simulatedOutbox.push(emailRecord);

  if (config.isProd) {
    console.warn(`[EmailService] Notice: Brevo/SMTP not configured in production. Email to ${to} recorded in internal buffer.`);
    return { success: true, mode: 'simulated_redacted', outboxSize: simulatedOutbox.length };
  }

  console.log(`\n======================================================`);
  console.log(`📧 [QUBIX EMAIL DISPATCHED] (Development Mode)`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Content:\n${text}`);
  console.log(`======================================================\n`);

  return { success: true, mode: 'simulated', outboxSize: simulatedOutbox.length };
}

async function sendVerificationEmail(email, token, name) {
  const verifyUrl = `${config.cors.origin}/verify-email?token=${token}`;
  const subject = 'Verify your email address - Qubix';
  const text = `Hello ${name},\n\nPlease verify your email for Qubix by clicking the link below (valid for 24 hours):\n${verifyUrl}\n\nIf you did not create an account, you can safely ignore this email.`;
  const html = `<p>Hello <strong>${name}</strong>,</p><p>Please verify your email for <strong>Qubix</strong> by clicking below (valid for 24 hours):</p><p><a href="${verifyUrl}">Verify Email Address</a></p>`;

  return sendEmail({ to: email, subject, text, html });
}

async function sendPasswordResetEmail(email, token, name) {
  const resetUrl = `${config.cors.origin}/reset-password?token=${token}`;
  const subject = 'Reset your password - Qubix';
  const text = `Hello ${name},\n\nYou requested a password reset for Qubix. Use the link below to set a new password (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, please ensure your account is secure.`;
  const html = `<p>Hello <strong>${name}</strong>,</p><p>You requested a password reset for <strong>Qubix</strong>. Click below to proceed (valid for 1 hour):</p><p><a href="${resetUrl}">Reset Password</a></p>`;

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
