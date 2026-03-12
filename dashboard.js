/* =========================================================
   dashboard.js — QuizAI Dashboard
   Updated:
     • Avg score badge → Quiz Points (1 point per quiz)
     • Recent history items: click → quiz-review.html
     • Loads history from backend (my-results) with fallback to localStorage
   ========================================================= */

const API = 'http://localhost:3000/api';

/* ===== LANGUAGE DATA ===== */
const T = {
  bn: {
    greeting: '👋 স্বাগতম,',
    ready_text: ' আজকে কী পড়বে?',
    welcome_sub: 'তোমার পছন্দের ক্যাটাগরি ও সাবজেক্ট বেছে নাও, AI বাকি কাজ করবে।',
    day_streak: 'দিনের ধারা',
    quizzes_done: 'কুইজ সম্পন্ন',
    quiz_points: 'কুইজ পয়েন্ট',          // ← changed
    total_quizzes: 'মোট কুইজ',
    avg_score_label: 'গড় স্কোর',
    day_streak_label: 'দিনের ধারা',
    time_spent: 'সময় ব্যয়',
    quiz_points_label: 'কুইজ পয়েন্ট',    // ← changed
    choose_category: 'ক্যাটাগরি বেছে নাও',
    choose_category_sub: 'তোমার পরীক্ষার ধরন সিলেক্ট করো',
    tab_ssc: 'SSC প্রস্তুতি', tab_ssc_sub: 'মাধ্যমিক পরীক্ষা',
    tab_hsc: 'HSC প্রস্তুতি', tab_hsc_sub: 'উচ্চমাধ্যমিক পরীক্ষা',
    tab_medical: 'মেডিকেল ভর্তি', tab_medical_sub: 'MBBS ভর্তি পরীক্ষা',
    tab_university: 'বিশ্ববিদ্যালয় ভর্তি', tab_university_sub: 'পাবলিক বিশ্ববিদ্যালয়',
    choose_subject: 'সাবজেক্ট বেছে নাও',
    choose_subject_sub: 'যে বিষয়ে কুইজ দিতে চাও সেটি ক্লিক করো',
    custom_prompt_label: 'কাস্টম নির্দেশনা দাও',
    optional: 'ঐচ্ছিক',
    quick_hints: 'দ্রুত নির্দেশনা:',
    question_count: 'প্রশ্নের সংখ্যা',
    difficulty: 'কঠিনতার স্তর',
    easy: 'সহজ', medium: 'মাঝারি', hard: 'কঠিন',
    cancel: 'বাতিল', generate: 'কুইজ তৈরি করো',
    recent_history: 'সাম্প্রতিক কুইজ',
    see_all: 'সব দেখো →',
    no_history: 'এখনো কোনো কুইজ দেওয়া হয়নি। শুরু করো!',
    profile: 'প্রোফাইল', my_results: 'আমার ফলাফল',
    settings: 'সেটিংস', logout: 'লগ-আউট',
    subject_count_suffix: 'টি বিষয়',
    click_review: 'পর্যালোচনা দেখতে ক্লিক করো',   // tooltip
    points_suffix: 'পয়েন্ট',
    hints: {
      ssc: ['সহজ প্রশ্ন দাও', 'সূত্র ভিত্তিক', 'ধারণামূলক প্রশ্ন', 'বিগত বোর্ড প্রশ্ন'],
      hsc: ['কঠিন প্রশ্ন দাও', 'গুরুত্বপূর্ণ অধ্যায়', 'মিশ্র টপিক', 'সৃজনশীল ধাঁচে'],
      medical: ['জীববিজ্ঞান ফোকাস', 'রাসায়নিক বিক্রিয়া', 'ভর্তি পরীক্ষার ধাঁচে', 'কঠিন স্তর'],
      university: ['বিশ্লেষণমূলক', 'বিগত বছরের ধাঁচে', 'মিশ্র কঠিনতা', 'দ্রুত সমাধান'],
    },
    subjects: {
      ssc: [
        { icon:'🔬', name:'সাধারণ বিজ্ঞান',     count:'২০টি অধ্যায়' },
        { icon:'📐', name:'গণিত',               count:'১৮টি অধ্যায়' },
        { icon:'🌍', name:'ভূগোল ও পরিবেশ',     count:'১২টি অধ্যায়' },
        { icon:'📜', name:'বাংলাদেশ ও বিশ্বপরিচয়',count:'১৫টি অধ্যায়' },
        { icon:'🧪', name:'রসায়ন',              count:'১৪টি অধ্যায়' },
        { icon:'⚡', name:'পদার্থবিজ্ঞান',       count:'১৬টি অধ্যায়' },
        { icon:'🌿', name:'জীববিজ্ঞান',          count:'১৪টি অধ্যায়' },
        { icon:'📝', name:'বাংলা',               count:'১০টি অধ্যায়' },
      ],
      hsc: [
        { icon:'⚡', name:'পদার্থবিজ্ঞান ১ম পত্র', count:'২২টি অধ্যায়' },
        { icon:'⚡', name:'পদার্থবিজ্ঞান ২য় পত্র', count:'২০টি অধ্যায়' },
        { icon:'🧪', name:'রসায়ন ১ম পত্র',        count:'১৮টি অধ্যায়' },
        { icon:'🧪', name:'রসায়ন ২য় পত্র',        count:'১৬টি অধ্যায়' },
        { icon:'🔬', name:'জীববিজ্ঞান ১ম পত্র',    count:'২০টি অধ্যায়' },
        { icon:'🔬', name:'জীববিজ্ঞান ২য় পত্র',    count:'১৮টি অধ্যায়' },
        { icon:'📐', name:'গণিত ১ম পত্র',          count:'২৪টি অধ্যায়' },
        { icon:'💻', name:'তথ্য ও যোগাযোগ',         count:'১০টি অধ্যায়' },
      ],
      medical: [
        { icon:'🔬', name:'জীববিজ্ঞান',        count:'৩০টি অধ্যায়' },
        { icon:'🧪', name:'রসায়ন',             count:'২৫টি অধ্যায়' },
        { icon:'⚡', name:'পদার্থবিজ্ঞান',      count:'২০টি অধ্যায়' },
        { icon:'📐', name:'গণিত',              count:'১৫টি অধ্যায়' },
        { icon:'🌿', name:'উদ্ভিদবিজ্ঞান',     count:'১২টি অধ্যায়' },
        { icon:'🫀', name:'প্রাণীবিজ্ঞান',     count:'১৪টি অধ্যায়' },
      ],
      university: [
        { icon:'📐', name:'গণিত',            count:'২৮টি অধ্যায়' },
        { icon:'📝', name:'বাংলা',            count:'২০টি অধ্যায়' },
        { icon:'🔤', name:'ইংরেজি',           count:'২২টি অধ্যায়' },
        { icon:'🔬', name:'সাধারণ বিজ্ঞান',  count:'১৮টি অধ্যায়' },
        { icon:'🌍', name:'সাধারণ জ্ঞান',    count:'২৫টি অধ্যায়' },
        { icon:'💻', name:'আইসিটি',           count:'১০টি অধ্যায়' },
      ],
    },
  },
  en: {
    greeting: '👋 Welcome back,',
    ready_text: ' What will you study today?',
    welcome_sub: 'Choose your category and subject — AI will handle the rest.',
    day_streak: 'Day Streak',
    quizzes_done: 'Quizzes Done',
    quiz_points: 'Quiz Points',               // ← changed
    total_quizzes: 'Total Quizzes',
    avg_score_label: 'Average Score',
    day_streak_label: 'Day Streak',
    time_spent: 'Time Spent',
    quiz_points_label: 'Quiz Points',         // ← changed
    choose_category: 'Choose Category',
    choose_category_sub: 'Select your exam type',
    tab_ssc: 'SSC Preparation', tab_ssc_sub: 'Secondary Exam',
    tab_hsc: 'HSC Preparation', tab_hsc_sub: 'Higher Secondary Exam',
    tab_medical: 'Medical Admission', tab_medical_sub: 'MBBS Entrance',
    tab_university: 'University Admission', tab_university_sub: 'Public Universities',
    choose_subject: 'Choose Subject',
    choose_subject_sub: 'Click the subject you want to practice',
    custom_prompt_label: 'Custom Instructions',
    optional: 'Optional',
    quick_hints: 'Quick hints:',
    question_count: 'Question Count',
    difficulty: 'Difficulty Level',
    easy: 'Easy', medium: 'Medium', hard: 'Hard',
    cancel: 'Cancel', generate: 'Generate Quiz',
    recent_history: 'Recent Quizzes',
    see_all: 'See all →',
    no_history: 'No quizzes yet. Start now!',
    profile: 'Profile', my_results: 'My Results',
    settings: 'Settings', logout: 'Logout',
    subject_count_suffix: ' subjects',
    click_review: 'Click to review',
    points_suffix: 'pts',
    hints: {
      ssc: ['Easy questions', 'Formula-based', 'Conceptual only', 'Board exam style'],
      hsc: ['Hard level', 'Important chapters', 'Mixed topics', 'Creative style'],
      medical: ['Biology focus', 'Chemical reactions', 'Admission style', 'Hard level'],
      university: ['Analytical', 'Previous year style', 'Mixed difficulty', 'Quick solve'],
    },
    subjects: {
      ssc: [
        { icon:'🔬', name:'General Science',    count:'20 chapters' },
        { icon:'📐', name:'Mathematics',        count:'18 chapters' },
        { icon:'🌍', name:'Geography',          count:'12 chapters' },
        { icon:'📜', name:'Bangladesh Studies', count:'15 chapters' },
        { icon:'🧪', name:'Chemistry',          count:'14 chapters' },
        { icon:'⚡', name:'Physics',            count:'16 chapters' },
        { icon:'🌿', name:'Biology',            count:'14 chapters' },
        { icon:'📝', name:'Bangla',             count:'10 chapters' },
      ],
      hsc: [
        { icon:'⚡', name:'Physics 1st Paper',   count:'22 chapters' },
        { icon:'⚡', name:'Physics 2nd Paper',   count:'20 chapters' },
        { icon:'🧪', name:'Chemistry 1st Paper', count:'18 chapters' },
        { icon:'🧪', name:'Chemistry 2nd Paper', count:'16 chapters' },
        { icon:'🔬', name:'Biology 1st Paper',   count:'20 chapters' },
        { icon:'🔬', name:'Biology 2nd Paper',   count:'18 chapters' },
        { icon:'📐', name:'Mathematics 1st',     count:'24 chapters' },
        { icon:'💻', name:'ICT',                 count:'10 chapters' },
      ],
      medical: [
        { icon:'🔬', name:'Biology',     count:'30 chapters' },
        { icon:'🧪', name:'Chemistry',   count:'25 chapters' },
        { icon:'⚡', name:'Physics',     count:'20 chapters' },
        { icon:'📐', name:'Mathematics', count:'15 chapters' },
        { icon:'🌿', name:'Botany',      count:'12 chapters' },
        { icon:'🫀', name:'Zoology',     count:'14 chapters' },
      ],
      university: [
        { icon:'📐', name:'Mathematics',       count:'28 chapters' },
        { icon:'📝', name:'Bangla',            count:'20 chapters' },
        { icon:'🔤', name:'English',           count:'22 chapters' },
        { icon:'🔬', name:'General Science',   count:'18 chapters' },
        { icon:'🌍', name:'General Knowledge', count:'25 chapters' },
        { icon:'💻', name:'ICT',               count:'10 chapters' },
      ],
    },
  },
};

