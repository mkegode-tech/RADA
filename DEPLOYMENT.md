# Deployment guide — Google Workspace form + Cloudflare Pages hosting

Prepared 28/09/2026. Do the sections in order. The form (section 1) doesn't depend on the host, so
it can go live on Cloudflare's preview URL before any DNS changes.

---

## 1. Diagnostic form → Google Workspace (Apps Script + Google Sheets)

**How it works:** the contact page POSTs to a Google Apps Script web app
(`google-apps-script/diagnostic-form.gs`). For each submission the script:

- adds a row to a Google Sheet,
- emails the team at `contact@radaai.ai`, with Reply-To set to the enquirer,
- sends the enquirer a confirmation. This delivers the "We confirm receipt by email immediately"
  promise already on the contact page.

Spam controls:

- A honeypot field. Anything a bot fills in is silently discarded.
- A 10-minute cooldown on confirmation emails per address, so nobody can use the form to flood
  someone else's inbox.
- Formula-injection escaping on everything written to the Sheet.

### 1.1 Create the Sheet and script

1. Sign in to Google as a **regular radaai.ai user**, ideally the admin account.
   `contact@radaai.ai` is a Google Group, so it can't sign in or own a script. Both emails go out
   from `noreply@radaai.ai`, with Reply-To set correctly, so which account deploys doesn't show to
   anyone. That account must stay active, though: if it is deleted, the form stops working.
2. Create a Google Sheet named **RADA AI — Diagnostic Submissions**. Keep it private to the team.
   Putting it in a **Shared drive** means the Sheet itself survives staff changes.
3. Check the **contact@ group's settings** in Google Groups:
   - **Who can post:** set it to **Anyone on the web**. Otherwise enquirers' replies to the
     confirmation email, and any outside email, bounce.
   - **Message moderation:** set it to *No moderation*, so notifications aren't held for approval.
   - **Members:** everyone who should receive enquiries.
4. In the Sheet, open **Extensions → Apps Script**. Delete the starter code, paste in the full
   contents of `google-apps-script/diagnostic-form.gs`, and save.
5. Choose the function **`setup`** from the function dropdown and click **Run**. Google asks you
   to authorise access to Sheets and Gmail. Go through **Advanced → Go to … (unsafe)**. That
   warning is normal for a private script you wrote yourself. A `Submissions` tab with headers
   appears.
6. Run **`testSubmission`**. You should see a test row in the Sheet, plus a notification email and
   a confirmation email in your inbox (as a group member), both from noreply@radaai.ai.

### 1.2 Deploy as a web app

1. Go to **Deploy → New deployment → Select type: Web app**, with these settings:
   - Description: `Diagnostic form v1`
   - Execute as: **Me** (the account you signed in with)
   - Who has access: **Anyone**. This is required so the public website can post to it. If only
     "Anyone within radaai.ai" is offered, a Workspace admin has blocked external access. The
     admin needs to allow it under Admin console → Apps → Google Workspace → Drive and Docs →
     Sharing settings.
2. Click **Deploy** and copy the **Web app URL**. It looks like
   `https://script.google.com/macros/s/AKfy…/exec`.
3. Open that URL in a browser. It should return `{"ok":true,"service":"rada-diagnostic-form"}`.

### 1.3 Connect the website

1. In `src/pages/contact.html`, replace
   `https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec` in the form's `action`
   with your URL.
2. Rebuild: `node build.js && node build-ghpages.js`
3. Commit and push.

Until this is done, the form shows its error message ("please email us directly…"). It never
falsely confirms a submission.

### 1.4 Updating the script later

Use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. This keeps the
same URL. **New deployment** issues a *new* URL, which would break the live form until you
changed `contact.html` again.

### 1.5 Data protection (needs professional sign-off)

- Submissions are personal data stored in Google's infrastructure outside Kenya. Before launch,
  confirm the Privacy Policy covers this under the Data Protection Act, 2019. Relevant points are
  the cross-border transfer safeguards (s.48–50), naming Google Workspace as a processor, and a
  stated retention period for form data.
- Limit Sheet access to the people who handle enquiries. Set a routine to delete rows older than
  the retention period.

