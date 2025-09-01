import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
}

export default function TimeInput({ value, onChange }: Props) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])

  function toValueFromDigits(arr: string[]): string {
    const minutes = `${arr[0] ?? '0'}${arr[1] ?? '0'}`
    const seconds = `${arr[2] ?? '0'}${arr[3] ?? '0'}`
    const centis = `${arr[4] ?? '0'}${arr[5] ?? '0'}`
    const minNum = String(Number.parseInt(minutes, 10) || 0)
    return `${minNum}:${seconds}.${centis}`
  }

  // Sync from external value only when parent clears it
  useEffect(() => {
    if (value === '' || value == null) {
      setDigits(['', '', '', '', '', ''])
    }
  }, [value])

  // Emit normalized string only when it differs from prop value to avoid loops
  useEffect(() => {
    const allEmpty = digits.every(d => d === '')
    const formatted = toValueFromDigits(digits)
    const out = allEmpty ? '' : formatted
    if (out !== (value ?? '')) onChange(out)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])

  function focusIndex(i: number) {
    const el = inputsRef.current[i]
    el?.focus()
    el?.select()
  }

  function handleChange(i: number, raw: string) {
    let val = raw.replace(/\D/g, '') // digits only
    if (val.length === 0) {
      // cleared
      setDigits(prev => prev.map((d, idx) => (idx === i ? '' : d)))
      return
    }
    // If user pasted multiple digits into a box, distribute forward
    const chars = val.slice(0, 6 - i).split('')
    setDigits(prev => {
      const next = prev.slice()
      let cursor = i
      for (const ch of chars) {
        if (cursor >= 6) break
        next[cursor] = ch
        cursor++
      }
      // Move focus to next empty or next index
      const nextIndex = Math.min(i + chars.length, 5)
      setTimeout(() => focusIndex(nextIndex), 0)
      return next
    })
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        // Clear current digit
        setDigits(prev => prev.map((d, idx) => (idx === i ? '' : d)))
        return
      }
      // Move back
      if (i > 0) setTimeout(() => focusIndex(i - 1), 0)
      return
    }
    if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault()
      setTimeout(() => focusIndex(i - 1), 0)
    }
    if (e.key === 'ArrowRight' && i < 5) {
      e.preventDefault()
      setTimeout(() => focusIndex(i + 1), 0)
    }
  }

  return (
    <div className='flex items-center gap-1 sm:gap-1.5 font-mono max-w-full'>
      {digits.map((d, i) => (
        <div key={i} className='flex items-center'>
          {/* Separators */}
          {i === 2 && (
            <span className='mx-1 text-slate-400 select-none'>:</span>
          )}
          {i === 4 && (
            <span className='mx-1 text-slate-400 select-none'>.</span>
          )}
          <input
            ref={el => {
              inputsRef.current[i] = el
            }}
            inputMode='numeric'
            pattern='[0-9]'
            maxLength={1}
            value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className='w-8 sm:w-10 text-center px-2 py-2 rounded-md bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-[var(--f1-accent)]/60'
          />
        </div>
      ))}
    </div>
  )
}
