import React, { useState } from 'react'
import './RouteInput.css'

function RouteInput({ onRouteChange }) {
  const [inputMethod, setInputMethod] = useState('search')
  const [locations, setLocations] = useState([''])
  const [startTime, setStartTime] = useState('')
  const [gpxFile, setGpxFile] = useState(null)

  const handleAddLocation = () => {
    if (locations.length < 3) {
      setLocations([...locations, ''])
    }
  }

  const handleLocationChange = (index, value) => {
    const newLocations = [...locations]
    newLocations[index] = value
    setLocations(newLocations)
    onRouteChange({ locations: newLocations, startTime, gpxFile })
  }

  const handleRemoveLocation = (index) => {
    const newLocations = locations.filter((_, i) => i !== index)
    setLocations(newLocations)
    onRouteChange({ locations: newLocations, startTime, gpxFile })
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    setGpxFile(file)
    onRouteChange({ locations, startTime, gpxFile: file })
  }

  const handleStartTimeChange = (e) => {
    setStartTime(e.target.value)
    onRouteChange({ locations, startTime: e.target.value, gpxFile })
  }

  return (
    <div className="route-input">
      <h2>Route & Timing</h2>
      
      <div className="input-method-toggle">
        <button 
          className={inputMethod === 'search' ? 'active' : ''}
          onClick={() => setInputMethod('search')}
        >
          Search Locations
        </button>
        <button 
          className={inputMethod === 'gpx' ? 'active' : ''}
          onClick={() => setInputMethod('gpx')}
        >
          Upload GPX
        </button>
      </div>

      {inputMethod === 'search' ? (
        <div className="location-search">
          {locations.map((location, index) => (
            <div key={index} className="location-input-group">
              <input
                type="text"
                placeholder={`Location ${index + 1}`}
                value={location}
                onChange={(e) => handleLocationChange(index, e.target.value)}
                className="location-input"
              />
              {locations.length > 1 && (
                <button 
                  onClick={() => handleRemoveLocation(index)}
                  className="remove-btn"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {locations.length < 3 && (
            <button onClick={handleAddLocation} className="add-location-btn">
              + Add Location (max 3)
            </button>
          )}
        </div>
      ) : (
        <div className="gpx-upload">
          <label htmlFor="gpx-file" className="gpx-label">
            {gpxFile ? `📁 ${gpxFile.name}` : '📁 Choose GPX File'}
          </label>
          <input
            id="gpx-file"
            type="file"
            accept=".gpx"
            onChange={handleFileUpload}
            className="gpx-input"
          />
        </div>
      )}

      <div className="start-time-group">
        <label htmlFor="start-time">Start Time</label>
        <input
          id="start-time"
          type="datetime-local"
          value={startTime}
          onChange={handleStartTimeChange}
          className="time-input"
        />
      </div>
    </div>
  )
}

export default RouteInput