---

## 2. Hosting: Netlify → Cloudflare Pages

The repo is already set up for Cloudflare:

- `netlify.toml` has been removed.
- A Cloudflare `_headers` file carries the same security headers.
- `build-ghpages.js` copies `_headers` into the `docs/` publish folder.
- `docs/404.html` is served automatically for unknown URLs.

### 2.1 Before touching DNS: record what exists today

In the **current DNS provider** for `radaai.ai` (Netlify DNS if the domain uses Netlify
nameservers, otherwise your registrar), export or screenshot **every** record. The ones that
matter most are the Google Workspace email records. If they are lost, `contact@radaai.ai` stops
receiving mail.

| Type | Name | Typical value |
|---|---|---|
| MX | `@` | `smtp.google.com` (priority 1). Older setups use the five `ASPMX.L.GOOGLE.COM`-style records |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` |
| TXT | `google._domainkey` | DKIM key (`v=DKIM1; k=rsa; p=…`) |
| TXT | `_dmarc` | `v=DMARC1; p=…` |
| TXT | `@` | `google-site-verification=…` |

### 2.2 Create the Cloudflare Pages project (no downtime yet)

1. Create a free account at dash.cloudflare.com, ideally as a company-owned account.
2. Go to **Workers & Pages → Create → Pages → Connect to Git**. Authorise GitHub and pick
   `mkegode-tech/RADA`.
3. Use these build settings:
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `node build-ghpages.js`
   - Build output directory: `docs`
4. Click **Save and Deploy**. You get a preview URL like `rada-xxx.pages.dev`. Test it fully:
   every page, the 404 page, and a **real form submission**, which should show up in the Sheet.
   From now on, every push to `main` redeploys automatically.

### 2.3 Move the domain's DNS to Cloudflare

1. In Cloudflare, click **Add a domain**, enter `radaai.ai`, and choose the **Free** plan.
2. Cloudflare scans and imports the existing records. **Compare them against your export from
   2.1** and add anything missing, especially the MX, SPF, DKIM and DMARC records. MX and TXT
   records are always "DNS only".
3. **Delete the old Netlify website records**: the `A`/`ALIAS` record for `@` (e.g. `75.2.60.5`)
   and the `CNAME` for `www` pointing to `*.netlify.app`. Pages adds its own in 2.4.
4. Cloudflare shows two nameservers (e.g. `xxx.ns.cloudflare.com`). At the **registrar** where
   `radaai.ai` was bought, replace the current nameservers with these two.
5. Wait for Cloudflare to email you that the domain is **Active**. This usually takes minutes to a
   few hours, and can take up to 24–48 hours.

### 2.4 Attach the domain to the site

1. Open **Workers & Pages → your project → Custom domains → Set up a custom domain** and add
   `radaai.ai`. Repeat for `www.radaai.ai`. Cloudflare creates the DNS records and SSL
   certificates.
2. Redirect www to the main domain, since the site's canonical URLs are `https://radaai.ai/…`:
   - Go to **Rules → Redirect Rules → Create rule**.
   - Condition: Hostname equals `www.radaai.ai`.
   - Action: Dynamic redirect, expression
     `concat("https://radaai.ai", http.request.uri.path)`, status **301**, preserve query string.
3. Turn on **SSL/TLS → Edge Certificates → Always Use HTTPS**.

### 2.5 Verify, then retire Netlify

1. Test `https://radaai.ai`, `https://www.radaai.ai` (it should redirect), a missing URL (it
   should show the 404 page) and a live form submission.
2. Send a test email to `contact@radaai.ai` from an outside address, and reply from it. This
   confirms mail still flows both ways.
3. Wait about 48 hours for DNS caches to expire, then delete the site in Netlify. If Netlify DNS
   was in use, also remove the `radaai.ai` DNS zone there.

### Optional hardening once live

- **Cloudflare Turnstile** (free) on the diagnostic form gives stronger bot protection than the
  honeypot. It needs a site key in the form and a verification step added to the Apps Script.
- **Web Analytics** (Cloudflare, cookie-free) or GA4. GA4 needs the cookie banner to gate it.
