'use client';

import { useState } from 'react';

interface SkillChipInputProps {
  skills: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  chipColor?: string; // hex color for chip background. Default: '#6366F1'
}

export function SkillChipInput({
  skills,
  onChange,
  placeholder = 'Add skill, press Enter',
  disabled = false,
  chipColor = '#6366F1',
}: SkillChipInputProps) {
  const [inputValue, setInputValue] = useState('');

  function addChip(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    onChange([...skills, trimmed]);
    setInputValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(inputValue);
    }
  }

  function removeChip(chip: string) {
    onChange(skills.filter((s) => s !== chip));
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-[#1E293B] bg-[#0F172A] focus-within:border-[#6366F1] min-h-[40px]">
      {skills.map((chip) => (
        <span
          key={chip}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
          style={{
            background: chipColor + '20',
            color: chipColor,
            border: '1px solid ' + chipColor + '40',
          }}
        >
          {chip}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeChip(chip)}
              className="hover:opacity-70 leading-none"
              aria-label={`Remove ${chip}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={skills.length === 0 ? placeholder : ''}
        readOnly={disabled}
        className="bg-transparent border-0 outline-none text-sm text-[#F9FAFB] placeholder-[#6B7280] flex-1 min-w-[120px]"
      />
    </div>
  );
}
