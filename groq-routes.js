/* =========================================================
   groq-routes.js — Groq Cloud AI Quiz Generation

   Database Architecture:
   ┌─────────┐         ┌──────────────────┐
   │  users  │────────<│     scores       │
   └─────────┘  1:N    │ (quiz sessions)  │
                       └────────┬─────────┘
                            1:N │
                       ┌────────▼─────────┐
                       │     quizzes      │
                       │ (per-question)   │
                       └──────────────────┘

   scores  → one row per quiz session
   quizzes → one row per question inside a session
   ========================================================= */

module.exports = function (app, db, verifyToken) {

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL   = 'llama-3.3-70b-versatile';

  /* ════════════════════════════════════════════════════════
     DATABASE SETUP — runs once on server start
  ════════════════════════════════════════════════════════ */

  async function setupTables() {

    /* ── 1. scores — one row per quiz session ── */
    await db.promise().query(`
      CREATE TABLE IF NOT EXISTS scores (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        user_id       INT            NOT NULL,
        subject_name  VARCHAR(150)   NOT NULL,
        subject_icon  VARCHAR(20)    DEFAULT '📝',
        category      VARCHAR(50)    NOT NULL,
        lang          VARCHAR(10)    DEFAULT 'bn',
        difficulty    VARCHAR(20)    DEFAULT 'medium',
        score         INT            NOT NULL,
        total         INT            NOT NULL,
        time_taken    INT            DEFAULT 0,
        percentage    FLOAT          NOT NULL,
        created_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_scores_user     (user_id),
        INDEX idx_scores_created  (created_at),
        INDEX idx_scores_category (category),
        INDEX idx_scores_user_cat (user_id, category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /* ── 2. quizzes — one row per question ── */
    await db.promise().query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        score_id        INT            NOT NULL,
        user_id         INT            NOT NULL,
        question_index  TINYINT        NOT NULL COMMENT '0-based position in quiz',
        question_text   TEXT           NOT NULL,
        option_0        VARCHAR(500)   NOT NULL,
        option_1        VARCHAR(500)   NOT NULL,
        option_2        VARCHAR(500)   NOT NULL,
        option_3        VARCHAR(500)   NOT NULL,
        correct_index   TINYINT        NOT NULL COMMENT '0-3',
        selected_index  TINYINT        NOT NULL DEFAULT -1 COMMENT '-1 = skipped',
        is_correct      TINYINT(1)     NOT NULL DEFAULT 0,
        is_skipped      TINYINT(1)     NOT NULL DEFAULT 0,
        time_taken      SMALLINT       NOT NULL DEFAULT 0 COMMENT 'seconds',
        explanation     TEXT           NULL,
        created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (score_id) REFERENCES scores(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
        INDEX idx_quizzes_score   (score_id),
        INDEX idx_quizzes_user    (user_id),
        INDEX idx_quizzes_correct (user_id, is_correct)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /* ── 3. Migrate: add new columns to scores if upgrading ── */
    const addCols = [
      `ALTER TABLE scores ADD COLUMN IF NOT EXISTS subject_icon VARCHAR(20)  DEFAULT '📝'`,
      `ALTER TABLE scores ADD COLUMN IF NOT EXISTS lang         VARCHAR(10)  DEFAULT 'bn'`,
      `ALTER TABLE scores ADD COLUMN IF NOT EXISTS difficulty   VARCHAR(20)  DEFAULT 'medium'`,
    ];
    for (const sql of addCols) {
      await db.promise().query(sql).catch(() => {});
    }

    /* ── 4. Migrate: add total_points to users table ── */
    await db.promise().query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS total_points INT NOT NULL DEFAULT 0`
    ).catch(() => {});

    /* ── 4. Migrate: drop old JSON blob columns from scores ── */
    for (const col of ['questions', 'user_answers']) {
      await db.promise().query(
        `ALTER TABLE scores DROP COLUMN IF EXISTS \`${col}\``
      ).catch(() => {});
    }
  }

  setupTables()
    .then(() => console.log('✅ scores + quizzes tables ready!'))
    .catch(err  => console.error('❌ Table setup error:', err.message));


  /* ════════════════════════════════════════════════════════
     PROMPT BUILDER
  ════════════════════════════════════════════════════════ */

  function buildPrompt(subject, category, lang, count, difficulty, customPrompt) {
    const langText = lang === 'bn' ? 'Bengali (বাংলা)' : 'English';
    const catMap   = {
      ssc:        'SSC (Secondary School Certificate)',
      hsc:        'HSC (Higher Secondary Certificate)',
      medical:    'Medical Admission (MBBS)',
      university: 'Public University Admission',
    };
    const diffMap = { easy: 'easy', medium: 'medium', hard: 'hard/challenging' };
    const extra   = customPrompt ? `\nStudent's special request: "${customPrompt}"` : '';

    /*
     * Correct-answer position distribution hint injected into prompt.
     * We pre-assign target positions so the model knows upfront where
     * each answer should land — this breaks the "always index 0" bias.
     *
     * For N questions, distribute targets evenly across 0-3 then shuffle.
     */
    const positions = Array.from({ length: count }, (_, i) => i % 4);
    // Fisher-Yates shuffle for the position list
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const positionHint = positions
      .map((p, i) => `Q${i + 1}→${p}`)
      .join(', ');

    return `You are an expert MCQ question generator for Bangladeshi students preparing for ${catMap[category] || category} exams.

Generate exactly ${count} multiple choice questions about the subject: "${subject}".

STRICT RULES:
1. ALL text (questions, options, explanations) MUST be written in ${langText}
2. Difficulty level: ${diffMap[difficulty] || 'medium'}
3. Each question MUST have EXACTLY 4 answer options
4. The "correct" field = zero-based index (0, 1, 2, or 3) of the correct option
5. Do NOT add A) B) C) D) prefixes to options
6. Explanations: 1-2 sentences, clear and educational
7. Questions must be factually accurate${extra}

ANSWER POSITION RULE (CRITICAL — you MUST follow this exactly):
Place the correct answer at the position index specified below for each question.
The other 3 positions must contain plausible but WRONG distractors.
Target correct-answer positions: ${positionHint}

Example — if Q1→2, the correct answer must be options[2]:
{
  "question": "...",
  "options": ["wrong", "wrong", "CORRECT ANSWER HERE", "wrong"],
  "correct": 2
}

CRITICAL OUTPUT RULE:
- Respond with ONLY a raw JSON object
- No markdown, no backticks, no preamble
- Start your response with { and end with }

Required JSON format:
{
  "questions": [
    {
      "question": "question text here",
      "options": ["option one", "option two", "option three", "option four"],
      "correct": 0,
      "explanation": "explanation text here"
    }
  ]
}`;
  }


  /* ════════════════════════════════════════════════════════
     GROQ RESPONSE PARSER
  ════════════════════════════════════════════════════════ */

  function parseGroqQuestions(rawText, difficulty) {
    let parsed;
    try {
      const clean = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON parse করা যায়নি।');
      parsed = JSON.parse(match[0]);
    }

    if (!parsed?.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Response-এ questions array নেই।');
    }

    const timeLimit = difficulty === 'hard' ? 40 : difficulty === 'easy' ? 25 : 30;

    return parsed.questions
      .filter(q =>
        q &&
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length === 4
      )
      .map(q => {
        const originalOptions = q.options.map(o => String(o).trim());
        const originalCorrect = Math.min(Math.max(parseInt(q.correct) ?? 0, 0), 3);
        const correctText     = originalOptions[originalCorrect];

        /*
         * Server-side Fisher-Yates shuffle — guaranteed safety net.
         * Even if the AI ignores the position hints in the prompt,
         * the correct answer will always land at a random index here.
         */
        const shuffled = [...originalOptions];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Track where the correct answer landed after shuffle
        const newCorrectIndex = shuffled.indexOf(correctText);

        return {
          question:    q.question.trim(),
          options:     shuffled,
          correct:     newCorrectIndex,
          explanation: q.explanation ? String(q.explanation).trim() : '',
          timeLimit,
        };
      });
  }


  /* ════════════════════════════════════════════════════════
     POST /api/generate-quiz
  ════════════════════════════════════════════════════════ */

  app.post('/api/generate-quiz', verifyToken, async (req, res) => {
    const {
      subject       = '',
      category      = 'ssc',
      lang          = 'bn',
      questionCount = 20,
      difficulty    = 'medium',
      customPrompt  = '',
    } = req.body;

    if (!subject.trim()) {
      return res.status(400).json({ success: false, message: 'Subject দাও।' });
    }
    if (!GROQ_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Groq API Key সেট করা নেই। .env ফাইলে GROQ_API_KEY দাও।',
      });
    }

    const count = Math.min(Math.max(parseInt(questionCount) || 20, 5), 30);
    console.log(`\n📝 Generating: "${subject}" | ${category} | ${lang} | ${count}q | ${difficulty}`);

    try {
      const groqRes = await fetch(GROQ_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model:       GROQ_MODEL,
          temperature: 0.6,
          max_tokens:  4096,
          messages: [
            { role: 'system', content: buildPrompt(subject, category, lang, count, difficulty, customPrompt) },
            { role: 'user',   content: `Generate ${count} MCQ questions about "${subject}" now.` },
          ],
        }),
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        console.error(`❌ Groq HTTP ${groqRes.status}:`, errText);
        const msgMap = {
          401: 'Groq API Key ভুল বা মেয়াদ শেষ।',
          429: 'Groq rate limit! কিছুক্ষণ পরে চেষ্টা করো।',
          503: 'Groq সার্ভার সাময়িক বন্ধ।',
        };
        return res.status(500).json({
          success: false,
          message: msgMap[groqRes.status] || 'Groq API error।',
        });
      }

      const groqData = await groqRes.json();
      const rawText  = groqData?.choices?.[0]?.message?.content || '';
      if (!rawText) throw new Error('Groq থেকে খালি response।');

      console.log(`✅ Groq response: ${rawText.length} chars`);

      const questions = parseGroqQuestions(rawText, difficulty);
      if (questions.length === 0) throw new Error('Valid প্রশ্ন পাওয়া যায়নি।');

      console.log(`✅ ${questions.length} questions ready\n`);
      return res.json({ success: true, questions, count: questions.length });

    } catch (err) {
      console.error('❌ generate-quiz:', err.message);
      return res.status(500).json({
        success: false,
        message: `কুইজ তৈরি করা যায়নি: ${err.message}`,
      });
    }
  });


  /* ════════════════════════════════════════════════════════
     POST /api/save-result

     Transaction flow:
       BEGIN
         ① INSERT scores          → scoreId
         ② Bulk INSERT quizzes    → N rows (one per question)
         ③ UPDATE users counter
       COMMIT  (or ROLLBACK on any error)
  ════════════════════════════════════════════════════════ */

  app.post('/api/save-result', verifyToken, async (req, res) => {
    const {
      subjectName,
      subjectIcon  = '📝',
      category,
      lang         = 'bn',
      difficulty   = 'medium',
      score,
      total,
      timeTaken    = 0,
      questions    = [],
      userAnswers  = [],
    } = req.body;

    /* ── Validation ── */
    if (!subjectName || score === undefined || !total) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'Questions array is empty.' });
    }
    if (questions.length !== userAnswers.length) {
      return res.status(400).json({
        success: false,
        message: `Length mismatch: ${questions.length} questions vs ${userAnswers.length} answers.`,
      });
    }

    const percentage = Math.round((score / total) * 100);
    const conn       = await db.promise().getConnection();

    try {
      await conn.beginTransaction();

      /* ① scores row */
      const [scoreResult] = await conn.query(
        `INSERT INTO scores
           (user_id, subject_name, subject_icon, category, lang,
            difficulty, score, total, time_taken, percentage)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [req.user.id, subjectName, subjectIcon, category, lang,
         difficulty, score, total, timeTaken, percentage]
      );
      const scoreId = scoreResult.insertId;

      /* ② quizzes rows — build flat params for single bulk INSERT */
      const ROW_PARAMS = 14; // columns per row
      const values     = [];

      questions.forEach((q, i) => {
        const ua        = userAnswers[i] || {};
        const selected  = (ua.selected === undefined || ua.selected === null)
                            ? -1 : Number(ua.selected);
        const correct   = Number(q.correct);
        const isSkipped = selected === -1 ? 1 : 0;
        const isCorrect = (isSkipped === 0 && selected === correct) ? 1 : 0;

        values.push(
          scoreId,
          req.user.id,
          i,                                        // question_index
          String(q.question).trim(),
          String(q.options[0] || '').trim(),
          String(q.options[1] || '').trim(),
          String(q.options[2] || '').trim(),
          String(q.options[3] || '').trim(),
          correct,                                  // correct_index
          selected,                                 // selected_index  (-1 = skipped)
          isCorrect,
          isSkipped,
          Number(ua.timeTaken) || 0,
          q.explanation ? String(q.explanation).trim() : null
        );
      });

      const placeholders = questions
        .map(() => `(${Array(ROW_PARAMS).fill('?').join(',')})`)
        .join(',');

      await conn.query(
        `INSERT INTO quizzes
           (score_id, user_id, question_index, question_text,
            option_0, option_1, option_2, option_3,
            correct_index, selected_index,
            is_correct, is_skipped, time_taken, explanation)
         VALUES ${placeholders}`,
        values
      );

      /* ③ user counters — total_quizzes + total_points (1 per correct answer) */
      await conn.query(
        `UPDATE users
         SET total_quizzes = total_quizzes + 1,
             total_points  = total_points  + ?
         WHERE id = ?`,
        [score, req.user.id]
      );

      await conn.commit();

      /* Fetch updated total_points to return to frontend */
      const [[userRow]] = await db.promise().query(
        `SELECT total_points FROM users WHERE id = ?`, [req.user.id]
      );
      const totalPoints = userRow ? userRow.total_points : 0;

      console.log(
        `💾 Saved  score_id=${scoreId} | user=${req.user.id} | ` +
        `"${subjectName}" | ${score}/${total} (${percentage}%) | ` +
        `+${score} pts → total=${totalPoints}`
      );

      return res.json({ success: true, resultId: scoreId, pointsEarned: score, totalPoints });

    } catch (err) {
      await conn.rollback();
      console.error('❌ save-result rollback:', err.message);
      return res.status(500).json({ success: false, message: 'Result save করা যায়নি।' });
    } finally {
      conn.release();
    }
  });


  /* ════════════════════════════════════════════════════════
     GET /api/my-results
     Lightweight session list — aggregates from quizzes table
  ════════════════════════════════════════════════════════ */

  app.get('/api/my-results', verifyToken, async (req, res) => {
    try {
      const [rows] = await db.promise().query(
        `SELECT
           s.id,
           s.subject_name,
           s.subject_icon,
           s.category,
           s.lang,
           s.difficulty,
           s.score,
           s.total,
           s.time_taken,
           s.percentage,
           s.created_at,
           COUNT(q.id)                                        AS question_count,
           COALESCE(SUM(q.is_correct),  0)                   AS correct_count,
           COALESCE(SUM(q.is_skipped),  0)                   AS skipped_count,
           COALESCE(SUM(
             CASE WHEN q.is_correct = 0
                   AND q.is_skipped = 0 THEN 1 ELSE 0 END
           ), 0)                                             AS wrong_count
         FROM scores s
         LEFT JOIN quizzes q ON q.score_id = s.id
         WHERE s.user_id = ?
         GROUP BY s.id
         ORDER BY s.created_at DESC
         LIMIT 50`,
        [req.user.id]
      );

      return res.json({ success: true, results: rows });
    } catch (err) {
      console.error('my-results error:', err.message);
      return res.status(500).json({ success: false, message: 'Failed to load results.' });
    }
  });


  /* ════════════════════════════════════════════════════════
     GET /api/result/:id
     Full session — reconstructs questions + userAnswers
     directly from quizzes rows (no JSON blobs)
  ════════════════════════════════════════════════════════ */

  app.get('/api/result/:id', verifyToken, async (req, res) => {
    const scoreId = parseInt(req.params.id);
    if (!scoreId) return res.status(400).json({ success: false, message: 'Invalid id.' });

    try {
      /* session header */
      const [sessionRows] = await db.promise().query(
        `SELECT id, subject_name, subject_icon, category, lang,
                difficulty, score, total, time_taken, percentage, created_at
         FROM scores
         WHERE id = ? AND user_id = ?`,
        [scoreId, req.user.id]
      );

      if (!sessionRows.length) {
        return res.status(404).json({ success: false, message: 'Result পাওয়া যায়নি।' });
      }

      /* question rows — ordered by position */
      const [qRows] = await db.promise().query(
        `SELECT
           question_index, question_text,
           option_0, option_1, option_2, option_3,
           correct_index, selected_index,
           is_correct, is_skipped, time_taken, explanation
         FROM quizzes
         WHERE score_id = ? AND user_id = ?
         ORDER BY question_index ASC`,
        [scoreId, req.user.id]
      );

      /* rebuild frontend-compatible arrays */
      const questions   = qRows.map(r => ({
        question:    r.question_text,
        options:     [r.option_0, r.option_1, r.option_2, r.option_3],
        correct:     r.correct_index,
        explanation: r.explanation || '',
      }));

      const userAnswers = qRows.map(r => ({
        selected:  r.selected_index,   // -1 = skipped
        correct:   r.correct_index,
        timeTaken: r.time_taken,
      }));

      const s = sessionRows[0];
      return res.json({
        success: true,
        result: {
          id:          s.id,
          subjectName: s.subject_name,
          icon:        s.subject_icon,
          category:    s.category,
          lang:        s.lang,
          difficulty:  s.difficulty,
          score:       s.score,
          total:       s.total,
          timeTaken:   s.time_taken,
          percentage:  s.percentage,
          date:        s.created_at,
          questions,
          userAnswers,
        },
      });

    } catch (err) {
      console.error('get-result error:', err.message);
      return res.status(500).json({ success: false, message: 'Failed to load result.' });
    }
  });


  /* ════════════════════════════════════════════════════════
     GET /api/stats
     Analytics: overall summary + per-subject accuracy
  ════════════════════════════════════════════════════════ */

  app.get('/api/stats', verifyToken, async (req, res) => {
    try {
      const [[overview]] = await db.promise().query(
        `SELECT
           COUNT(DISTINCT s.id)        AS total_sessions,
           COUNT(q.id)                 AS total_questions,
           COALESCE(SUM(q.is_correct), 0) AS total_correct,
           COALESCE(SUM(q.is_skipped), 0) AS total_skipped,
           ROUND(AVG(s.percentage), 1) AS avg_percentage,
           COALESCE(SUM(s.time_taken), 0) AS total_time_seconds
         FROM scores s
         LEFT JOIN quizzes q ON q.score_id = s.id
         WHERE s.user_id = ?`,
        [req.user.id]
      );

      const [bySubject] = await db.promise().query(
        `SELECT
           s.subject_name,
           s.subject_icon,
           COUNT(DISTINCT s.id)   AS attempts,
           COUNT(q.id)            AS questions_answered,
           COALESCE(SUM(q.is_correct), 0) AS correct,
           ROUND(
             COALESCE(SUM(q.is_correct), 0) * 100.0
             / NULLIF(COUNT(q.id), 0)
           , 1)                   AS accuracy_pct
         FROM scores s
         LEFT JOIN quizzes q ON q.score_id = s.id
         WHERE s.user_id = ?
         GROUP BY s.subject_name, s.subject_icon
         ORDER BY accuracy_pct DESC`,
        [req.user.id]
      );

      return res.json({ success: true, overview, bySubject });
    } catch (err) {
      console.error('stats error:', err.message);
      return res.status(500).json({ success: false, message: 'Failed to load stats.' });
    }
  });


  /* ════════════════════════════════════════════════════════
     GET /api/leaderboard
     Top users ranked by total_points.
     Returns rank, name, points, quiz count, accuracy.
  ════════════════════════════════════════════════════════ */

  app.get('/api/leaderboard', verifyToken, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);

      const [rows] = await db.promise().query(
        `SELECT
           u.id,
           u.name,
           u.total_points,
           u.total_quizzes,
           ROUND(AVG(s.percentage), 1)  AS avg_accuracy,
           MAX(s.created_at)            AS last_active
         FROM users u
         LEFT JOIN scores s ON s.user_id = u.id
         WHERE u.is_active = 1
           AND u.total_points > 0
         GROUP BY u.id
         ORDER BY u.total_points DESC, u.total_quizzes DESC
         LIMIT ?`,
        [limit]
      );

      /* Attach rank */
      const leaderboard = rows.map((row, idx) => ({
        rank:        idx + 1,
        userId:      row.id,
        name:        row.name,
        points:      row.total_points,
        quizCount:   row.total_quizzes,
        avgAccuracy: row.avg_accuracy || 0,
        lastActive:  row.last_active,
      }));

      /* Also return current user's rank even if outside top-N */
      const [[currentUser]] = await db.promise().query(
        `SELECT
           u.id,
           u.name,
           u.total_points,
           u.total_quizzes,
           (SELECT COUNT(*) + 1
            FROM users u2
            WHERE u2.total_points > u.total_points
              AND u2.is_active = 1) AS rank
         FROM users u
         WHERE u.id = ?`,
        [req.user.id]
      );

      return res.json({
        success: true,
        leaderboard,
        myRank: currentUser
          ? {
              rank:      currentUser.rank,
              name:      currentUser.name,
              points:    currentUser.total_points,
              quizCount: currentUser.total_quizzes,
            }
          : null,
      });
    } catch (err) {
      console.error('leaderboard error:', err.message);
      return res.status(500).json({ success: false, message: 'Failed to load leaderboard.' });
    }
  });


  console.log('✅ Groq routes mounted!');
  console.log('   POST /api/generate-quiz  — AI quiz generation');
  console.log('   POST /api/save-result    — saves scores + quizzes (transaction)');
  console.log('   GET  /api/my-results     — session list with aggregates');
  console.log('   GET  /api/result/:id     — full session detail from quizzes table');
  console.log('   GET  /api/stats          — analytics overview');
  console.log('   GET  /api/leaderboard    — global ranking by points');
};