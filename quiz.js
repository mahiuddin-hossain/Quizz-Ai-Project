/* =========================================================
   quiz.js — QuizAI Complete Quiz Mechanism
   Updated: Full quiz save (questions + userAnswers)
   ========================================================= */

const API = 'http://localhost:3000/api';

/* ===== LANGUAGE STRINGS ===== */
const L = {
  bn: {
    loading_title:   'কুইজ তৈরি হচ্ছে...',
    loading_sub:     'Groq AI তোমার জন্য প্রশ্ন সাজাচ্ছে',
    step1: 'বিষয় বিশ্লেষণ করা হচ্ছে...',
    step2: 'প্রশ্ন তৈরি করা হচ্ছে...',
    step3: 'কুইজ প্রস্তুত করা হচ্ছে...',
    quit_label: 'ছেড়ে যাও',
    seconds_left: 'সেকেন্ড বাকি',
    question_prefix: 'প্রশ্ন ',
    diff_easy: 'সহজ', diff_medium: 'মাঝারি', diff_hard: 'কঠিন',
    next_q: 'পরের প্রশ্ন',
    last_q: 'ফলাফল দেখো',
    correct_lbl: 'সঠিক', wrong_lbl: 'ভুল',
    skipped_lbl: 'বাদ', time_lbl: 'সময়',
    grade_excellent: '🏆 অসাধারণ!',
    grade_great:     '🎉 চমৎকার!',
    grade_good:      '👏 ভালো করেছ!',
    grade_average:   '📚 আরো পড়ো',
    grade_poor:      '💪 হাল ছেড়ো না!',
    msg_excellent: 'অবিশ্বাস্য! তুমি অত্যন্ত ভালো প্রস্তুত। এই ধারা বজায় রাখো।',
    msg_great:     'দারুণ পারফরম্যান্স! আর একটু অনুশীলন করলে পারফেক্ট হবে।',
    msg_good:      'ভালো করেছ! কিছু ভুল আছে, সেগুলো আবার দেখো।',
    msg_average:   'নিয়মিত পড়াশোনা করো, উন্নতি হবেই ইনশাআল্লাহ।',
    msg_poor:      'হতাশ হয়ো না! বিষয়গুলো পড়ে আবার চেষ্টা করো।',
    correct_answer: '✅ সঠিক উত্তর:',
    your_answer:    '❌ তোমার উত্তর:',
    skipped_answer: '⏭️ বাদ দিয়েছিলে',
    explanation:    '💡 ব্যাখ্যা:',
    review_title:   'উত্তর পর্যালোচনা',
    back_home:      'হোমে ফিরো',
    retry:          'আবার চেষ্টা',
    filter_all:     'সব',
    filter_wrong:   'ভুল',
    filter_correct: 'সঠিক',
    quit_modal_title: 'কুইজ ছেড়ে যাবে?',
    quit_modal_sub:   'তোমার অগ্রগতি হারিয়ে যাবে।',
    quit_cancel:      'থাকো',
    quit_confirm:     'হ্যাঁ, ছাড়ো',
    error_title:    'কুইজ লোড হয়নি',
    error_sub:      'সার্ভার চালু আছে কিনা দেখো এবং আবার চেষ্টা করো।',
    time_up:        'সময় শেষ!',
    option_letters: ['ক', 'খ', 'গ', 'ঘ'],
  },
  en: {
    loading_title:   'Generating quiz...',
    loading_sub:     'Groq AI is crafting questions for you',
    step1: 'Analyzing subject...',
    step2: 'Generating questions...',
    step3: 'Finalizing quiz...',
    quit_label: 'Quit',
    seconds_left: 'seconds left',
    question_prefix: 'Question ',
    diff_easy: 'Easy', diff_medium: 'Medium', diff_hard: 'Hard',
    next_q: 'Next Question',
    last_q: 'See Results',
    correct_lbl: 'Correct', wrong_lbl: 'Wrong',
    skipped_lbl: 'Skipped', time_lbl: 'Time',
    grade_excellent: '🏆 Excellent!',
    grade_great:     '🎉 Great!',
    grade_good:      '👏 Good Job!',
    grade_average:   '📚 Keep Practicing',
    grade_poor:      '💪 Try Harder!',
    msg_excellent: 'Outstanding! You are very well prepared. Keep it up!',
    msg_great:     'Great performance! A little more practice and you\'ll be perfect.',
    msg_good:      'Good job! Review the ones you got wrong.',
    msg_average:   'Keep studying consistently and you\'ll improve.',
    msg_poor:      'Don\'t give up! Read the material and try again.',
    correct_answer: '✅ Correct answer:',
    your_answer:    '❌ Your answer:',
    skipped_answer: '⏭️ You skipped this',
    explanation:    '💡 Explanation:',
    review_title:   'Review Answers',
    back_home:      'Back Home',
    retry:          'Retry Quiz',
    filter_all:     'All',
    filter_wrong:   'Wrong',
    filter_correct: 'Correct',
    quit_modal_title: 'Quit the quiz?',
    quit_modal_sub:   'Your progress will be lost.',
    quit_cancel:      'Stay',
    quit_confirm:     'Yes, quit',
    error_title:    'Quiz failed to load',
    error_sub:      'Check if the server is running and try again.',
    time_up:        'Time\'s up!',
    option_letters: ['A', 'B', 'C', 'D'],
  },
};

