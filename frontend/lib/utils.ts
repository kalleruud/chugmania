import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isPublishSubmit(e: { nativeEvent: SubmitEvent }): boolean {
  const submitter = e.nativeEvent.submitter
  return submitter instanceof HTMLButtonElement && submitter.value === 'publish'
}
