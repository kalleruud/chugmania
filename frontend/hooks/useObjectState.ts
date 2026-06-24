import { useReducer } from 'react'

type ObjectStateAction<T> = Partial<T> | ((state: T) => Partial<T>)

export function useObjectState<T extends object>(initialState: T) {
  return useReducer(
    (state: T, action: ObjectStateAction<T>) => ({
      ...state,
      ...(typeof action === 'function' ? action(state) : action),
    }),
    initialState
  )
}