/* ===== STATE ===== */
let config         = null;
let questions      = [];
let currentIdx     = 0;
let userAnswers    = [];   // {selected: -1|index, correct: index, timeTaken: n}
let timerInterval  = null;
let timeLeft       = 30;
let questionStart  = 0;
let totalTimeTaken = 0;
let liveScore      = 0;
let lang           = 'bn';
let reviewFilter   = 'all';
let savedResultId  = null; // ← DB row id after save

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadConfig();
});

function checkAuth() {
  if (!localStorage.getItem('quizai_user')) {
    window.location.href = 'auth.html';
  }
}

function loadConfig() {
  const raw = sessionStorage.getItem('quizConfig');
  if (!raw) { window.location.href = 'dashboard.html'; return; }
  try {
    config = JSON.parse(raw);
    lang   = config.lang || 'bn';
    applyStaticLang();
    startLoadingSequence();
  } catch {
    window.location.href = 'dashboard.html';
  }
}

/* ===== APPLY STATIC LANGUAGE ===== */
function applyStaticLang() {
  const t = L[lang];
  document.getElementById('loading-title').textContent = t.loading_title;
  document.getElementById('loading-sub').textContent   = t.loading_sub;
  document.getElementById('step-1-text').textContent   = t.step1;
  document.getElementById('step-2-text').textContent   = t.step2;
  document.getElementById('step-3-text').textContent   = t.step3;
  document.getElementById('quit-label').textContent    = t.quit_label;
  document.getElementById('timer-label').textContent   = t.seconds_left;
  document.getElementById('review-title-lbl').textContent = t.review_title;
  document.getElementById('back-home-lbl').textContent = t.back_home;
  document.getElementById('retry-lbl').textContent     = t.retry;
  document.getElementById('rst-correct-lbl').textContent = t.correct_lbl;
  document.getElementById('rst-wrong-lbl').textContent    = t.wrong_lbl;
  document.getElementById('rst-skipped-lbl').textContent  = t.skipped_lbl;
  document.getElementById('rst-time-lbl').textContent     = t.time_lbl;
  document.getElementById('quit-modal-title').textContent = t.quit_modal_title;
  document.getElementById('quit-modal-sub').textContent   = t.quit_modal_sub;
  document.getElementById('quit-cancel-lbl').textContent  = t.quit_cancel;
  document.getElementById('quit-confirm-lbl').textContent = t.quit_confirm;
  document.getElementById('filter-all').textContent     = t.filter_all;
  document.getElementById('filter-wrong').textContent   = t.filter_wrong;
  document.getElementById('filter-correct').textContent = t.filter_correct;

  document.getElementById('loading-subject-icon').textContent  = config.subject.icon;
  document.getElementById('quiz-subject-icon-sm').textContent  = config.subject.icon;
  document.getElementById('quiz-subject-name-sm').textContent  = config.subject.name;
}

