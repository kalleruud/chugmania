import TracksPage from './Tracks'

export default function Home() {
  return (
    <div className='items-center-safe flex flex-col gap-8 p-2'>
      <TracksPage
        isComponent
        className='border-border w-full max-w-2xl rounded-sm border'
      />
    </div>
  )
}
