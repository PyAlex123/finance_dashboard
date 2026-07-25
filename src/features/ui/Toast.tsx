// Глобальные тосты. useToast() → flash(msg); один тост снизу по центру,
// авто-скрытие через 2.6 c. Провайдер оборачивает приложение в main.tsx.

import { createContext, useCallback, useContext, useRef, useState } from 'react'

type Flash = (msg: string) => void

const ToastContext = createContext<Flash>(() => {})

export function useToast(): Flash {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flash = useCallback<Flash>((m) => {
    setMsg(m)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(''), 2600)
  }, [])

  return (
    <ToastContext.Provider value={flash}>
      {children}
      {msg && (
        <div className="toast" role="status">
          <span className="toast__dot" />{msg}
        </div>
      )}
    </ToastContext.Provider>
  )
}
