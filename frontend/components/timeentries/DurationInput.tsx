import { useRef, type KeyboardEvent } from 'react'

const digitKeys = ['m10', 'm1', 's10', 's1', 'ms100', 'ms10', 'ms1']

export default function DurationInput({
  label,
  digits,
  onChange,
  disabled,
}: Readonly<{
  label: string
  digits: string[]
  onChange: (digits: string[]) => void
  disabled?: boolean
}>) {
  const inputs = useRef<HTMLInputElement[]>([])

  function setDigitAt(index: number, value: string) {
    if (value !== '' && !/^\d$/.test(value)) return
    if (index === 2 && Number(value) > 5) return
    const next = digits.slice()
    next[index] = value
    onChange(next)
  }

  function handleKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === 'Tab') return
    event.preventDefault()
    if (event.key === 'ArrowLeft') inputs.current[index - 1]?.focus()
    else if (event.key === ' ' || event.key === 'ArrowRight')
      inputs.current[index + 1]?.focus()
    else if (event.key === 'Backspace' || event.key === 'Delete') {
      setDigitAt(index, '')
      inputs.current[index - 1]?.focus()
    } else if (/^\d$/.test(event.key)) {
      setDigitAt(index, event.key)
      inputs.current[index + 1]?.focus()
    }
  }

  return (
    <div
      role='group'
      aria-label={`${label} (mm:ss.mmm)`}
      className='flex items-center justify-center gap-1'>
      {digits.map((digit, index) => (
        <span key={digitKeys[index]} className='flex items-center gap-1'>
          <input
            ref={element => {
              if (element) inputs.current[index] = element
            }}
            disabled={disabled}
            aria-label={`${label}, siffer ${index + 1}`}
            value={digit}
            onChange={event => setDigitAt(index, event.target.value)}
            placeholder='0'
            onKeyDown={event => handleKeyDown(index, event)}
            onFocus={event => event.currentTarget.select()}
            onClick={event => event.currentTarget.select()}
            className='font-f1-bold h-12 w-8 rounded-md border border-input bg-background text-center text-xl tabular-nums caret-transparent transition selection:bg-transparent invalid:border-red-500/30 invalid:bg-red-500/30 focus:border-primary focus:ring-ring sm:h-16 sm:w-12 sm:text-2xl dark:bg-input/30'
            inputMode='numeric'
            pattern={index === 2 ? '[0-5]' : '[0-9]'}
            maxLength={1}
          />
          {index === 1 && <span className='font-f1 text-2xl'>:</span>}
          {index === 3 && <span className='font-f1 text-2xl'>.</span>}
        </span>
      ))}
    </div>
  )
}
