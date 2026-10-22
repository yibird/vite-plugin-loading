export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeModeControlProps {
  value: ThemeMode
  onChange: (value: ThemeMode) => void
}

const modes: readonly ThemeMode[] = ['light', 'dark', 'system']
const labels: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
}

export default function ThemeModeControl({ value, onChange }: ThemeModeControlProps) {
  return (
    <div className="mode-control" aria-label="配色模式">
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          className={mode === value ? 'active' : ''}
          aria-pressed={mode === value}
          onClick={() => onChange(mode)}
        >
          {labels[mode]}
        </button>
      ))}
    </div>
  )
}
