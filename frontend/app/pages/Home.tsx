import TracksPage from './TracksPage'

export default function Home() {
  return (
    <div className='items-center-safe p-safe-or-2 flex flex-col gap-8'>
      <TracksPage
        isComponent
        className='border-border w-full max-w-2xl rounded-sm border'
      />
    </div>
  )
}
