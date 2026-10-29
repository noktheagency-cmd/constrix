import { stageLabel, type Stage } from "../procure/engine"

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={`stage-badge stage-${stage}`}>{stageLabel(stage)}</span>
}
