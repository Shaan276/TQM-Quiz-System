/**
 * Frontend Question Code Generator Utility
 * Produces structured Question IDs: [SUBJECT]-[TYPE]-[DIFF]-[NUM]
 * e.g. TQM-MCQ-M-001, CS-MSQ-H-002, MATH-NUM-E-003
 */

export function generateSubjectCode(category = 'General') {
  if (!category || typeof category !== 'string') return 'GEN';
  const clean = category.trim();

  // Check for parenthesized acronyms like "TQM (Total Quality Management)"
  const parenMatch = clean.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1].length <= 5 && !parenMatch[1].includes(' ')) {
    return parenMatch[1].toUpperCase();
  }
  const beforeParen = clean.split('(')[0].trim();
  if (beforeParen.length <= 5 && !beforeParen.includes(' ') && beforeParen.length >= 2) {
    return beforeParen.toUpperCase();
  }

  const map = {
    'total quality management': 'TQM',
    'computer science': 'CS',
    'information technology': 'IT',
    'mathematics': 'MATH',
    'physics': 'PHY',
    'chemistry': 'CHEM',
    'biology': 'BIO',
    'engineering & tech': 'ENG',
    'engineering': 'ENG',
    'general knowledge': 'GK',
    'data structures': 'DSA',
    'machine learning': 'ML',
    'artificial intelligence': 'AI',
    'general': 'GEN'
  };

  const lower = clean.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (lower.includes(k)) return v;
  }

  const words = clean.split(/[\s_-]+/).filter(Boolean);
  if (words.length > 1) {
    const acronym = words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
    if (acronym.length >= 2) return acronym;
  }

  return clean.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'GEN';
}

export function generateTypeCode(type = 'MCQ_SINGLE') {
  const map = {
    'MCQ_SINGLE': 'MCQ',
    'MCQ_MULTI': 'MSQ',
    'TRUE_FALSE': 'TF',
    'FILL_BLANK': 'FIB',
    'SHORT_ANSWER': 'SA',
    'NUMERICAL': 'NUM'
  };
  return map[type] || 'MCQ';
}

export function generateDifficultyCode(diff = 'MEDIUM') {
  if (diff === 'EASY') return 'E';
  if (diff === 'HARD') return 'H';
  return 'M';
}

export function formatQuestionCode(subject = 'General', type = 'MCQ_SINGLE', difficulty = 'MEDIUM', sequence = 1) {
  const sCode = generateSubjectCode(subject);
  const tCode = generateTypeCode(type);
  const dCode = generateDifficultyCode(difficulty);
  const seqCode = String(sequence).padStart(3, '0');
  return `${sCode}-${tCode}-${dCode}-${seqCode}`;
}
