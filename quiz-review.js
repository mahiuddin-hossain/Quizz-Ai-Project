/* ================================================
   quiz-review.js  —  QuizAI Quiz Review Page
   Reads  sessionStorage.reviewData  set by dashboard
   ================================================ */

'use strict';

/* ===== LOAD DATA ===== */
const raw = sessionStorage.getItem('reviewData');
if (!raw) {
  // No data → redirect back
  window.location.href = 'dashboard.html';
  throw new Error('No review data');
}

const h = JSON.parse(raw);
// h fields: subjectName, icon, category, lang, questionCount,
//           correct (count), pct, timeTaken, date, difficulty,
//           questions[], userAnswers[]

const questions   = h.questions   || [];
const userAnswers = h.userAnswers || [];
const lang        = h.lang || 'bn';

let currentFilter = 'all';

/* ===== LABELS ===== */
const L = {
  bn: {
    grade_label: ['অসাধারণ!','চমৎকার!','ভালো করেছ!','আরও চেষ্টা করো','হতাশাজনক'],
    grade_msg:   [
      'তুমি প্রায় সব প্রশ্নের উত্তর সঠিকভাবে দিয়েছ। অসাধারণ পারফরম্যান্স!',
      'খুব ভালো করেছ! একটু মনোযোগ দিলে পারফেক্ট স্কোর পাবে।',
      'মোটামুটি ভালো। আরেকটু মনোযোগ দিলে আরও ভালো হবে।',
      'কিছু গুরুত্বপূর্ণ বিষয় মিস হয়েছে। আবার পড়ো।',
      'হতাশ হয়ো না! আরও একবার চেষ্টা করো।',
    ],
    grade_names: ['S+','A+','B','C','D'],
    correct:  'সঠিক',
    wrong:    'ভুল',
    skipped:  'বাদ',
    your_ans: 'তোমার উত্তর:',
    right_ans:'সঠিক উত্তর:',
    no_ans:   'উত্তর দেওয়া হয়নি',
    explanation: '💡 ব্যাখ্যা',
    diff: { easy:'সহজ', medium:'মাঝারি', hard:'কঠিন' },
    cat: { ssc:'SSC', hsc:'HSC', medical:'মেডিকেল', university:'বিশ্ববিদ্যালয়' },
    q_label: 'টি প্রশ্ন',
    no_wrong:   'কোনো ভুল উত্তর নেই! 🎉',
    no_correct: 'কোনো সঠিক উত্তর নেই।',
    no_skipped: 'কোনো প্রশ্ন বাদ দেওয়া হয়নি।',
  },
  en: {
    grade_label: ['Outstanding!','Excellent!','Good Job!','Keep Trying','Disappointing'],
    grade_msg:   [
      'Almost perfect! You answered nearly everything correctly.',
      'Great job! A little more focus and you\'ll hit 100.',
      'Decent performance. A bit more practice will help.',
      'Some key topics were missed. Review and try again.',
      'Don\'t give up! Try once more with better preparation.',
    ],
    grade_names: ['S+','A+','B','C','D'],
    correct:  'Correct',
    wrong:    'Wrong',
    skipped:  'Skipped',
    your_ans: 'Your answer:',
    right_ans:'Correct answer:',
    no_ans:   'Not answered',
    explanation: '💡 Explanation',
    diff: { easy:'Easy', medium:'Medium', hard:'Hard' },
    cat: { ssc:'SSC', hsc:'HSC', medical:'Medical', university:'University' },
    q_label: ' questions',
    no_wrong:   'No wrong answers! 🎉',
    no_correct: 'No correct answers.',
    no_skipped: 'No skipped questions.',
  },
};

const t = L[lang] || L.bn;

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', () => {
  renderHero();
  renderMeta();
  renderFilterCounts();
  renderReviewList('all');
  setNavDate();
});

/* ===== NAVBAR ===== */
function setNavDate() {
  const d = h.date ? new Date(h.date) : new Date();
  document.getElementById('nav-date').textContent =
    d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { year:'numeric', month:'short', day:'numeric' });
  document.getElementById('nav-icon').textContent    = h.icon || '📝';
  document.getElementById('nav-subject').textContent = h.subjectName || 'Quiz Review';
}

