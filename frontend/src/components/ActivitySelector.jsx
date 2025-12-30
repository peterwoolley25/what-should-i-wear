import React from 'react'
import './ActivitySelector.css'

const ACTIVITIES = [
  { id: 'run', name: 'Run', icon: '🏃' },
  { id: 'mountain-bike', name: 'Mountain Bike', icon: '🚵' },
  { id: 'road-bike', name: 'Road Bike', icon: '🚴' },
  { id: 'downhill-ski', name: 'Downhill Ski', icon: '⛷️' },
  { id: 'backcountry-ski', name: 'Backcountry Ski', icon: '🎿' },
  { id: 'nordic-ski', name: 'Nordic Ski', icon: '⛷️' }
]

function ActivitySelector({ selectedActivity, onSelectActivity }) {
  return (
    <div className="activity-selector">
      <h2>Select Your Activity</h2>
      <div className="activity-grid">
        {ACTIVITIES.map(activity => (
          <button
            key={activity.id}
            className={`activity-card ${selectedActivity === activity.id ? 'selected' : ''}`}
            onClick={() => onSelectActivity(activity.id)}
          >
            <span className="activity-icon">{activity.icon}</span>
            <span className="activity-name">{activity.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ActivitySelector