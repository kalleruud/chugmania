import { ChevronDown, ChevronUp } from 'lucide-react'
import Combobox, {
  type ComboboxLookupItem,
  type ComboboxProps,
} from './combobox'
import { Button } from './ui/button'

type ComboboxMultiProps<T extends ComboboxLookupItem> = Omit<
  ComboboxProps<T>,
  'selected' | 'setSelected'
> & {
  selected: T[]
  setSelected: (items: T[]) => void
}

export default function ComboboxMulti<T extends ComboboxLookupItem>({
  items,
  selected,
  setSelected,
  CustomRow,
  disabled,
  ...props
}: Readonly<ComboboxMultiProps<T>>) {
  function move(index: number, offset: number) {
    const next = [...selected]
    const [item] = next.splice(index, 1)
    next.splice(index + offset, 0, item)
    setSelected(next)
  }
  return (
    <div className='flex min-w-0 flex-col gap-2'>
      <Combobox
        {...props}
        items={items.filter(item => !selected.some(s => s.id === item.id))}
        selected={null}
        setSelected={item => {
          if (item) setSelected([...selected, item])
        }}
        CustomRow={CustomRow}
        disabled={disabled}
      />
      {selected.map((item, index) => (
        <div key={item.id} className='flex min-w-0 items-center gap-1 px-1'>
          <div className='mr-auto min-w-0 flex-1'>
            {CustomRow ? (
              <CustomRow item={item} hideLink className='w-full p-0' />
            ) : (
              <span>{item.label}</span>
            )}
          </div>
          <Button
            type='button'
            size='icon-sm'
            variant='ghost'
            aria-label={`Flytt ${item.label} opp`}
            disabled={disabled || index === 0}
            onClick={() => move(index, -1)}>
            <ChevronUp />
          </Button>
          <Button
            type='button'
            size='icon-sm'
            variant='ghost'
            aria-label={`Flytt ${item.label} ned`}
            disabled={disabled || index === selected.length - 1}
            onClick={() => move(index, 1)}>
            <ChevronDown />
          </Button>
          <Button
            type='button'
            size='icon-sm'
            variant='destructive'
            aria-label={`Fjern ${item.label}`}
            disabled={disabled}
            onClick={() => setSelected(selected.filter(s => s.id !== item.id))}>
            ×
          </Button>
        </div>
      ))}
    </div>
  )
}
