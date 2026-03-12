/* =========================================================
   auth.js — Frontend Authentication Logic
   Connects to Express.js backend at http://localhost:3000
   ========================================================= */

const API = 'http://localhost:3000/api';

/* ---- Spawn floating particles ---- */
(function spawnParticles() {
  const container = document.getElementById('particles');
  const colors = ['#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#10b981'];
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    const size = 3 + Math.random() * 5;
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${8 + Math.random() * 14}s;
      animation-delay: ${Math.random() * 10}s;
    `;
    container.appendChild(el);
  }
})();

/* ---- Tab switching ---- */
function showTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('pane-register').style.display = isLogin ? 'none' : 'block';
  document.getElementById('pane-login').style.display    = isLogin ? 'block' : 'none';
  document.getElementById('tab-reg').classList.toggle('active', !isLogin);
  document.getElementById('tab-log').classList.toggle('active',  isLogin);
  document.getElementById('tab-slider').classList.toggle('to-login', isLogin);
  hideToast();
  clearAllErrors();
}

/* ---- Toggle password visibility ---- */
function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  const isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  btn.textContent = isText ? '👁️' : '🙈';
}

/* ---- Password strength checker ---- */
document.getElementById('reg-pass').addEventListener('input', function () {
  const val = this.value;
  const box = document.getElementById('pass-strength');
  const fill = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');

  if (!val) { box.style.display = 'none'; return; }
  box.style.display = 'flex';

  let strength = 0;
  if (val.length >= 6)  strength++;
  if (val.length >= 10) strength++;
  if (/[A-Z]/.test(val)) strength++;
  if (/[0-9]/.test(val)) strength++;
  if (/[^A-Za-z0-9]/.test(val)) strength++;

  const levels = [
    { w: '20%',  bg: '#ef4444', text: 'খুব দুর্বল',  color: '#ef4444' },
    { w: '40%',  bg: '#f97316', text: 'দুর্বল',       color: '#f97316' },
    { w: '60%',  bg: '#f59e0b', text: 'মোটামুটি',     color: '#f59e0b' },
    { w: '80%',  bg: '#10b981', text: 'ভালো',         color: '#10b981' },
    { w: '100%', bg: '#8b5cf6', text: 'শক্তিশালী ✓',  color: '#8b5cf6' },
  ];

  const idx = Math.min(strength - 1, 4);
  const lvl = levels[idx >= 0 ? idx : 0];
  fill.style.width = lvl.w;
  fill.style.background = lvl.bg;
  label.textContent = lvl.text;
  label.style.color = lvl.color;
});

/* ---- Toast notifications ---- */
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = (type === 'success' ? '✅ ' : '❌ ') + msg;
  t.className = 'toast ' + type;
}

function hideToast() {
  document.getElementById('toast').className = 'toast';
}

/* ---- Field error helpers ---- */
function setError(fieldId, errorId, msg) {
  const inp = document.getElementById(fieldId);
  inp.classList.add('has-error');
  inp.classList.remove('has-success');
  document.getElementById(errorId).textContent = msg;
}

function setSuccess(fieldId, errorId) {
  const inp = document.getElementById(fieldId);
  inp.classList.remove('has-error');
  inp.classList.add('has-success');
  document.getElementById(errorId).textContent = '';
}

function clearAllErrors() {
  ['reg-name','reg-email','reg-pass','reg-pass2','log-email','log-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('has-error','has-success'); }
  });
  ['err-reg-name','err-reg-email','err-reg-pass','err-reg-pass2',
   'err-log-email','err-log-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

/* ---- Button loading state ---- */
function setBtnLoading(btnId, loading) {
  const btn  = document.getElementById(btnId);
  const text = btn.querySelector('.btn-text');
  const load = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  text.style.display = loading ? 'none' : 'inline';
  load.style.display = loading ? 'flex' : 'none';
}

/* ---- Redirect with success animation ---- */
function showSuccessAndRedirect(title, msg, url) {
  document.getElementById('pane-register').style.display = 'none';
  document.getElementById('pane-login').style.display    = 'none';
  document.getElementById('tab-switch')?.remove?.();

  const pane  = document.getElementById('pane-success');
  pane.style.display = 'block';
  document.getElementById('success-title').textContent = title;
  document.getElementById('success-msg').textContent   = msg;

  /* Fill progress bar over 2s then redirect */
  const fill = document.getElementById('progress-fill');
  fill.style.transition = 'width 2s linear';
  requestAnimationFrame(() => { fill.style.width = '100%'; });

  setTimeout(() => { window.location.href = url; }, 2200);
}

/* ---- Save session (simple localStorage wrapper) ---- */
function saveSession(user) {
  localStorage.setItem('quizai_user', JSON.stringify({
    id:    user.id,
    name:  user.name,
    email: user.email,
    token: user.token || '',
  }));
}

/* =============================================
   REGISTER
   ============================================= */
async function doRegister() {
  clearAllErrors();
  hideToast();

  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;

  /* Client-side validation */
  let valid = true;

  if (!name || name.length < 2) {
    setError('reg-name', 'err-reg-name', 'নাম কমপক্ষে ২ অক্ষর হতে হবে।');
    valid = false;
  } else { setSuccess('reg-name', 'err-reg-name'); }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError('reg-email', 'err-reg-email', 'সঠিক ইমেইল ঠিকানা দাও।');
    valid = false;
  } else { setSuccess('reg-email', 'err-reg-email'); }

  if (!pass || pass.length < 6) {
    setError('reg-pass', 'err-reg-pass', 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।');
    valid = false;
  } else { setSuccess('reg-pass', 'err-reg-pass'); }

  if (pass !== pass2) {
    setError('reg-pass2', 'err-reg-pass2', 'পাসওয়ার্ড দুটি মিলছে না।');
    valid = false;
  } else if (pass2) { setSuccess('reg-pass2', 'err-reg-pass2'); }

  if (!valid) return;

  /* API call */
  setBtnLoading('reg-btn', true);
  try {
    const res  = await fetch(`${API}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password: pass }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      saveSession(data.user);
      showSuccessAndRedirect(
        'রেজিস্ট্রেশন সম্পন্ন! 🎉',
        'তোমার অ্যাকাউন্ট তৈরি হয়েছে। ড্যাশবোর্ডে যাওয়া হচ্ছে...',
        'dashboard.html'
      );
    } else {
      showToast(data.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।', 'error');
      if (data.field === 'email') setError('reg-email', 'err-reg-email', data.message);
    }
  } catch (err) {
    showToast('সার্ভারের সাথে সংযোগ করা যাচ্ছে না। সার্ভার চালু আছে কিনা দেখো।', 'error');
  } finally {
    setBtnLoading('reg-btn', false);
  }
}