/* ===== LOADING SEQUENCE ===== */
async function startLoadingSequence() {
  animateStep(1);
  await delay(800);
  animateStep(2);
  await delay(600);
  animateStep(3);

  try {
    questions = await fetchQuestions();
    await delay(400);
    showQuizScreen();
  } catch (err) {
    console.error('Quiz generation error:', err);
    showError(err.message);
  }
}

function animateStep(num) {
  const prev = document.getElementById(`step-${num - 1}`);
  if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
  const cur = document.getElementById(`step-${num}`);
  if (cur) cur.classList.add('active');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ===== FETCH QUESTIONS FROM BACKEND (Groq) ===== */
async function fetchQuestions() {
  const userRaw = localStorage.getItem('quizai_user');
  const user    = userRaw ? JSON.parse(userRaw) : {};

  const res = await fetch(`${API}/generate-quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token || ''}`,
    },
    body: JSON.stringify({
      subject:       config.subject.name,
      category:      config.category,
      lang:          config.lang,
      questionCount: config.questionCount,
      difficulty:    config.difficulty,
      customPrompt:  config.customPrompt,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Server error');
  }

  const data = await res.json();
  if (!data.success || !Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('Invalid quiz data');
  }
  return data.questions;
}

/* ===== SHOW SCREENS ===== */
function showScreen(id) {
  ['screen-loading','screen-quiz','screen-result'].forEach(s => {
    const el = document.getElementById(s);
    el.classList.toggle('hidden', el.id !== id);
  });
}

function showQuizScreen() {
  document.getElementById('q-total').textContent = questions.length;
  showScreen('screen-quiz');
  renderQuestion(0);
}

function showError(errMsg) {
  const t = L[lang];
  document.getElementById('loading-title').textContent = t.error_title;

  const subEl = document.getElementById('loading-sub');
  subEl.textContent = errMsg || t.error_sub;
  subEl.style.color = '#ef4444';
  subEl.style.fontSize = '14px';
  subEl.style.maxWidth = '360px';
  subEl.style.margin = '0 auto';

  const wrap = document.querySelector('.loading-wrap');

  const retryBtn = document.createElement('button');
  retryBtn.textContent = lang === 'bn' ? '🔄 আবার চেষ্টা করো' : '🔄 Retry';
  retryBtn.style.cssText = `margin-top:20px;margin-right:10px;padding:12px 24px;
    background:linear-gradient(135deg,#8b5cf6,#ec4899);
    border:none;border-radius:12px;color:#fff;font-family:'Hind Siliguri',sans-serif;
    font-size:15px;font-weight:600;cursor:pointer;`;
  retryBtn.onclick = () => window.location.reload();

  const backBtn = document.createElement('button');
  backBtn.textContent = lang === 'bn' ? '← ফিরে যাও' : '← Go Back';
  backBtn.style.cssText = `margin-top:20px;padding:12px 24px;
    background:transparent;border:1px solid rgba(139,92,246,0.4);
    border-radius:12px;color:#94a3b8;font-family:'Hind Siliguri',sans-serif;
    font-size:15px;font-weight:500;cursor:pointer;`;
  backBtn.onclick = () => window.location.href = 'dashboard.html';

  const btnRow = document.createElement('div');
  btnRow.style.marginTop = '8px';
  btnRow.appendChild(retryBtn);
  btnRow.appendChild(backBtn);
  wrap.appendChild(btnRow);
}

/* ===== RENDER QUESTION ===== */
function renderQuestion(idx) {
  const t = L[lang];
  const q = questions[idx];
  currentIdx    = idx;
  questionStart = Date.now();

  document.getElementById('q-current').textContent   = idx + 1;
  document.getElementById('progress-bar-fill').style.width = ((idx + 1) / questions.length * 100) + '%';

  document.getElementById('q-num-badge').textContent = t.question_prefix + (idx + 1);

  const diffBadge = document.getElementById('diff-badge');
  const diffKey   = config.difficulty || 'medium';
  diffBadge.textContent = t['diff_' + diffKey];
  diffBadge.className   = 'question-difficulty-badge diff-' + diffKey;

  document.getElementById('question-text').textContent = q.question;

  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.style.animationDelay = (i * 0.07) + 's';
    btn.innerHTML = `
      <span class="option-letter">${t.option_letters[i]}</span>
      <span>${opt}</span>
    `;
    btn.addEventListener('click', () => selectAnswer(i));
    grid.appendChild(btn);
  });

  const nextBtn = document.getElementById('next-btn');
  nextBtn.classList.add('hidden');
  nextBtn.querySelector('span').textContent =
    idx === questions.length - 1 ? t.last_q : t.next_q;

  startTimer(q.timeLimit || 30);
}

