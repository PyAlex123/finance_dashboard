// Анимации лендинга — перенос логики из <script type="text/x-dc"> макета:
// последовательное появление hero, въезд секций при скролле со стаггером,
// досчёт ключевых чисел и параллакс блобов. Один наблюдатель на всю страницу
// (как в оригинале), элементы помечены data-hero / data-reveal / data-count.
//
// prefers-reduced-motion — контент виден сразу, слушатели не вешаются.
// Страховочные таймеры из макета сохранены: контент не должен остаться скрытым,
// даже если IntersectionObserver недоступен (jsdom) или что-то пошло не так.

import { useEffect } from 'react'
import type { RefObject } from 'react'

const HERO_STEP = 120
const REVEAL_STEP = 80

function show(el: Element): void {
  el.classList.add('is-in')
}

/** Разряды неразрывным пробелом — как в макете. */
function format(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function countUp(el: HTMLElement): void {
  const target = parseFloat(el.dataset.count ?? '')
  if (!Number.isFinite(target)) return
  const suffix = /сум/.test(el.textContent ?? '') ? ' сум' : ''
  const start = performance.now()
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / 1000)
    const eased = 1 - Math.pow(1 - p, 3)
    el.textContent = format(target * eased) + suffix
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function useLandingMotion(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const heroes = Array.from(root.querySelectorAll<HTMLElement>('[data-hero]'))
    const reveals = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    const counters = Array.from(root.querySelectorAll<HTMLElement>('[data-count]'))
    const all = [...heroes, ...reveals]

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduced || typeof IntersectionObserver === 'undefined') {
      all.forEach(show)
      return
    }

    const timers: number[] = []

    // Hero — по очереди сразу после монтирования (превью последним и позже).
    heroes.forEach((el) => {
      const n = Number(el.dataset.hero ?? 1)
      timers.push(window.setTimeout(() => show(el), (n - 1) * HERO_STEP))
    })

    // Секции — по мере появления в окне, карточки внутри сетки со стаггером.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const n = Number(el.dataset.reveal ?? 1)
          timers.push(window.setTimeout(() => show(el), (n - 1) * REVEAL_STEP))
          io.unobserve(el)
        })
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    reveals.forEach((el) => io.observe(el))

    const ioCount = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          countUp(entry.target as HTMLElement)
          ioCount.unobserve(entry.target)
        })
      },
      { threshold: 0.5 },
    )
    counters.forEach((el) => ioCount.observe(el))

    // Страховка: что бы ни случилось, через 1.6/2.2 с всё видно.
    timers.push(window.setTimeout(() => reveals.forEach(show), 1600))
    timers.push(window.setTimeout(() => heroes.forEach(show), 2200))

    return () => {
      io.disconnect()
      ioCount.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [rootRef])
}

/**
 * Прилипшая шапка и параллакс блобов hero — обе вещи завязаны на scrollY,
 * поэтому один слушатель на всё (как в макете).
 */
export function useLandingScroll(
  barRef: RefObject<HTMLElement | null>,
  blobRefs: RefObject<HTMLElement | null>[],
): void {
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const factors = [0.06, -0.04]

    const onScroll = () => {
      const y = window.scrollY
      barRef.current?.classList.toggle('is-stuck', y > 8)
      if (reduced) return
      blobRefs.forEach((ref, i) => {
        const el = ref.current
        if (el) el.style.translate = `0 ${(y * factors[i]).toFixed(1)}px`
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
    // ссылки на элементы стабильны на всё время жизни страницы
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