/* ===== HERO SECTION ===== */
function renderHero() {
  const correct = h.correct || 0;
  const total   = questions.length || h.questionCount || 20;
  const pct     = Math.round((correct / total) * 100);

  const wrong   = userAnswers.filter(a => a.selected !== a.correct && a.selected !== -1).length;
  const skipped = userAnswers.filter(a => a.selected === -1).length;
  const timeAvg = total ? Math.round((h.timeTaken || 0) / total) : 0;

  // Grade
  const gradeIdx = pct >= 90 ? 0 : pct >= 75 ? 1 : pct >= 55 ? 2 : pct >= 35 ? 3 : 4;
  document.getElementById('hero-grade').textContent = t.grade_label[gradeIdx];
  document.getElementById('hero-pct').textContent   = pct + '%';
  document.getElementById('hero-msg').textContent   = t.grade_msg[gradeIdx];
  document.getElementById('hero-score').textContent = correct;
  document.getElementById('hero-total').textContent = '/' + total;
  document.getElementById('hero-icon').textContent    = h.icon || '📖';
  document.getElementById('hero-subject').textContent = h.subjectName || '—';

  // Stats
  document.getElementById('hs-correct').textContent = correct;
  document.getElementById('hs-wrong').textContent   = wrong;
  document.getElementById('hs-skipped').textContent = skipped;
  document.getElementById('hs-points').textContent  = correct + ' pts';
  document.getElementById('hs-time').textContent    =
    h.timeTaken ? (h.timeTaken >= 60
      ? Math.floor(h.timeTaken/60)+'m '+(h.timeTaken%60)+'s'
      : h.timeTaken+'s')
    : '—';
  document.getElementById('hs-diff').textContent    =
    t.diff[h.difficulty || 'medium'];

  // Ring colour based on score
  const ringEl = document.getElementById('ring-fill');
  const color  = pct >= 75 ? '#10b981' : pct >= 45 ? '#8b5cf6' : '#ef4444';
  ringEl.style.stroke = color;

  // Animate ring: circumference = 2π×62 = 389.56
  const circ  = 2 * Math.PI * 62;
  const offset= circ - (pct / 100) * circ;
  requestAnimationFrame(() => {
    setTimeout(() => { ringEl.style.strokeDashoffset = offset; }, 80);
  });
}

/* ===== META BAR ===== */
function renderMeta() {
  const catName = t.cat[h.category] || h.category || '—';
  const dateStr = h.date
    ? new Date(h.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US',
        { year:'numeric', month:'long', day:'numeric' })
    : '—';
  const qCount  = (h.questionCount || questions.length) +
    (lang === 'bn' ? t.q_label : t.q_label);

  document.getElementById('meta-cat').textContent    = catName;
  document.getElementById('meta-date').textContent   = dateStr;
  document.getElementById('meta-qcount').textContent = qCount;
}

/* ===== FILTER COUNTS ===== */
function renderFilterCounts() {
  const total   = questions.length;
  const correct = userAnswers.filter(a => a.selected === a.correct).length;
  const wrong   = userAnswers.filter(a => a.selected !== a.correct && a.selected !== -1).length;
  const skipped = userAnswers.filter(a => a.selected === -1).length;

  document.getElementById('fc-all').textContent     = total;
  document.getElementById('fc-correct').textContent = correct;
  document.getElementById('fc-wrong').textContent   = wrong;
  document.getElementById('fc-skipped').textContent = skipped;
}

/* ===== FILTER HANDLER ===== */
function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReviewList(filter);
}

