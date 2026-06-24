import LoginCard from '@/components/user/LoginCard'
import loc from '@/lib/locales'

export default function LoginPage() {
  return (
    <main className='relative min-h-dvh-safe overflow-hidden bg-background text-foreground'>
      <div className='absolute inset-0 bg-[linear-gradient(135deg,oklch(15%_0.003_17.255)_0%,oklch(18%_0.006_48)_45%,oklch(11%_0.004_24)_100%)]' />
      <div className='absolute inset-x-0 top-0 h-1 bg-primary' />
      <div className='absolute -top-24 right-[-18rem] h-96 w-[42rem] rotate-[-18deg] bg-primary/20 blur-3xl' />
      <div className='absolute bottom-[-10rem] left-[-14rem] h-80 w-[34rem] rotate-12 bg-secondary/20 blur-3xl' />
      <div className='absolute inset-0 [background-image:linear-gradient(115deg,transparent_0_42%,white_42%_43%,transparent_43%_56%,white_56%_57%,transparent_57%)] opacity-[0.08]' />

      <div className='relative mx-auto grid min-h-dvh-safe w-full max-w-6xl grid-cols-1 items-center gap-8 py-safe-or-6 px-safe-or-4 lg:grid-cols-[1fr_25rem] lg:px-safe-or-8'>
        <section className='flex min-h-64 flex-col justify-end gap-5 lg:min-h-[34rem]'>
          <img
            src='/cm.svg'
            alt='Chugmania'
            className='h-auto w-64 max-w-full'
          />
          <div className='flex max-w-2xl flex-col gap-3'>
            <h1 className='text-primary'>{loc.no.chugmania}</h1>
            <p className='max-w-xl text-lg/7 text-muted-foreground'>
              {loc.no.user.login.description}
            </p>
          </div>
          <div className='h-2 w-full max-w-xl overflow-hidden rounded-sm bg-background-secondary'>
            <div className='h-full w-2/3 bg-primary' />
          </div>
        </section>

        <section className='flex w-full items-center justify-center lg:justify-end'>
          <div className='w-full max-w-sm shadow-2xl shadow-black/40'>
            <LoginCard />
          </div>
        </section>
      </div>
    </main>
  )
}
