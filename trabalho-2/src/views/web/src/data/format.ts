/** Formatação pt-BR usada em toda a interface. */

export const brl = (value: number, digits = 0) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

export const int = (value: number) => value.toLocaleString('pt-BR')

export const pct = (value: number, digits = 0) =>
  `${(value * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`

export const dec = (value: number, digits = 2) =>
  value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

export const signed = (value: number, format: (n: number) => string) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${format(Math.abs(value))}`
