import { useEffect, useState } from 'react'

export type DeviceType = 'mobile' | 'desktop'

export function useDevice(): DeviceType {
  const [device, setDevice] = useState<DeviceType>('desktop')

  useEffect(() => {
    const checkDevice = () => {
      setDevice(window.innerWidth < 640 ? 'mobile' : 'desktop')
    }

    checkDevice()

    const mediaQuery = globalThis.matchMedia('(max-width: 639px)')
    const handleChange = (e: MediaQueryListEvent) => {
      setDevice(e.matches ? 'mobile' : 'desktop')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return device
}
