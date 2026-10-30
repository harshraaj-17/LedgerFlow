const nodemailer = require("nodemailer");

const SENDER_NAME = "Backend Ledger";
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

let transporter;

/** Returns a Gmail OAuth2 transporter, or null when email is not configured. */
function getTransporter() {
  if (transporter) return transporter;

  const { EMAIL_USER, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN } = process.env;
  if (![EMAIL_USER, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN].every(Boolean)) return null;

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: EMAIL_USER,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      refreshToken: REFRESH_TOKEN,
    },
  });
  return transporter;
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

/** Never throws: a failed notification must not break the request that triggered it. */
async function sendEmail({ to, subject, text, html }) {
  const mailer = getTransporter();
  if (!mailer) return;

  try {
    await mailer.sendMail({
      from: `"${SENDER_NAME}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("Email delivery failed:", error.message);
  }
}

function sendRegistrationEmail(email, name) {
  return sendEmail({
    to: email,
    subject: "Welcome to Backend Ledger!",
    text: `Hello ${name},\n\nThank you for registering with Backend Ledger.`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Thank you for registering with Backend Ledger.</p>`,
  });
}

function sendTransactionEmail(email, name, amount, accountId, currency = "INR") {
  const formattedAmount = new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);

  return sendEmail({
    to: email,
    subject: "Transaction Successful",
    text: `Hello ${name}, your transfer of ${formattedAmount} to account ${accountId} was successful.`,
    html:
      `<p>Hello ${escapeHtml(name)}, your transfer of ${formattedAmount} ` +
      `to account ${escapeHtml(accountId)} was successful.</p>`,
  });
}

module.exports = { sendRegistrationEmail, sendTransactionEmail };
