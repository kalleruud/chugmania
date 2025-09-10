import { useRef, useState } from 'react'

type Props = Readonly<{ trackId?: string }>

const maxValues = { minutes: 59, seconds: 59 }

export default function LapTimeInput({ trackId }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [user, setUser] = useState('')
  const [track, setTrack] = useState(trackId ?? '')
  const [comment, setComment] = useState('')
  const inputs = useRef<HTMLInputElement[]>([])

  const handleChange = (index: number, value: string) => {
    if (value !== '' && !/^[0-9]$/.test(value)) return
    const nextDigits = [...digits]
    nextDigits[index] = value
    setDigits(nextDigits)
    if (value) {
      const next = inputs.current[index + 1]
      if (next) next.focus()
    }
  }

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      const next = [...digits]
      next[index] = e.key
      setDigits(next)
      inputs.current[index + 1]?.focus()
      return
    }
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...digits]
      if (next[index]) {
        next[index] = ''
        setDigits(next)
      } else if (index > 0) {
        next[index - 1] = ''
        setDigits(next)
        inputs.current[index - 1]?.focus()
      }
      return
    }
    if (e.key === 'ArrowLeft') inputs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight') inputs.current[index + 1]?.focus()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = digits.map(d => (d ? d : '0')).join('')
    const minutes = parseInt(t.slice(0, 2))
    const seconds = parseInt(t.slice(2, 4))
    const hundredths = parseInt(t.slice(4))
    if (
      minutes > maxValues.minutes ||
      seconds > maxValues.seconds ||
      (minutes === 0 && seconds === 0 && hundredths === 0)
    ) {
      alert('Invalid lap time')
      return
    }
    const time = `${t.slice(0, 2)}:${t.slice(2, 4)}.${t.slice(4)}`
    console.log({ user, track, comment, time })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4'
    >
      <div className='flex items-center justify-center gap-1'>
        {digits.map((d, i) => (
          <>
            <input
              key={i}
              ref={el => {
                if (el) inputs.current[i] = el
              }}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={e => e.target.select()}
              className='focus:ring-accent/60 focus:border-accent h-12 w-10 rounded-md border border-white/10 bg-white/5 text-center text-lg outline-none transition focus:ring-2'
              inputMode='numeric'
              maxLength={1}
            />
            {i === 1 && <span className='text-xl'>:</span>}
            {i === 3 && <span className='text-xl'>.</span>}
          </>
        ))}
      </div>
      <div className='flex gap-2'>
        <input
          list='users'
          value={user}
          onChange={e => setUser(e.target.value)}
          placeholder='User'
          className='focus:ring-accent/60 focus:border-accent flex-1 rounded-md border border-white/10 bg-white/5 p-2 outline-none transition focus:ring-2'
        />
        <datalist id='users'>
          <option value='You' />
          <option value='Alice' />
          <option value='Bob' />
        </datalist>
        <input
          list='tracks'
          value={track}
          onChange={e => setTrack(e.target.value)}
          placeholder='Track'
          className='focus:ring-accent/60 focus:border-accent flex-1 rounded-md border border-white/10 bg-white/5 p-2 outline-none transition focus:ring-2'
        />
        <datalist id='tracks'>
          <option value='1'>#01</option>
          <option value='2'>#02</option>
        </datalist>
      </div>
      <input
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder='Comment'
        className='focus:ring-accent/60 focus:border-accent rounded-md border border-white/10 bg-white/5 p-2 outline-none transition focus:ring-2'
      />
      <button
        type='submit'
        className='bg-accent text-background font-f1-bold rounded-md px-4 py-2 uppercase'
      >
        Submit
      </button>
    </form>
  )
}

