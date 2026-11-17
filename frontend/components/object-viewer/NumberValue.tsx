import { DEFAULT_LOCALE } from '@common/utils/date'

const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  maximumSignificantDigits: 21,
})
const integerFormatter = new Intl.NumberFormat(DEFAULT_LOCALE)

export default function NumberValue({
  value,
}: Readonly<{ value: number | bigint }>) {
  return (
    <span className='font-mono break-all tabular-nums'>
      {typeof value === 'bigint'
        ? integerFormatter.format(value)
        : formatter.format(value)}
    </span>
  )
}
