import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { Spinner } from '../components/ui/spinner'
import Layout from './Layout'

const AdminPage = lazy(() => import('./pages/AdminPage'))
const ChugsPage = lazy(() => import('./pages/ChugsPage'))
const Home = lazy(() => import('./pages/HomePage'))
const SessionPage = lazy(() => import('./pages/SessionPage'))
const SessionsPage = lazy(() => import('./pages/SessionsPage'))
const TokensPage = lazy(() => import('./pages/TokensPage'))
const TournamentGroupPage = lazy(() => import('./pages/TournamentGroupPage'))
const TrackPage = lazy(() => import('./pages/TrackPage'))
const TracksPage = lazy(() => import('./pages/TracksPage'))
const UserPage = lazy(() => import('./pages/UserPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))

export default function AppRoutes() {
  return (
    <Suspense
      fallback={
        <main className='flex min-h-dvh-safe items-center justify-center'>
          <Spinner />
        </main>
      }>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path='chugs' element={<ChugsPage />} />
          <Route path='tracks' element={<TracksPage />} />
          <Route path='tracks/:id' element={<TrackPage />} />
          <Route path='users' element={<UsersPage />} />
          <Route path='users/:id' element={<UserPage />} />
          <Route path='sessions' element={<SessionsPage />} />
          <Route
            path='sessions/:id/tournament/groups/:groupId'
            element={<TournamentGroupPage />}
          />
          <Route path='sessions/:id' element={<SessionPage />} />
          <Route path='admin' element={<AdminPage />} />
          <Route path='tokens' element={<TokensPage />} />
          <Route path='*' element={<Navigate to='/' replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