/* ===== STATE ===== */
let currentLang     = 'bn';
let currentCat      = 'ssc';
let selectedSubject = null;
let questionCount   = 20;
let difficulty      = 'medium';
let userStats       = { total: 0, points: 0, streak: 0, timeSpent: 0 };
let quizHistory     = [];

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  spawnParticles();
  renderSubjects('ssc');
  loadHistory();
  applyLang();
  document.addEventListener('click', closeDropdownOutside);
});

/* ===== AUTH CHECK ===== */
function checkAuth() {
  const raw = localStorage.getItem('quizai_user');
  if (!raw) { window.location.href = 'auth.html'; return; }

  try {
    const user = JSON.parse(raw);
    setUserUI(user);
    fetchProfile(user);
  } catch {
    localStorage.removeItem('quizai_user');
    window.location.href = 'auth.html';
  }
}

function setUserUI(user) {
  const initial = (user.name || 'S')[0].toUpperCase();
  document.getElementById('nav-avatar').textContent   = initial;
  document.getElementById('nav-username').textContent = user.name || 'Student';
  document.getElementById('drop-avatar').textContent  = initial;
  document.getElementById('drop-name').textContent    = user.name || 'Student';
  document.getElementById('drop-email').textContent   = user.email || '';
  document.getElementById('welcome-name').textContent = user.name || 'Student';
}

