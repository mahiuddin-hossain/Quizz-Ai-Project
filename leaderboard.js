/* ================================================
   leaderboard.js — QuizAI Leaderboard Page
   ================================================ */

'use strict';

const API = 'http://localhost:3000/api';

/* ── Language ── */
const T = {
  bn: {
    page_title:   'লিডারবোর্ড',
    page_sub:     'সেরা শিক্ষার্থীদের র‍্যাংকিং',
    my_pos:       'তোমার বর্তমান অবস্থান',
    points_lbl:   'পয়েন্ট',
    table_title:  'সম্পূর্ণ র‍্যাংকিং',
    quizzes_lbl:  'টি কুইজ',
    accuracy_lbl: 'নির্ভুলতা',
    empty_msg:    'এখনো কেউ কুইজ দেয়নি। প্রথম হওয়ার সুযোগ তোমার!',
    error_msg:    'লোড করা যায়নি। সার্ভার চালু আছে কিনা দেখো।',
    you_suffix:   ' (তুমি)',
    rank_suffix:  'তম',
    medals:       ['🥇','🥈','🥉'],
  },
  en: {
    page_title:   'Leaderboard',
    page_sub:     'Top students ranked by points',
    my_pos:       'Your current position',
    points_lbl:   'Points',
    table_title:  'Full Ranking',
    quizzes_lbl:  ' quizzes',
    accuracy_lbl: 'Accuracy',
    empty_msg:    'No one has taken a quiz yet. Be the first!',
    error_msg:    'Failed to load. Check if the server is running.',
    you_suffix:   ' (You)',
    rank_suffix:  '',
    medals:       ['🥇','🥈','🥉'],
  },
};

let currentLang = 'bn';
let currentUser = null;

/* ── Init ── */
window.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadLeaderboard();
});

function checkAuth() {
  const raw = localStorage.getItem('quizai_user');
  if (!raw) { window.location.href = 'auth.html'; return; }
  try { currentUser = JSON.parse(raw); }
  catch { window.location.href = 'auth.html'; }
}

/* ── Language ── */
function setLang(lang) {
  currentLang = lang;
  document.getElementById('btn-bn').classList.toggle('active', lang === 'bn');
  document.getElementById('btn-en').classList.toggle('active', lang === 'en');
  applyLang();
  loadLeaderboard();
}

function applyLang() {
  const t = T[currentLang];
  document.getElementById('page-title').textContent   = t.page_title;
  document.getElementById('page-sub').textContent     = t.page_sub;
  document.getElementById('table-title').textContent  = t.table_title;
  document.getElementById('my-rank-sub').textContent  = t.my_pos;
  document.getElementById('my-rank-pts-lbl').textContent = t.points_lbl;
}

/* ── Load Leaderboard ── */
async function loadLeaderboard() {
  const t = T[currentLang];

  /* Show skeleton */
  document.getElementById('skeleton-wrap').style.display = 'flex';
  document.getElementById('lb-list').innerHTML           = '';
  document.getElementById('empty-state').style.display  = 'none';
  document.getElementById('error-state').style.display  = 'none';
  document.getElementById('podium-wrap').innerHTML       = '';
  document.getElementById('my-rank-banner').style.display = 'none';

  if (!currentUser?.token) {
    showError();
    return;
  }

  try {
    const res  = await fetch(`${API}/leaderboard`, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` },
    });
    const data = await res.json();

    document.getElementById('skeleton-wrap').style.display = 'none';

    if (!data.success) { showError(); return; }

    const { leaderboard, myRank } = data;

    /* My rank banner */
    if (myRank) {
      document.getElementById('my-rank-banner').style.display = 'flex';
      document.getElementById('my-rank-pos').textContent  = `#${myRank.rank}`;
      document.getElementById('my-rank-name').textContent = myRank.name;
      document.getElementById('my-rank-pts').textContent  = myRank.points;
    }

    if (!leaderboard.length) {
      document.getElementById('empty-msg').textContent     = t.empty_msg;
      document.getElementById('empty-state').style.display = 'block';
      return;
    }

    /* Table meta */
    document.getElementById('table-meta').textContent =
      currentLang === 'bn'
        ? `${leaderboard.length} জন শিক্ষার্থী`
        : `${leaderboard.length} students`;

    /* Podium (top 3) */
    renderPodium(leaderboard.slice(0, 3));

    /* Full list */
    renderList(leaderboard);

  } catch (err) {
    console.error('Leaderboard error:', err);
    document.getElementById('skeleton-wrap').style.display = 'none';
    showError();
  }
}

