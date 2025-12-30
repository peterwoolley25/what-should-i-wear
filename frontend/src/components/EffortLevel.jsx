import React from 'react'
import './EffortLevel.css'

const EFFORT_LEVELS = [
  { id: 'easy', name: 'Easy', description: 'Conversational pace' },
  { id: 'endurance', name: 'Endurance', description: 'Steady, sustained effort' },
  { id: 'tempo', name: 'Tempo', description: 'Comfortably hard' },
  { id: 'all-out', name: 'All Out', description: 'Maximum effort' }
]

function EffortLevel({ selectedEffort, onSelectEffort }) {
  return (
    <div className="effort-level">
      <h2>Effort Level</h2>
      <div className="effort-grid">
        {EFFORT_LEVELS.map(effort => (
          <button
            key={effort.id}
            className={`effort-card ${selectedEffort === effort.id ? 'selected' : ''}`}
            onClick={() => onSelectEffort(effort.id)}
          >
            <span className="effort-name">{effort.name}</span>
            <span className="effort-description">{effort.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default EffortLevel