import React, { useState } from 'react'
import './RouteInput.css'
import { parseGPXFile } from '../utils/gpxParser'

function RouteInput({ onRouteChange }) {
  const [inputMethod, setInputMethod] = useState('search')
  const [locations, setLocations] = useState([''])
  const [startTime, setStartTime] = useState('')
  const [gpxFile, setGpxFile] = useState(null)
  const [gpxData, setGpxData] = useState(null) // Store parsed GPX data
  const [isParsingGPX, setIsParsingGPX] = useState(false)
  const [gpxError, setGpxError] = useState(null)

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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // File size check (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setGpxError('File too large. Please upload a GPX file smaller than 5MB.')
      setGpxFile(null)
      return
    }

    setIsParsingGPX(true)
    setGpxError(null)

    try {
      const { points, metadata } = await parseGPXFile(file)
      setGpxFile(file)

      // Store parsed GPX data in state
      const parsedData = { points, metadata }
      setGpxData(parsedData)

      onRouteChange({
        locations,
        startTime,
        gpxFile: file,
        gpxPoints: points,
        gpxMetadata: metadata,
        inputMethod: 'gpx'
      })
    } catch (error) {
      setGpxError(error.message)
      setGpxFile(null)
      setGpxData(null)
      onRouteChange({ locations, startTime, gpxFile: null, inputMethod: 'search' })
    } finally {
      setIsParsingGPX(false)
    }
  }

  const handleStartTimeChange = (e) => {
    setStartTime(e.target.value)

    // Include GPX data if in GPX mode
    const changeData = {
      locations,
      startTime: e.target.value,
      gpxFile,
      inputMethod
    }

    if (inputMethod === 'gpx' && gpxData) {
      changeData.gpxPoints = gpxData.points
      changeData.gpxMetadata = gpxData.metadata
    }

    onRouteChange(changeData)
  }

  const handleInputMethodChange = (method) => {
    setInputMethod(method)
    setGpxError(null)

    // Clear GPX data when switching to search mode
    if (method === 'search') {
      setGpxFile(null)
      setGpxData(null)
    }

    const changeData = {
      locations,
      startTime,
      gpxFile: method === 'gpx' ? gpxFile : null,
      inputMethod: method
    }

    // Include GPX data if in GPX mode and data exists
    if (method === 'gpx' && gpxData) {
      changeData.gpxPoints = gpxData.points
      changeData.gpxMetadata = gpxData.metadata
    }

    onRouteChange(changeData)
  }

  return (
    <div className="route-input">
      <h2>Route & Timing</h2>
      
      <div className="input-method-toggle">
        <button
          className={inputMethod === 'search' ? 'active' : ''}
          onClick={() => handleInputMethodChange('search')}
        >
          Search Locations
        </button>
        <button
          className={inputMethod === 'gpx' ? 'active' : ''}
          onClick={() => handleInputMethodChange('gpx')}
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
          {gpxError && (
            <div style={{
              padding: '15px',
              background: '#ffebee',
              border: '2px solid #f44336',
              borderRadius: '8px',
              color: '#d32f2f',
              marginBottom: '15px',
              fontSize: '0.95rem'
            }}>
              {gpxError}
            </div>
          )}
          <label htmlFor="gpx-file" className="gpx-label">
            {isParsingGPX ? '⏳ Parsing GPX file...' : gpxFile ? `📁 ${gpxFile.name}` : '📁 Choose GPX File'}
          </label>
          <input
            id="gpx-file"
            type="file"
            accept=".gpx"
            onChange={handleFileUpload}
            className="gpx-input"
            disabled={isParsingGPX}
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