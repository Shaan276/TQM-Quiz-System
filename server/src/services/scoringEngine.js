/**
 * Authoritative Scoring Engine for Quiz System
 * Handles secure, server-side grading across all 6 question types:
 * 1. MCQ_SINGLE
 * 2. MCQ_MULTI (partial scoring with negative marking penalties)
 * 3. TRUE_FALSE
 * 4. FILL_BLANK (normalization & variant matching)
 * 5. SHORT_ANSWER (variant matching)
 * 6. NUMERICAL (tolerance boundary checking)
 */

function normalizeText(text) {
  return (text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;!?]$/, '');
}

/**
 * Format human-readable string representation of a question's correct answer
 */
function formatCorrectAnswer(q) {
  if (['MCQ_SINGLE', 'TRUE_FALSE'].includes(q.question_type)) {
    const opt = (q.options || []).find(o => o.is_correct === 1);
    return opt ? opt.option_text : '';
  }
  if (q.question_type === 'MCQ_MULTI') {
    return (q.options || []).filter(o => o.is_correct === 1).map(o => o.option_text).join(', ');
  }
  if (['FILL_BLANK', 'SHORT_ANSWER'].includes(q.question_type)) {
    return (q.answers && q.answers[0]?.expected_answer) || '';
  }
  if (q.question_type === 'NUMERICAL') {
    const a = q.answers && q.answers[0];
    return a ? `${a.expected_answer}${a.numeric_tolerance ? ` (±${a.numeric_tolerance})` : ''}` : '';
  }
  return '';
}

/**
 * Format human-readable string representation of what the user answered
 */
function formatUserAnswer(q, rawUserAns) {
  if (rawUserAns === undefined || rawUserAns === null || String(rawUserAns).trim() === '') {
    return '(Unanswered)';
  }

  const ansStr = String(rawUserAns).trim();

  if (['MCQ_SINGLE', 'TRUE_FALSE'].includes(q.question_type)) {
    const opt = (q.options || []).find(o => 
      o.id === ansStr || 
      o.option_key === ansStr || 
      (o.option_text && o.option_text.toLowerCase() === ansStr.toLowerCase())
    );
    return opt ? opt.option_text : ansStr;
  }

  if (q.question_type === 'MCQ_MULTI') {
    let selectedValues = [];
    try {
      selectedValues = JSON.parse(ansStr);
      if (!Array.isArray(selectedValues)) selectedValues = [ansStr];
    } catch (e) {
      selectedValues = ansStr.split(',').map(s => s.trim());
    }
    return selectedValues.map(val => {
      const opt = (q.options || []).find(o => 
        o.id === val || 
        o.option_key === val || 
        (o.option_text && o.option_text.toLowerCase() === String(val).toLowerCase())
      );
      return opt ? opt.option_text : val;
    }).join(', ');
  }

  return ansStr;
}

/**
 * Authoritatively evaluate a single question answer
 * @param {Object} q Question definition with options/answers
 * @param {string|number|Array} rawUserAns User's submitted choice
 * @returns {Object} { isCorrect: 0|1, earnedScore: number, maxScore: number, correctAnswerDisplay: string, userAnswerDisplay: string, notes: string }
 */