/* ===== TIMER ===== */
const CIRCUMFERENCE = 188.4;

function startTimer(seconds) {
  clearInterval(timerInterval);
  timeLeft = seconds;
  updateTimerDisplay(timeLeft, seconds);

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay(timeLeft, seconds);
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      handleTimeUp();
    }
  }, 1000);
}

function updateTimerDisplay(current, total) {
  document.getElementById('timer-num').textContent = current;

  const pct    = current / total;
  const offset = CIRCUMFERENCE * (1 - pct);
  const fgEl   = document.getElementById('timer-fg');
  fgEl.style.strokeDashoffset = offset;

  if (pct > 0.5)       fgEl.style.stroke = 'var(--purple)';
  else if (pct > 0.25) fgEl.style.stroke = 'var(--warning)';
  else                 fgEl.style.stroke = 'var(--error)';
}

function handleTimeUp() {
  const timeTaken = Math.round((Date.now() - questionStart) / 1000);
  userAnswers.push({ selected: -1, correct: questions[currentIdx].correct, timeTaken });
  totalTimeTaken += timeTaken;

  showFlash(L[lang].time_up, false, true);
  highlightAnswer(-1, questions[currentIdx].correct);
  document.getElementById('next-btn').classList.remove('hidden');
}

/* ===== SELECT ANSWER ===== */
function selectAnswer(index) {
  clearInterval(timerInterval);

  const timeTaken = Math.round((Date.now() - questionStart) / 1000);
  const correct   = questions[currentIdx].correct;
  const isCorrect = index === correct;

  userAnswers.push({ selected: index, correct, timeTaken });
  totalTimeTaken += timeTaken;

  if (isCorrect) {
    liveScore++;
    document.getElementById('live-score').textContent = liveScore;
    showFlash('✅', true);
  } else {
    showFlash('❌', false);
  }

  highlightAnswer(index, correct);
  document.getElementById('next-btn').classList.remove('hidden');
}

function highlightAnswer(selected, correct) {
  const btns = document.querySelectorAll('.option-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct)  btn.classList.add('correct');
    if (i === selected && selected !== correct) btn.classList.add('wrong');
  });
}

/* ===== NEXT QUESTION ===== */
function nextQuestion() {
  const next = currentIdx + 1;
  if (next >= questions.length) {
    endQuiz();
  } else {
    const card = document.getElementById('question-card');
    card.style.animation = 'none';
    requestAnimationFrame(() => {
      card.style.animation = '';
      renderQuestion(next);
    });
  }
}

