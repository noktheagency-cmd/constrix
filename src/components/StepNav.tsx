export function StepNav({ value, onChange, steps, label }: {
  value: string
  onChange: (value: string) => void
  steps: { id: string; label: string }[]
  label: string
}) {
  const current = steps.findIndex((step) => step.id === value)
  return <nav className="step-nav" aria-label={label}>
    {steps.map((step, index) => <button key={step.id} type="button" aria-current={value === step.id ? "step" : undefined} className={index < current ? "complete" : ""} onClick={() => onChange(step.id)}>
      <span className="step-number">{index + 1}</span><span>{step.label}</span>
    </button>)}
  </nav>
}
