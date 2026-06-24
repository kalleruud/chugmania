import LoginCard from '@/components/user/LoginCard'
import loc from '@/lib/locales'

export default function LoginPage() {
  return (
    <main className='min-h-dvh-safe bg-background text-foreground'>
      <div className='mx-auto flex min-h-dvh-safe w-full max-w-md flex-col justify-center gap-8 py-safe-or-6 px-safe-or-4'>
        <section className='flex flex-col items-center gap-4 text-center'>
          <img
            src='/cm.svg'
            alt='Chugmania'
            className='h-auto w-48 max-w-full sm:w-56'
          />
          <div className='flex flex-col gap-2'>
            <h1 className='text-3xl text-primary sm:text-4xl'>
              {loc.no.chugmania}
            </h1>
            <p className='text-sm/6 text-muted-foreground sm:text-base/7'>
              {loc.no.user.login.description}
            </p>
          </div>
        </section>

        <section className='w-full shadow-xl shadow-black/20'>
          <LoginCard />
        </section>
      </div>
    </main>
  )
}