/* ===== FEEDBACK FLASH ===== */
function showFlash(emoji, isCorrect, isTimeUp) {
  const el = document.getElementById('feedback-flash');
  el.textContent = emoji;
  el.style.fontSize = isTimeUp ? '36px' : '80px';
  el.classList.remove('hide');
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => el.classList.remove('hide'), 300);
  }, 600);
}

/* ===== END QUIZ ===== */
function endQuiz() {
  clearInterval(timerInterval);
  saveResult();
  renderResult();
  showScreen('screen-result');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===== SAVE RESULT ===== */
async function saveResult() {
  const correct = userAnswers.filter(a => a.selected === a.correct).length;
  const pct     = correct / questions.length;

  /* ── 1. Save to localStorage (instant, offline-safe) ── */
  const history = JSON.parse(localStorage.getItem('quizai_history') || '[]');
  const entry   = {
    subjectName:   config.subject.name,
    icon:          config.subject.icon,
    category:      config.category,
    lang:          config.lang,
    difficulty:    config.difficulty,
    questionCount: questions.length,
    correct,
    pct,
    timeTaken:     totalTimeTaken,
    date:          new Date().toISOString(),
    questions,      // ← full questions saved locally too
    userAnswers,    // ← full answers saved locally
    dbId:          null, // will be filled after API call
  };
  history.push(entry);
  localStorage.setItem('quizai_history', JSON.stringify(history));

  /* ── 2. Save to backend (with full quiz data) ── */
  const userRaw = localStorage.getItem('quizai_user');
  if (!userRaw) return;

  const user = JSON.parse(userRaw);
  if (!user.token) return;

  try {
    const res = await fetch(`${API}/save-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        subjectName:  config.subject.name,
        subjectIcon:  config.subject.icon,
        category:     config.category,
        lang:         config.lang,
        difficulty:   config.difficulty,
        score:        correct,
        total:        questions.length,
        timeTaken:    totalTimeTaken,
        questions,    // ← full questions array
        userAnswers,  // ← full userAnswers array
      }),
    });

    const data = await res.json();
    if (data.success && data.resultId) {
      savedResultId = data.resultId;

      /* update localStorage entry with DB id */
      entry.dbId = data.resultId;
      const h2   = JSON.parse(localStorage.getItem('quizai_history') || '[]');
      h2[h2.length - 1] = entry;
      localStorage.setItem('quizai_history', JSON.stringify(h2));
    }
  } catch (err) {
    console.warn('Backend save failed (offline?):', err.message);
  }
}

/* ===== RENDER RESULT ===== */
function renderResult() {
  const t        = L[lang];
  const correct  = userAnswers.filter(a => a.selected === a.correct).length;
  const wrong    = userAnswers.filter(a => a.selected !== a.correct && a.selected !== -1).length;
  const skipped  = userAnswers.filter(a => a.selected === -1).length;
  const total    = questions.length;
  const pct      = Math.round(correct / total * 100);

  const ringEl = document.getElementById('score-ring-fill');
  const circumference = 427.2;
  setTimeout(() => {
    const offset = circumference * (1 - pct / 100);
    ringEl.style.strokeDashoffset = offset;
    if (pct >= 80)      ringEl.style.stroke = 'var(--success)';
    else if (pct >= 60) ringEl.style.stroke = 'var(--purple)';
    else if (pct >= 40) ringEl.style.stroke = 'var(--warning)';
    else                ringEl.style.stroke = 'var(--error)';
  }, 100);

  animateNumber('result-score-num', 0, correct, 1000);
  document.getElementById('result-score-label').textContent = `/ ${total}`;
  document.getElementById('result-pct').textContent         = pct + '%';

  let grade, msg;
  if (pct >= 85)      { grade = t.grade_excellent; msg = t.msg_excellent; launchConfetti(); }
  else if (pct >= 70) { grade = t.grade_great;     msg = t.msg_great; }
  else if (pct >= 55) { grade = t.grade_good;      msg = t.msg_good; }
  else if (pct >= 40) { grade = t.grade_average;   msg = t.msg_average; }
  else                { grade = t.grade_poor;       msg = t.msg_poor; }

  document.getElementById('result-grade').textContent = grade;
  document.getElementById('result-msg').textContent   = msg;

  document.getElementById('rst-correct').textContent = correct;
  document.getElementById('rst-wrong').textContent   = wrong;
  document.getElementById('rst-skipped').textContent = skipped;
  document.getElementById('rst-time').textContent    = totalTimeTaken + 's';

  renderReview('all');
}

function animateNumber(id, from, to, duration) {
  const el    = document.getElementById(id);
  const start = performance.now();
  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * ease);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/* ===== REVIEW ===== */
function filterReview(filter, btn) {
  reviewFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReview(filter);
}

function renderReview(filter) {
  const t    = L[lang];
  const list = document.getElementById('review-list');
  list.innerHTML = '';

  const items = userAnswers
    .map((ans, i) => ({ ans, i, q: questions[i] }))
    .filter(({ ans }) => {
      if (filter === 'correct') return ans.selected === ans.correct;
      if (filter === 'wrong')   return ans.selected !== ans.correct;
      return true;
    });

  items.forEach(({ ans, i, q }, idx) => {
    const isCorrect = ans.selected === ans.correct;
    const isSkipped = ans.selected === -1;

    const item = document.createElement('div');
    item.className = `review-item ${isCorrect ? 'correct' : ''}`;
    item.style.animationDelay = (idx * 0.05) + 's';

    const yourAnswerHtml = isCorrect ? '' : `
      <div class="review-answer-row">
        <span class="lbl wrong">${isSkipped ? '' : t.your_answer}</span>
        <span>${isSkipped ? t.skipped_answer : q.options[ans.selected]}</span>
      </div>`;

    item.innerHTML = `
      <div class="review-item-top">
        <span class="review-q-num">Q${i + 1}</span>
        <span class="review-q-text">${q.question}</span>
      </div>
      <div class="review-answers">
        ${yourAnswerHtml}
        <div class="review-answer-row">
          <span class="lbl correct">${t.correct_answer}</span>
          <span>${q.options[ans.correct]}</span>
        </div>
      </div>
      ${q.explanation ? `
        <div class="review-explanation">
          <span class="exp-icon">💡</span>${q.explanation}
        </div>` : ''}
    `;
    list.appendChild(item);
  });

  if (items.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:32px;color:var(--txt3);font-size:15px;">
      ${lang === 'bn' ? 'এই ক্যাটাগরিতে কোনো প্রশ্ন নেই।' : 'No questions in this category.'}
    </div>`;
  }
}

/* ===== CONFETTI ===== */
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors  = ['#8b5cf6','#ec4899','#f97316','#10b981','#06b6d4','#fbbf24'];
  const pieces  = [];
  const count   = 120;

  for (let i = 0; i < count; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 100,
      w: 6 + Math.random() * 8,
      h: 8 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 8,
      opacity: 1,
    });
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.rot += p.vrot;
      p.vy  += 0.05;
      if (frame > 80) p.opacity -= 0.015;
      if (p.opacity > 0 && p.y < canvas.height + 20) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      }
    });
    frame++;
    if (alive) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(draw);
}

/* ===== RETRY ===== */
function retryQuiz() {
  sessionStorage.setItem('quizConfig', JSON.stringify(config));
  window.location.reload();
}

/* ===== QUIT ===== */
function confirmQuit() {
  document.getElementById('quit-modal').classList.remove('hidden');
}
function cancelQuit() {
  document.getElementById('quit-modal').classList.add('hidden');
}
function doQuit() {
  clearInterval(timerInterval);
  window.location.href = 'dashboard.html';
}