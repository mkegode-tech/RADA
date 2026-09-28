/**
 * RADA AI — diagnostic form backend (Google Apps Script web app).
 *
 * Receives POSTs from the contact page's diagnostic form, then:
 *   1. appends the submission to the "Submissions" tab of the bound Google Sheet,
 *   2. emails a notification to the RADA team (Reply-To set to the enquirer),
 *   3. emails a confirmation of receipt to the enquirer.
 *
 * This file is NOT part of the website build — it is pasted into the Apps Script
 * editor of a Google Sheet (Extensions -> Apps Script). Setup steps are in
 * DEPLOYMENT.md, section 1.
 *
 * Deploy it from any regular radaai.ai user account (contact@radaai.ai is a Google
 * Group, which can't sign in). Both emails are sent from Workspace's
 * noreply@radaai.ai address rather than the deploying user's own address, so
 * which account deploys doesn't show to enquirers, and the notification still
 * reaches the deployer's inbox via the group. Reply-To routes replies correctly:
 * the team's replies go to the enquirer; the enquirer's replies go to contact@.
 */

var CONFIG = {
  NOTIFY_TO: "contact@radaai.ai",
  SENDER_NAME: "RADA AI",
  SHEET_NAME: "Submissions",
  // One confirmation email per address per window, so the form can't be used
  // to bombard a third party's inbox by repeatedly submitting their address.
  CONFIRMATION_COOLDOWN_SECONDS: 600,
};

var FIELDS = [
  { key: "name", label: "Full name & role", required: true },
  { key: "company", label: "Company", required: true },
  { key: "email", label: "Work email", required: true },
  { key: "phone", label: "Phone", required: true },
  { key: "industry", label: "Industry" },
  { key: "size", label: "Organization size" },
  { key: "engagement", label: "Preferred engagement" },
  { key: "challenge", label: "Primary challenge" },
];

var ENGAGEMENT_LABELS = {
  unsure: "Not sure yet",
  strategy: "AI Strategy & Transformation",
  training: "AI Training & Capability Building",
  automation: "AI Automation & Implementation",
  intelligence: "Executive Intelligence Systems",
};

var MAX_FIELD_LENGTH = 5000;

function doPost(e) {
  var p = (e && e.parameter) || {};

  // Honeypot: real visitors never see or fill this field. Report success so
  // bots get no signal, but store and send nothing.
  if (p["bot-field"]) return json_({ ok: true });

  var data = {};
  for (var i = 0; i < FIELDS.length; i++) {
    var f = FIELDS[i];
    var value = String(p[f.key] || "").trim().slice(0, MAX_FIELD_LENGTH);
    if (f.required && !value) return json_({ ok: false, error: "missing_" + f.key });
    data[f.key] = value;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return json_({ ok: false, error: "invalid_email" });
  }
  data.engagement = ENGAGEMENT_LABELS[data.engagement] || data.engagement;

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_();
    var row = [new Date()].concat(FIELDS.map(function (f) { return sheetSafe_(data[f.key]); }));
    row.push(sheetSafe_(p.page || ""));
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  sendNotification_(data);
  sendConfirmation_(data);

  return json_({ ok: true });
}

// Lets you open the /exec URL in a browser to confirm the deployment is live.
function doGet() {
  return json_({ ok: true, service: "rada-diagnostic-form" });
}

/** Run once from the editor to create the Submissions tab with headers. */
function setup() {
  getSheet_();
}

/** Run from the editor to test email + sheet writing without the website. */
function testSubmission() {
  var result = doPost({
    parameter: {
      name: "Test Person, COO",
      company: "Test Co",
      email: CONFIG.NOTIFY_TO,
      phone: "+254 700 000000",
      industry: "Testing",
      size: "1–50 employees",
      engagement: "strategy",
      challenge: "Test submission from the Apps Script editor.",
      page: "editor-test",
    },
  });
  Logger.log(result.getContent());
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    var headers = ["Submitted at"].concat(FIELDS.map(function (f) { return f.label; }), ["Source page"]);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function sendNotification_(data) {
  var rows = FIELDS.map(function (f) {
    return "<tr><td style=\"padding:6px 12px 6px 0;color:#5b6472;vertical-align:top;\">" + esc_(f.label) +
      "</td><td style=\"padding:6px 0;\">" + esc_(data[f.key] || "—").replace(/\n/g, "<br>") + "</td></tr>";
  }).join("");

  MailApp.sendEmail({
    to: CONFIG.NOTIFY_TO,
    noReply: true,
    replyTo: data.email,
    name: CONFIG.SENDER_NAME + " Website",
    subject: "New diagnostic request — " + data.company,
    htmlBody:
      "<div style=\"font-family:Arial,sans-serif;font-size:14px;color:#1b2430;\">" +
      "<p>A new AI Business Diagnostic request was submitted on radaai.ai.</p>" +
      "<table style=\"border-collapse:collapse;\">" + rows + "</table>" +
      "<p style=\"color:#5b6472;\">Reply to this email to respond directly to the enquirer. " +
      "All submissions are logged in the Submissions sheet.</p></div>",
  });
}

function sendConfirmation_(data) {
  var cache = CacheService.getScriptCache();
  var cacheKey = "confirm:" + data.email.toLowerCase();
  if (cache.get(cacheKey)) return;
  cache.put(cacheKey, "1", CONFIG.CONFIRMATION_COOLDOWN_SECONDS);

  var firstName = data.name.split(/[ ,]/)[0];
  MailApp.sendEmail({
    to: data.email,
    noReply: true,
    replyTo: CONFIG.NOTIFY_TO,
    name: CONFIG.SENDER_NAME,
    subject: "We've received your AI Business Diagnostic request",
    htmlBody:
      "<div style=\"font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1b2430;\">" +
      "<p>Dear " + esc_(firstName) + ",</p>" +
      "<p>Thank you for requesting an AI Business Diagnostic with RADA AI on behalf of " + esc_(data.company) + ".</p>" +
      "<p>A member of our team will review your priority and contact you within one business day " +
      "to schedule a short diagnostic call and confirm scope.</p>" +
      "<p>If you need to add anything in the meantime, simply reply to this email.</p>" +
      "<p>Kind regards,<br>RADA AI<br>" +
      "<span style=\"color:#5b6472;\">Crescent Business Centre, Parklands Road, Nairobi · +254 722 459 052</span></p></div>",
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function esc_(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Stop submitted text being interpreted as a spreadsheet formula (e.g. "=HYPERLINK(...)").
function sheetSafe_(s) {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