/* ===== RENDER REVIEW LIST ===== */
function renderReviewList(filter) {
  const listEl = document.getElementById('review-list');
  listEl.innerHTML = '';

  const letters = ['ক','খ','গ','ঘ'];
  const engLetters = ['A','B','C','D'];
  const useLetters = lang === 'bn' ? letters : engLetters;

  // Build indexed list based on filter
  let indices = questions.map((_, i) => i);

  if (filter === 'correct') {
    indices = indices.filter(i => {
      const ua = userAnswers[i];
      return ua && ua.selected === ua.correct;
    });
  } else if (filter === 'wrong') {
    indices = indices.filter(i => {
      const ua = userAnswers[i];
      return ua && ua.selected !== ua.correct && ua.selected !== -1;
    });
  } else if (filter === 'skipped') {
    indices = indices.filter(i => {
      const ua = userAnswers[i];
      return !ua || ua.selected === -1;
    });
  }

  if (indices.length === 0) {
    const emptyMsg = filter === 'wrong'   ? t.no_wrong
                   : filter === 'correct' ? t.no_correct
                   : filter === 'skipped' ? t.no_skipped
                   : (lang === 'bn' ? 'কোনো প্রশ্ন নেই।' : 'No questions found.');
    listEl.innerHTML = `<div class="review-empty"><div class="ee">🎯</div>${emptyMsg}</div>`;
    return;
  }

  indices.forEach((qi, idx) => {
    const q  = questions[qi];
    const ua = userAnswers[qi] || { selected: -1, correct: q.correct };

    const selected = ua.selected;
    const correct  = ua.correct ?? q.correct;

    const isCorrect = selected === correct;
    const isSkipped = selected === -1;
    const isWrong   = !isCorrect && !isSkipped;

    const cardClass = isCorrect ? 'correct' : isSkipped ? 'skipped' : 'wrong';
    const badgeText = isCorrect ? t.correct  : isSkipped ? t.skipped : t.wrong;
    const badgeClass= isCorrect ? 'badge-correct' : isSkipped ? 'badge-skipped' : 'badge-wrong';

    // Build options HTML
    let optionsHtml = '';
    (q.options || []).forEach((opt, oi) => {
      let cls = '';
      if (oi === correct && isCorrect)   cls = 'is-correct';        // user got it right
      else if (oi === correct)           cls = 'is-correct';        // always show correct
      if (oi === selected && isWrong)    cls = 'is-wrong-selected'; // user's wrong pick

      optionsHtml += `
        <div class="rc-opt ${cls}">
          <span class="opt-letter">${useLetters[oi]}</span>
          <span>${escHtml(opt)}</span>
        </div>`;
    });

    // Answer summary
    let answerSummary = '';
    if (isSkipped) {
      answerSummary = `
        <div class="ans-row">
          <span class="ans-tag skipped">${lang === 'bn' ? '⏭️ বাদ দেওয়া হয়েছে' : '⏭️ Skipped'}</span>
        </div>
        <div class="ans-row">
          <span class="ans-tag correct">✅ ${t.right_ans}</span>
          <span>${useLetters[correct]}. ${escHtml(q.options?.[correct] || '')}</span>
        </div>`;
    } else if (isWrong) {
      answerSummary = `
        <div class="ans-row">
          <span class="ans-tag wrong">❌ ${t.your_ans}</span>
          <span>${useLetters[selected]}. ${escHtml(q.options?.[selected] || '')}</span>
        </div>
        <div class="ans-row">
          <span class="ans-tag correct">✅ ${t.right_ans}</span>
          <span>${useLetters[correct]}. ${escHtml(q.options?.[correct] || '')}</span>
        </div>`;
    } else {
      answerSummary = `
        <div class="ans-row">
          <span class="ans-tag correct">✅ ${t.your_ans}</span>
          <span>${useLetters[selected]}. ${escHtml(q.options?.[selected] || '')}</span>
        </div>`;
    }

    // Explanation
    const expHtml = q.explanation
      ? `<div class="rc-explanation"><strong>${t.explanation}:</strong> ${escHtml(q.explanation)}</div>`
      : '';

    // Card
    const card = document.createElement('div');
    card.className = `r-card ${cardClass}`;
    card.style.animationDelay = (idx * 0.06) + 's';
    card.innerHTML = `
      <div class="rc-top">
        <span class="rc-num">${lang === 'bn' ? 'প্রশ্ন' : 'Q'} ${qi + 1}</span>
        <div class="rc-question">${escHtml(q.question)}</div>
        <span class="rc-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="rc-options">${optionsHtml}</div>
      <div class="rc-answer-summary">${answerSummary}</div>
      ${expHtml}
    `;

    listEl.appendChild(card);
  });
}

/* ===== RETAKE QUIZ ===== */
function retakeQuiz() {
  // Re-use the same config so user can generate a new quiz on this subject
  const config = {
    subject:      { name: h.subjectName, icon: h.icon },
    category:     h.category,
    lang:         h.lang,
    questionCount: h.questionCount || 20,
    difficulty:   h.difficulty || 'medium',
    customPrompt: '',
  };
  sessionStorage.setItem('quizConfig', JSON.stringify(config));
  window.location.href = 'quiz.html';
}

/* ===== HELPERS ===== */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}