async function fetchProfile(user) {
  if (!user.token) return;
  try {
    const res  = await fetch(`${API}/profile`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    });
    const data = await res.json();
    if (data.success) {
      setUserUI(data.user);
      const stored = JSON.parse(localStorage.getItem('quizai_user') || '{}');
      localStorage.setItem('quizai_user', JSON.stringify({ ...stored, ...data.user }));
    }
  } catch { /* server may be off; ignore */ }
}

/* ===== LOGOUT ===== */
function doLogout() {
  localStorage.removeItem('quizai_user');
  window.location.href = 'auth.html';
}

/* ===== LANGUAGE ===== */
function setLang(lang) {
  currentLang = lang;
  document.getElementById('btn-bn').classList.toggle('active', lang === 'bn');
  document.getElementById('btn-en').classList.toggle('active', lang === 'en');
  applyLang();
  renderSubjects(currentCat);
  renderHistory();
}

function applyLang() {
  const t = T[currentLang];
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.getAttribute('data-key');
    if (t[key] !== undefined) el.textContent = t[key];
  });
  document.getElementById('custom-prompt').placeholder =
    currentLang === 'bn'
      ? 'যেমন: কোষ বিভাজন থেকে কঠিন প্রশ্ন দাও...'
      : 'e.g. Give hard questions on cell division...';

  const mins = Math.round(userStats.timeSpent / 60);
  document.getElementById('stat-time').textContent =
    currentLang === 'bn' ? `${mins}মি` : `${mins}m`;

  /* Points badge in welcome row */
  const pointsEl = document.getElementById('points-count');
  if (pointsEl) pointsEl.textContent = userStats.points;
}

