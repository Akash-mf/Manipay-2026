/**
 * ManiPay — contact form → WhatsApp notification (runs on Railway via server.js; also works as a Vercel function)
 * POST /api/enquiries   { name, phone, email, service, message, consent, website }
 *
 * Sends each enquiry to your WhatsApp through CallMeBot (free, for messages to your own number).
 * Environment variables (Railway → your service → Variables, and .env for local):
 *   CALLMEBOT_PHONE      your WhatsApp number with country code, e.g. 918122544657
 *   CALLMEBOT_APIKEY     the API key CallMeBot sent to that number
 *   CALLMEBOT_PHONE_2    (optional) a second number to notify, e.g. 919363622627
 *   CALLMEBOT_APIKEY_2   (optional) that number's own CallMeBot API key
 */

function recipients() {
  const list = [];
  ['', '_2', '_3'].forEach(function (s) {
    const phone = (process.env['CALLMEBOT_PHONE' + s] || '').replace(/\D/g, '');
    const key = (process.env['CALLMEBOT_APIKEY' + s] || '').trim();
    if (phone && key) list.push({ phone: phone, key: key });
  });
  return list;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) {
    raw = await new Promise(function (resolve, reject) {
      let data = '';
      req.on('data', function (c) { data += c; if (data.length > 20000) req.destroy(); });
      req.on('end', function () { resolve(data); });
      req.on('error', reject);
    });
  }
  const type = String(req.headers['content-type'] || '');
  if (type.indexOf('application/x-www-form-urlencoded') !== -1) return Object.fromEntries(new URLSearchParams(raw));
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}

const clean = function (v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); };

function validate(b) {
  let phone = String(b.phone || '').replace(/\D/g, '');
  if (phone.length === 12 && phone.indexOf('91') === 0) phone = phone.slice(2);
  if (phone.length === 11 && phone[0] === '0') phone = phone.slice(1);
  const f = {
    name: clean(b.name, 80),
    phone: phone,
    email: clean(b.email, 120),
    service: clean(b.service, 120),
    message: String(b.message || '').trim().slice(0, 1200)
  };
  const errors = [];
  if (f.name.length < 2) errors.push('name');
  if (!/^[6-9]\d{9}$/.test(f.phone)) errors.push('phone');
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errors.push('email');
  if (!f.service) errors.push('service');
  if (f.message.length < 10) errors.push('message');
  if (!b.consent) errors.push('consent');
  return { fields: f, errors: errors };
}

function buildMessage(f) {
  const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  return [
    '🔔 *New enquiry — ManiPay website*',
    '',
    '*Name:* ' + f.name,
    '*Phone:* +91 ' + f.phone.slice(0, 5) + ' ' + f.phone.slice(5),
    f.email ? '*Email:* ' + f.email : null,
    '*Service:* ' + f.service,
    '*Message:* ' + f.message,
    '',
    '💬 Reply on WhatsApp: https://wa.me/91' + f.phone,
    '🕒 ' + when + ' IST'
  ].filter(function (l) { return l !== null; }).join('\n');
}

async function sendWhatsApp(to, text) {
  const url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(to.phone) +
    '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(to.key);
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 9000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const body = await r.text();
    if (!r.ok || /(invalid|error|not allowed|blocked|wrong)/i.test(body)) {
      throw new Error('CallMeBot ' + r.status + ': ' + body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160));
    }
    return true;
  } finally { clearTimeout(timer); }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Use POST' });
    return;
  }

  const body = await readBody(req);
  if (body.website) { res.status(200).json({ ok: true }); return; } // spam bot filled the hidden field

  const v = validate(body);
  if (v.errors.length) { res.status(400).json({ ok: false, error: 'Please check the form.', fields: v.errors }); return; }

  const to = recipients();
  if (!to.length) {
    console.error('Enquiry not delivered: CALLMEBOT_PHONE / CALLMEBOT_APIKEY are not set.', v.fields);
    res.status(503).json({ ok: false, error: 'Notifications are not configured.' });
    return;
  }

  const text = buildMessage(v.fields);
  const results = await Promise.allSettled(to.map(function (t) { return sendWhatsApp(t, text); }));
  const sent = results.filter(function (r) { return r.status === 'fulfilled'; }).length;
  results.forEach(function (r, i) { if (r.status === 'rejected') console.error('WhatsApp to ' + to[i].phone + ' failed:', r.reason.message); });

  if (!sent) {
    console.error('Enquiry not delivered:', v.fields);
    res.status(502).json({ ok: false, error: 'Could not send the enquiry right now.' });
    return;
  }
  res.status(200).json({ ok: true });
};
