import React from 'react';

export function calculatePasswordStrength(password) {
  if (!password) return { score: 0, label: 'None', color: 'bg-gray-600', feedback: 'Enter a password' };

  let score = 0;
  const feedback = [];

  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('At least 8 characters');
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Uppercase & lowercase letters');
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('At least one number');
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('At least one special character (!@#$%^&*)');
  }

  switch (score) {
    case 1:
      return { score: 1, label: 'Weak', color: 'bg-[#F43F5E]', feedback: feedback[0] || 'Make it stronger' };
    case 2:
      return { score: 2, label: 'Fair', color: 'bg-[#F59E0B]', feedback: feedback[0] || 'Good start, add variety' };
    case 3:
      return { score: 3, label: 'Good', color: 'bg-[#06B6D4]', feedback: feedback[0] || 'Almost there' };
    case 4:
      return { score: 4, label: 'Strong', color: 'bg-[#10B981]', feedback: 'Great password!' };
    default:
      return { score: 0, label: 'Very Weak', color: 'bg-[#F43F5E]', feedback: 'Use at least 8 characters' };
  }
}

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;

  const { score, label, color, feedback } = calculatePasswordStrength(password);

  return (
    <div className="mt-2 space-y-1.5 animate-fadeIn">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[#94A3B8]">
          Strength: <span className={`font-semibold ${score >= 3 ? 'text-[#34D399]' : score === 2 ? 'text-[#F59E0B]' : 'text-[#F43F5E]'}`}>{label}</span>
        </span>
        <span className="text-[10px] text-[#64748B] italic">{feedback}</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full bg-[#1F293D] rounded-full overflow-hidden p-0.5">
        <div className={`h-full rounded-full transition-all duration-300 ${score >= 1 ? color : 'bg-transparent'}`} />
        <div className={`h-full rounded-full transition-all duration-300 ${score >= 2 ? color : 'bg-transparent'}`} />
        <div className={`h-full rounded-full transition-all duration-300 ${score >= 3 ? color : 'bg-transparent'}`} />
        <div className={`h-full rounded-full transition-all duration-300 ${score >= 4 ? color : 'bg-transparent'}`} />
      </div>
    </div>
  );
}