/* ===== USER DROPDOWN ===== */
function toggleUserDropdown() {
  const dd   = document.getElementById('user-dropdown');
  const ch   = document.getElementById('user-chevron');
  const open = dd.classList.toggle('open');
  ch.classList.toggle('open', open);
}

function closeDropdownOutside(e) {
  if (!document.getElementById('user-menu').contains(e.target)) {
    document.getElementById('user-dropdown').classList.remove('open');
    document.getElementById('user-chevron').classList.remove('open');
  }
}

/* ===== CATEGORY SELECTION ===== */
function selectCategory(cat, btn) {
  currentCat = cat;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderSubjects(cat);
}

/* ===== RENDER SUBJECTS ===== */
function renderSubjects(cat) {
  const subjects = T[currentLang].subjects[cat] || [];
  const grid     = document.getElementById('subjects-grid');
  const badge    = document.getElementById('subject-count-badge');

  const countText = currentLang === 'bn'
    ? `${toBengaliNum(subjects.length)}${T.bn.subject_count_suffix}`
    : `${subjects.length}${T.en.subject_count_suffix}`;
  badge.textContent = countText;

  grid.innerHTML = '';
  subjects.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.style.animationDelay = (i * 0.06) + 's';
    card.innerHTML = `
      <div class="subject-card-arrow">→</div>
      <span class="subject-card-icon">${s.icon}</span>
      <div class="subject-card-name">${s.name}</div>
      <div class="subject-card-count">${s.count}</div>
    `;
    card.addEventListener('click', () => openModal(s, cat));
    grid.appendChild(card);
  });
}

/* ===== BENGALI NUMBER HELPER ===== */
function toBengaliNum(n) {
  const map = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
  return String(n).split('').map(d => map[+d] ?? d).join('');
}

