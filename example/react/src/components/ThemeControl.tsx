interface ThemeColor {
  label: string
  value: string
}

interface ThemeControlProps {
  colors: ThemeColor[]
  value: string
  onChange: (value: string) => void
}

export default function ThemeControl({ colors, value, onChange }: ThemeControlProps) {
  return (
    <div className="theme-control" aria-label="Loading 主题色">
      {colors.map((color) => (
        <button
          key={color.value}
          className={`color-button${color.value === value ? ' active' : ''}`}
          type="button"
          aria-label={color.label}
          aria-pressed={color.value === value}
          onClick={() => onChange(color.value)}
        >
          <span className="swatch" style={{ backgroundColor: color.value }} />
          <span>{color.label}</span>
        </button>
      ))}
    </div>
  )
}