function showError() {
  const t = T[currentLang];
  document.getElementById('error-msg').textContent    = t.error_msg;
  document.getElementById('error-state').style.display = 'block';
}

/* ── Podium ── */
function renderPodium(top) {
  const t    = T[currentLang];
  const wrap = document.getElementById('podium-wrap');
  wrap.innerHTML = '';

  /*
   * Visual order: 2nd | 1st | 3rd
   * We render in this order for the classic podium look.
   */
  const order = [
    top[1] ? { ...top[1], displayRank: 2 } : null,
    top[0] ? { ...top[0], displayRank: 1 } : null,
    top[2] ? { ...top[2], displayRank: 3 } : null,
  ].filter(Boolean);

  order.forEach(user => {
    const r       = user.displayRank;
    const initial = (user.name || '?')[0].toUpperCase();
    const isMe    = currentUser && user.userId === currentUser.id;
    const medal   = t.medals[r - 1] || '';

    const item = document.createElement('div');
    item.className = `podium-item rank-${r}`;
    item.innerHTML = `
      <div class="podium-avatar-wrap">
        <div class="podium-avatar">${initial}</div>
        <span class="podium-medal">${medal}</span>
      </div>
      <div class="podium-name">${escHtml(user.name)}${isMe ? ' ★' : ''}</div>
      <div class="podium-pts">${user.points}</div>
      <div class="podium-qlbl">${user.quizCount}${t.quizzes_lbl}</div>
      <div class="podium-block">${r}</div>
    `;
    wrap.appendChild(item);
  });
}

/* ── Full List ── */
function renderList(leaderboard) {
  const t    = T[currentLang];
  const list = document.getElementById('lb-list');
  list.innerHTML = '';

  leaderboard.forEach((user, idx) => {
    const isMe    = currentUser && user.userId === currentUser.id;
    const initial = (user.name || '?')[0].toUpperCase();
    const acc     = parseFloat(user.avgAccuracy) || 0;

    /* Rank display */
    let rankDisplay;
    if      (user.rank === 1) rankDisplay = '🥇';
    else if (user.rank === 2) rankDisplay = '🥈';
    else if (user.rank === 3) rankDisplay = '🥉';
    else                      rankDisplay = `#${user.rank}`;

    /* Accuracy chip */
    const accClass = acc >= 70 ? 'acc-high' : acc >= 45 ? 'acc-mid' : 'acc-low';
    const accText  = `${acc}%`;

    /* Row class */
    let rowClass = '';
    if (user.rank <= 3) rowClass = `top-${user.rank}`;
    if (isMe)           rowClass += ' is-me';

    /* Quiz count label */
    const quizLabel = currentLang === 'bn'
      ? `${user.quizCount}টি কুইজ`
      : `${user.quizCount} quizzes`;

    const row = document.createElement('div');
    row.className = `lb-row ${rowClass.trim()}`;
    row.style.animationDelay = (idx * 0.04) + 's';

    row.innerHTML = `
      <div class="lb-rank">${rankDisplay}</div>
      <div class="lb-avatar">${initial}</div>
      <div class="lb-info">
        <div class="lb-name">
          ${escHtml(user.name)}${isMe ? `<span style="color:var(--purple);font-size:12px;margin-left:6px">${currentLang === 'bn' ? '(তুমি)' : '(You)'}</span>` : ''}
        </div>
        <div class="lb-meta">${quizLabel}</div>
      </div>
      <div class="lb-accuracy ${accClass}">${accText}</div>
      <div class="lb-points-wrap">
        <div class="lb-points">${user.points}</div>
        <div class="lb-pts-lbl">${t.points_lbl}</div>
      </div>
    `;

    list.appendChild(row);
  });
}

/* ── Helper ── */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}