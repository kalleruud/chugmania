import LoginCard from '@/components/user/LoginCard'
import { TracksList } from './TracksPage'

export default function Home() {
  return (
    <div className='items-center-safe p-safe-or-2 flex flex-col'>
      <div className='flex w-full max-w-2xl flex-col gap-8'>
        <h1 className='text-primary'>Chugmania</h1>
        <LoginCard />
        <TracksList
          isComponent
          className='border-border rounded-sm border p-2'
        />
      </div>
    </div>
  )
}
