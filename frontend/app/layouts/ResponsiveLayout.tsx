import { useDevice } from '../hooks/useDevice'
import DesktopLayout from './DesktopLayout'
import MobileLayout from './MobileLayout'

export default function ResponsiveLayout() {
  const device = useDevice()

  if (device === 'mobile') {
    return <MobileLayout />
  }

  return <DesktopLayout />
}
