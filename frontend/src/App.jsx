import React, { useState } from 'react'
import './App.css'
import ActivitySelector from './components/ActivitySelector'
import RouteInput from './components/RouteInput'
import EffortLevel from './components/EffortLevel'

function App() {
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [routeData, setRouteData] = useState({})
  const [selectedEffort, setSelectedEffort] = useState(null)

  return (
    <div className="app">
      <header>
        <h1>What Should I Wear?</h1>
        <p>Get clothing recommendations for your outdoor activities</p>
      </header>
      <main>
        <ActivitySelector 
          selectedActivity={selectedActivity}
          onSelectActivity={setSelectedActivity}
        />
        
        {selectedActivity && (
          <>
            <RouteInput onRouteChange={setRouteData} />
            <EffortLevel 
              selectedEffort={selectedEffort}
              onSelectEffort={setSelectedEffort}
            />
            
            <button 
              className="get-recommendations-btn"
              disabled={!selectedActivity || !selectedEffort || (!routeData.locations?.some(l => l) && !routeData.gpxFile) || !routeData.startTime}
            >
              Get Recommendations
            </button>
          </>
        )}
      </main>
    </div>
  )
}

export default App