/* =============================================
   LOGIN
   ============================================= */
async function doLogin() {
  clearAllErrors();
  hideToast();

  const email    = document.getElementById('log-email').value.trim();
  const password = document.getElementById('log-pass').value;
  const remember = document.getElementById('remember-me').checked;

  /* Client-side validation */
  let valid = true;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError('log-email', 'err-log-email', 'সঠিক ইমেইল ঠিকানা দাও।');
    valid = false;
  } else { setSuccess('log-email', 'err-log-email'); }

  if (!password) {
    setError('log-pass', 'err-log-pass', 'পাসওয়ার্ড দাও।');
    valid = false;
  } else { setSuccess('log-pass', 'err-log-pass'); }

  if (!valid) return;

  /* API call */
  setBtnLoading('log-btn', true);
  try {
    const res  = await fetch(`${API}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, remember }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      saveSession(data.user);
      showSuccessAndRedirect(
        'স্বাগতম, ' + data.user.name + '! 👋',
        'সফলভাবে লগ-ইন হয়েছে। ড্যাশবোর্ডে যাওয়া হচ্ছে...',
        'dashboard.html'
      );
    } else {
      showToast(data.message || 'ইমেইল বা পাসওয়ার্ড ভুল।', 'error');
      setError('log-pass', 'err-log-pass', 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।');
    }
  } catch (err) {
    showToast('সার্ভারের সাথে সংযোগ করা যাচ্ছে না। সার্ভার চালু আছে কিনা দেখো।', 'error');
  } finally {
    setBtnLoading('log-btn', false);
  }
}

/* ---- Enter key support ---- */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const regVisible = document.getElementById('pane-register').style.display !== 'none';
  if (regVisible) doRegister();
  else doLogin();
});

/* ---- Check if already logged in ---- */
(function checkSession() {
  const user = localStorage.getItem('quizai_user');
  if (user) {
    try {
      JSON.parse(user); // valid JSON
      window.location.href = 'dashboard.html';
    } catch (_) {
      localStorage.removeItem('quizai_user');
    }
  }
})();