/* ===== MODAL ===== */
function openModal(subject, cat) {
  selectedSubject = { ...subject, cat };

  document.getElementById('modal-icon').textContent         = subject.icon;
  document.getElementById('modal-subject-name').textContent = subject.name;

  const catNames = {
    ssc: T[currentLang].tab_ssc, hsc: T[currentLang].tab_hsc,
    medical: T[currentLang].tab_medical, university: T[currentLang].tab_university,
  };
  document.getElementById('modal-cat-label').textContent = catNames[cat] || cat.toUpperCase();
  document.getElementById('custom-prompt').value = '';

  const hints   = T[currentLang].hints[cat] || [];
  const chipsEl = document.getElementById('hint-chips');
  chipsEl.innerHTML = '';
  hints.forEach(h => {
    const chip  = document.createElement('button');
    chip.className   = 'hint-chip';
    chip.textContent = h;
    chip.onclick = () => { document.getElementById('custom-prompt').value = h; };
    chipsEl.appendChild(chip);
  });

  resetSettingOpts('q-count-options', 1);
  resetSettingOpts('diff-options', 1);
  questionCount = 20;
  difficulty    = 'medium';

  document.getElementById('prompt-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('prompt-modal').classList.remove('open');
}

function resetSettingOpts(containerId, activeIndex) {
  const btns = document.querySelectorAll(`#${containerId} .setting-opt`);
  btns.forEach((b, i) => b.classList.toggle('active', i === activeIndex));
}

/* ===== SETTINGS SELECTION ===== */
function selectQCount(count, btn) {
  questionCount = count;
  document.querySelectorAll('#q-count-options .setting-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function selectDiff(diff, btn) {
  difficulty = diff;
  document.querySelectorAll('#diff-options .setting-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ===== GO TO QUIZ PAGE ===== */
function goToQuiz() {
  if (!selectedSubject) return;

  const customPrompt = document.getElementById('custom-prompt').value.trim();

  sessionStorage.setItem('quizConfig', JSON.stringify({
    subject:      selectedSubject,
    category:     currentCat,
    lang:         currentLang,
    questionCount,
    difficulty,
    customPrompt,
  }));

  closeModal();
  window.location.href = 'quiz.html';
}

document.getElementById('prompt-modal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ═══════════════════════════════════════════════════════
   HISTORY — load from backend, fallback to localStorage
═══════════════════════════════════════════════════════ */
async function loadHistory() {
  /* Always show localStorage data first (instant) */
  try {
    const stored = JSON.parse(localStorage.getItem('quizai_history') || '[]');
    quizHistory  = stored;
    updateStats();
    renderHistory();
  } catch { quizHistory = []; }

  /* Then try to sync from backend */
  const userRaw = localStorage.getItem('quizai_user');
  if (!userRaw) return;
  const user = JSON.parse(userRaw);
  if (!user.token) return;

  try {
    const res  = await fetch(`${API}/my-results`, {
      headers: { 'Authorization': `Bearer ${user.token}` },
    });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.results)) return;

    /* Merge: backend rows → history format */
    quizHistory = data.results.map(r => ({
      dbId:          r.id,
      subjectName:   r.subject_name,
      icon:          r.subject_icon || '📝',
      category:      r.category,
      lang:          r.lang || 'bn',
      difficulty:    r.difficulty || 'medium',
      questionCount: r.total,
      correct:       r.score,            // correct answer count = points earned
      pct:           r.percentage / 100,
      timeTaken:     r.time_taken,
      date:          r.created_at,
      // questions / userAnswers NOT included here (fetched on demand)
    }));

    /* Overwrite local cache with fresh server data */
    localStorage.setItem('quizai_history', JSON.stringify(quizHistory));
    updateStats();
    renderHistory();
  } catch { /* server offline – keep localStorage version */ }
}

/* ===== STATS — points = total correct answers across all quizzes ===== */
function updateStats() {
  const total     = quizHistory.length;
  /* Sum of correct answers: each correct answer = 1 point */
  const points    = quizHistory.reduce((sum, h) => sum + (h.correct || 0), 0);
  const timeSpent = quizHistory.reduce((sum, h) => sum + (h.timeTaken || 0), 0);
  const streak    = Math.min(total, 7);

  userStats = { total, points, streak, timeSpent };

  /* Stat cards */
  document.getElementById('stat-total').textContent  = total;
  document.getElementById('stat-avg').textContent    = points + (currentLang === 'bn' ? ' পয়েন্ট' : ' pts');
  document.getElementById('stat-streak').textContent = streak;
  const mins = Math.round(timeSpent / 60);
  document.getElementById('stat-time').textContent   = currentLang === 'bn' ? `${mins}মি` : `${mins}m`;

  /* Welcome badges */
  document.getElementById('streak-count').textContent = streak;
  document.getElementById('quiz-count').textContent   = total;

  /* Points badge — id="points-count" in welcome-badge */
  const ptEl = document.getElementById('points-count');
  if (ptEl) ptEl.textContent = points;
}

/* ═══════════════════════════════════════════════════════
   RENDER HISTORY — clickable items → quiz review page
═══════════════════════════════════════════════════════ */
function renderHistory() {
  const listEl  = document.getElementById('history-list');
  const emptyEl = document.getElementById('history-empty');

  if (!quizHistory.length) {
    listEl.innerHTML = '';
    listEl.appendChild(emptyEl);
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.innerHTML = '';

  const t = T[currentLang];

  /* Show last 5, newest first */
  [...quizHistory].reverse().slice(0, 5).forEach((h, i) => {
    const pct        = Math.round((h.pct || 0) * 100);
    const scoreClass = pct >= 70 ? 'good' : pct >= 45 ? 'avg' : 'poor';
    const catName    = t['tab_' + h.category] || h.category;
    const dateStr    = h.date
      ? new Date(h.date).toLocaleDateString(currentLang === 'bn' ? 'bn-BD' : 'en-US',
          { month: 'short', day: 'numeric' })
      : '';

    const item = document.createElement('div');
    item.className = 'history-item';
    item.style.animationDelay = (i * 0.07) + 's';
    item.title = t.click_review;

    /* Clickable cursor */
    item.style.cursor = 'pointer';

    item.innerHTML = `
      <div class="history-icon">${h.icon || '📝'}</div>
      <div class="history-info">
        <div class="history-subject">${h.subjectName}</div>
        <div class="history-meta">${catName} · ${h.questionCount || 20} ${currentLang === 'bn' ? 'প্রশ্ন' : 'questions'} · ${dateStr}</div>
      </div>
      <div class="history-score ${scoreClass}">${pct}%</div>
      <div class="history-review-arrow">›</div>
    `;

    /* Click → open review */
    item.addEventListener('click', () => openReview(h));
    listEl.appendChild(item);
  });
}

/* ═══════════════════════════════════════════════════════
   OPEN REVIEW — fetch full data then navigate
═══════════════════════════════════════════════════════ */
async function openReview(h) {
  /* If we have a DB id, fetch full data (questions + answers) from server */
  if (h.dbId) {
    const userRaw = localStorage.getItem('quizai_user');
    const user    = userRaw ? JSON.parse(userRaw) : {};

    if (user.token) {
      try {
        const res  = await fetch(`${API}/result/${h.dbId}`, {
          headers: { 'Authorization': `Bearer ${user.token}` },
        });
        const data = await res.json();
        if (data.success && data.result) {
          /* Store full result for review page */
          sessionStorage.setItem('reviewData', JSON.stringify({
            ...data.result,
            subjectName:   data.result.subjectName,
            icon:          data.result.icon,
            category:      data.result.category,
            lang:          data.result.lang,
            difficulty:    data.result.difficulty,
            questionCount: data.result.total,
            correct:       data.result.score,
            pct:           data.result.percentage / 100,
            timeTaken:     data.result.timeTaken,
            date:          data.result.date,
            questions:     data.result.questions   || [],
            userAnswers:   data.result.userAnswers || [],
          }));
          window.location.href = 'quiz-review.html';
          return;
        }
      } catch { /* fallback to localStorage */ }
    }
  }

  /* Fallback: use whatever we have locally */
  sessionStorage.setItem('reviewData', JSON.stringify({
    subjectName:   h.subjectName,
    icon:          h.icon || '📝',
    category:      h.category,
    lang:          h.lang || currentLang,
    difficulty:    h.difficulty || 'medium',
    questionCount: h.questionCount || 20,
    correct:       h.correct || 0,
    pct:           h.pct    || 0,
    timeTaken:     h.timeTaken || 0,
    date:          h.date,
    questions:     h.questions    || [],
    userAnswers:   h.userAnswers  || [],
  }));
  window.location.href = 'quiz-review.html';
}

/* ===== PARTICLES ===== */
function spawnParticles() {
  const container = document.getElementById('particles');
  const colors    = ['#8b5cf6','#ec4899','#f97316','#06b6d4','#10b981'];
  for (let i = 0; i < 22; i++) {
    const el   = document.createElement('div');
    el.className = 'particle';
    const size = 2 + Math.random() * 5;
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      width: ${size}px; height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${10 + Math.random() * 16}s;
      animation-delay: ${Math.random() * 12}s;
    `;
    container.appendChild(el);
  }
}