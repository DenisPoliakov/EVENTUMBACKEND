import { useEffect, useRef, useState } from 'react'

type Option = { value: string; label: string }

type Props = {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  fullWidth?: boolean
}

function Select({ options, value, onChange, placeholder = 'Выберите', disabled, fullWidth }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const currentLabel = options.find((o) => o.value === value)?.label || placeholder

  return (
    <div
      ref={ref}
      className="select-control"
      style={{ width: fullWidth ? '100%' : undefined, opacity: disabled ? 0.6 : 1 }}
    >
      <button
        type="button"
        className="select-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <span>{currentLabel}</span>
        <span className="chevron">▾</span>
      </button>
      {open && !disabled && (
        <div className="select-menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`select-item ${opt.value === value ? 'active' : ''}`}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Select