function evaluateQuestionAnswer(q, rawUserAns) {
  const qMarks = Number(q.marks) || 1.0;
  const hasAnswer = rawUserAns !== undefined && rawUserAns !== null && String(rawUserAns).trim() !== '';

  const correctAnswerDisplay = formatCorrectAnswer(q);
  const userAnswerDisplay = formatUserAnswer(q, rawUserAns);

  if (!hasAnswer) {
    return {
      isCorrect: 0,
      earnedScore: 0.0,
      maxScore: qMarks,
      correctAnswerDisplay,
      userAnswerDisplay: '(Unanswered)',
      notes: 'Unanswered'
    };
  }

  const ansStr = String(rawUserAns).trim();
  let isCorrect = 0;
  let earnedScore = 0.0;
  let notes = '';

  switch (q.question_type) {
    case 'MCQ_SINGLE': {
      const correctOpt = (q.options || []).find(o => o.is_correct === 1);
      if (correctOpt && (
        ansStr === correctOpt.id || 
        ansStr.toLowerCase() === (correctOpt.option_key || '').toLowerCase() || 
        ansStr.toLowerCase() === (correctOpt.option_text || '').toLowerCase()
      )) {
        isCorrect = 1;
        earnedScore = qMarks;
      }
      break;
    }

    case 'MCQ_MULTI': {
      const correctOptions = (q.options || []).filter(o => o.is_correct === 1);
      let selectedValues = [];
      try {
        selectedValues = JSON.parse(ansStr);
        if (!Array.isArray(selectedValues)) selectedValues = [ansStr];
      } catch (e) {
        selectedValues = ansStr.split(',').map(s => s.trim());
      }

      const correctSet = new Set(
        correctOptions.flatMap(o => [
          o.id, 
          (o.option_key || '').toLowerCase(), 
          (o.option_text || '').toLowerCase()
        ])
      );

      let selectedCorrect = 0;
      let selectedIncorrect = 0;

      selectedValues.forEach(val => {
        const valStr = String(val).toLowerCase();
        if (correctSet.has(val) || correctSet.has(valStr)) {
          selectedCorrect++;
        } else {
          selectedIncorrect++;
        }
      });

      if (correctOptions.length > 0) {
        const proportion = selectedCorrect / correctOptions.length;
        const penalty = selectedIncorrect * 0.25;
        earnedScore = Math.max(0, (proportion * qMarks) - penalty);
        earnedScore = Math.round(earnedScore * 100) / 100;
        isCorrect = (selectedCorrect === correctOptions.length && selectedIncorrect === 0) ? 1 : 0;
        if (selectedIncorrect > 0) {
          notes = `Partial with penalty (-${penalty})`;
        }
      }
      break;
    }

    case 'TRUE_FALSE': {
      const correctOpt = (q.options || []).find(o => o.is_correct === 1);
      const expectedStr = correctOpt ? correctOpt.option_text.trim().toLowerCase() : '';
      const userStr = ansStr.toLowerCase();

      if (
        userStr === expectedStr || 
        (userStr === 'true' && (expectedStr === 'true' || correctOpt?.option_key === 'TRUE')) ||
        (userStr === 'false' && (expectedStr === 'false' || correctOpt?.option_key === 'FALSE')) ||
        (correctOpt && ansStr === correctOpt.id)
      ) {
        isCorrect = 1;
        earnedScore = qMarks;
      }
      break;
    }

    case 'FILL_BLANK': {
      const answerSpec = (q.answers && q.answers[0]) || {};
      const expected = (answerSpec.expected_answer || '').trim();
      const isCaseSensitive = answerSpec.is_case_sensitive === 1;
      const acceptedVariants = expected.split('|').map(s => s.trim());

      const userNorm = normalizeText(ansStr);
      const matched = acceptedVariants.some(variant => {
        const varNorm = normalizeText(variant);
        return isCaseSensitive
          ? userNorm === varNorm
          : userNorm.toLowerCase() === varNorm.toLowerCase();
      });

      if (matched) {
        isCorrect = 1;
        earnedScore = qMarks;
      }
      break;
    }

    case 'SHORT_ANSWER': {
      const answerSpec = (q.answers && q.answers[0]) || {};
      const expected = (answerSpec.expected_answer || '').trim();
      const isCaseSensitive = answerSpec.is_case_sensitive === 1;
      const acceptedVariants = expected.split('|').map(s => s.trim());

      const userNorm = normalizeText(ansStr);
      const matched = acceptedVariants.some(variant => {
        const varNorm = normalizeText(variant);
        return isCaseSensitive
          ? userNorm === varNorm
          : userNorm.toLowerCase() === varNorm.toLowerCase();
      });

      if (matched) {
        isCorrect = 1;
        earnedScore = qMarks;
      }
      break;
    }

    case 'NUMERICAL': {
      const answerSpec = (q.answers && q.answers[0]) || {};
      const expectedNum = parseFloat(answerSpec.expected_answer);
      const tolerance = parseFloat(answerSpec.numeric_tolerance) || 0.0;
      const userNum = parseFloat(ansStr);

      if (!isNaN(userNum) && !isNaN(expectedNum) && Math.abs(userNum - expectedNum) <= tolerance) {
        isCorrect = 1;
        earnedScore = qMarks;
      }
      break;
    }

    default:
      isCorrect = 0;
      earnedScore = 0;
  }

  return {
    isCorrect,
    earnedScore,
    maxScore: qMarks,
    correctAnswerDisplay,
    userAnswerDisplay,
    notes
  };
}

module.exports = {
  normalizeText,
  formatCorrectAnswer,
  formatUserAnswer,
  evaluateQuestionAnswer
};
