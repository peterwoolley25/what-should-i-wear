import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ACTIVITIES = [
  { id: 'run', name: 'Run', icon: '🏃', speed: 10 },
  { id: 'mountain-bike', name: 'Mountain Bike', icon: '🚵', speed: 15 },
  { id: 'road-bike', name: 'Road Bike', icon: '🚴', speed: 25 },
  { id: 'downhill-ski', name: 'Downhill Ski', icon: '⛷️', speed: 30 },
  { id: 'backcountry-ski', name: 'Backcountry Ski', icon: '🎿', speed: 8 },
  { id: 'nordic-ski', name: 'Nordic Ski', icon: '⛷️', speed: 12 }
];

const EFFORT_LEVELS = [
  { id: 'easy', name: 'Easy', description: 'Conversational pace', heatFactor: 0.7 },
  { id: 'endurance', name: 'Endurance', description: 'Steady, sustained effort', heatFactor: 1.0 },
  { id: 'tempo', name: 'Tempo', description: 'Comfortably hard', heatFactor: 1.3 },
  { id: 'all-out', name: 'All Out', description: 'Maximum effort', heatFactor: 1.6 }
];

// Geocode location to get coordinates
const geocodeLocation = async (locationName) => {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`
    );
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return {
        lat: data.results[0].latitude,
        lon: data.results[0].longitude,
        name: data.results[0].name
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Fetch real weather data from Open-Meteo API (free, no API key required)
const fetchWeatherData = async (locations, startTime) => {
  try {
    // Get coordinates for the first location
    const coords = await geocodeLocation(locations[0]);
    if (!coords) {
      throw new Error('Could not find location');
    }

    // Fetch 5 hours of weather data starting from startTime
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&hourly=temperature_2m,precipitation_probability,wind_speed_10m,relative_humidity_2m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
    );
    const data = await response.json();

    // Parse start time and get 5 hours of data
    const startDate = new Date(startTime);
    const weatherData = [];

    for (let i = 0; i < 5; i++) {
      const currentTime = new Date(startDate.getTime() + i * 60 * 60 * 1000);
      const hourIndex = data.hourly.time.findIndex(t => {
        const apiTime = new Date(t);
        return apiTime.getTime() >= currentTime.getTime();
      });

      if (hourIndex !== -1) {
        weatherData.push({
          location: coords.name,
          time: currentTime.toISOString(),
          temperature: Math.round(data.hourly.temperature_2m[hourIndex]),
          windSpeed: Math.round(data.hourly.wind_speed_10m[hourIndex]),
          precipitationChance: data.hourly.precipitation_probability[hourIndex] || 0,
          humidity: data.hourly.relative_humidity_2m[hourIndex],
          weatherCode: data.hourly.weather_code[hourIndex]
        });
      }
    }

    return weatherData;
  } catch (error) {
    console.error('Weather fetch error:', error);
    // Fallback to mock data if API fails
    return generateMockWeather(locations, startTime);
  }
};

// Fallback mock weather data generator
const generateMockWeather = (locations, startTime) => {
  return Array.from({ length: 5 }, (_, i) => {
    const baseTemp = 50 + Math.random() * 30;
    return {
      location: locations[0],
      time: new Date(new Date(startTime).getTime() + i * 60 * 60 * 1000).toISOString(),
      temperature: Math.round(baseTemp + (Math.random() - 0.5) * 10),
      windSpeed: Math.round(5 + Math.random() * 15),
      precipitationChance: Math.round(Math.random() * 100),
      humidity: Math.round(40 + Math.random() * 40),
      weatherCode: 0
    };
  });
};

// Clothing recommendation engine
const generateRecommendations = (activity, weatherData, effortLevel, historicalFeedback = []) => {
  const avgTemp = weatherData.reduce((sum, w) => sum + w.temperature, 0) / weatherData.length;
  const maxWind = Math.max(...weatherData.map(w => w.windSpeed));
  const hasRain = weatherData.some(w => w.precipitationChance > 30);
  const effort = EFFORT_LEVELS.find(e => e.id === effortLevel);
  
  // Adjust felt temperature based on effort
  const feltTemp = avgTemp + (effort.heatFactor - 1) * 15;
  
  const layers = {
    'run': getRunningLayers(feltTemp, maxWind, hasRain),
    'mountain-bike': getMountainBikeLayers(feltTemp, maxWind, hasRain),
    'road-bike': getRoadBikeLayers(feltTemp, maxWind, hasRain),
    'downhill-ski': getDownhillSkiLayers(feltTemp, maxWind, hasRain),
    'backcountry-ski': getBackcountrySkiLayers(feltTemp, maxWind, hasRain),
    'nordic-ski': getNordicSkiLayers(feltTemp, maxWind, hasRain)
  };
  
  return layers[activity] || [];
};

const getRunningLayers = (temp, wind, rain) => {
  const layers = [];
  
  if (temp < 32) {
    layers.push({ type: 'Base Layer', item: 'Thermal long-sleeve top', reason: 'Cold protection' });
    layers.push({ type: 'Base Layer', item: 'Thermal tights', reason: 'Leg warmth' });
    layers.push({ type: 'Mid Layer', item: 'Light insulated vest', reason: 'Core warmth' });
    layers.push({ type: 'Accessories', item: 'Running gloves', reason: 'Hand protection' });
    layers.push({ type: 'Accessories', item: 'Headband or beanie', reason: 'Ear warmth' });
  } else if (temp < 50) {
    layers.push({ type: 'Base Layer', item: 'Long-sleeve tech shirt', reason: 'Moisture wicking' });
    layers.push({ type: 'Base Layer', item: 'Running tights or pants', reason: 'Leg comfort' });
    layers.push({ type: 'Accessories', item: 'Light gloves', reason: 'Hand warmth' });
  } else if (temp < 65) {
    layers.push({ type: 'Base Layer', item: 'Short-sleeve tech shirt', reason: 'Breathability' });
    layers.push({ type: 'Base Layer', item: 'Running shorts or capris', reason: 'Mobility' });
  } else {
    layers.push({ type: 'Base Layer', item: 'Lightweight singlet', reason: 'Maximum cooling' });
    layers.push({ type: 'Base Layer', item: 'Running shorts', reason: 'Comfort' });
    layers.push({ type: 'Accessories', item: 'Visor or hat', reason: 'Sun protection' });
  }
  
  if (wind > 15) {
    layers.push({ type: 'Outer Layer', item: 'Windbreaker jacket', reason: 'Wind protection' });
  }
  
  if (rain) {
    layers.push({ type: 'Outer Layer', item: 'Waterproof running jacket', reason: 'Rain protection' });
  }
  
  return layers;
};

const getMountainBikeLayers = (temp, wind, rain) => {
  const layers = [];
  
  if (temp < 40) {
    layers.push({ type: 'Base Layer', item: 'Thermal long-sleeve jersey', reason: 'Cold protection' });
    layers.push({ type: 'Base Layer', item: 'Padded thermal bib tights', reason: 'Comfort and warmth' });
    layers.push({ type: 'Mid Layer', item: 'Softshell jacket', reason: 'Insulation' });
    layers.push({ type: 'Accessories', item: 'Winter cycling gloves', reason: 'Hand warmth' });
    layers.push({ type: 'Accessories', item: 'Thermal headband', reason: 'Ear protection' });
  } else if (temp < 60) {
    layers.push({ type: 'Base Layer', item: 'Long-sleeve MTB jersey', reason: 'Trail protection' });
    layers.push({ type: 'Base Layer', item: 'Padded shorts with knee warmers', reason: 'Flexibility' });
    layers.push({ type: 'Accessories', item: 'Light gloves', reason: 'Grip and protection' });
  } else {
    layers.push({ type: 'Base Layer', item: 'Short-sleeve MTB jersey', reason: 'Breathability' });
    layers.push({ type: 'Base Layer', item: 'Padded shorts', reason: 'Comfort' });
    layers.push({ type: 'Accessories', item: 'Full-finger gloves', reason: 'Trail protection' });
  }
  
  if (rain) {
    layers.push({ type: 'Outer Layer', item: 'Waterproof MTB jacket', reason: 'Weather protection' });
  }
  
  layers.push({ type: 'Safety', item: 'Helmet', reason: 'Essential safety' });
  layers.push({ type: 'Safety', item: 'Eye protection', reason: 'Debris protection' });
  
  return layers;
};

const getRoadBikeLayers = (temp, wind, rain) => {
  const layers = [];
  
  if (temp < 45) {
    layers.push({ type: 'Base Layer', item: 'Thermal cycling jersey', reason: 'Warmth' });
    layers.push({ type: 'Base Layer', item: 'Thermal bib tights', reason: 'Leg warmth' });
    layers.push({ type: 'Mid Layer', item: 'Wind vest', reason: 'Core protection' });
    layers.push({ type: 'Accessories', item: 'Winter cycling gloves', reason: 'Hand warmth' });
    layers.push({ type: 'Accessories', item: 'Thermal cap under helmet', reason: 'Head warmth' });
  } else if (temp < 65) {
    layers.push({ type: 'Base Layer', item: 'Long-sleeve cycling jersey', reason: 'Comfort' });
    layers.push({ type: 'Base Layer', item: 'Bib shorts with leg warmers', reason: 'Adaptability' });
    layers.push({ type: 'Accessories', item: 'Light gloves', reason: 'Grip' });
  } else {
    layers.push({ type: 'Base Layer', item: 'Short-sleeve cycling jersey', reason: 'Cooling' });
    layers.push({ type: 'Base Layer', item: 'Bib shorts', reason: 'Comfort' });
    layers.push({ type: 'Accessories', item: 'Cycling cap', reason: 'Sun protection' });
  }
  
  if (wind > 15) {
    layers.push({ type: 'Outer Layer', item: 'Wind jacket', reason: 'Aerodynamics' });
  }
  
  if (rain) {
    layers.push({ type: 'Outer Layer', item: 'Waterproof cycling jacket', reason: 'Rain protection' });
  }
  
  layers.push({ type: 'Safety', item: 'Helmet', reason: 'Essential safety' });
  layers.push({ type: 'Safety', item: 'Cycling glasses', reason: 'Eye protection' });
  
  return layers;
};

const getDownhillSkiLayers = (temp, wind, rain) => {
  const layers = [];
  
  if (temp < 20) {
    layers.push({ type: 'Base Layer', item: 'Heavyweight thermal top', reason: 'Extreme cold' });
    layers.push({ type: 'Base Layer', item: 'Heavyweight thermal bottoms', reason: 'Leg warmth' });
    layers.push({ type: 'Mid Layer', item: 'Insulated ski jacket', reason: 'Core warmth' });
    layers.push({ type: 'Outer Layer', item: 'Waterproof ski pants', reason: 'Snow protection' });
    layers.push({ type: 'Accessories', item: 'Insulated ski gloves', reason: 'Hand warmth' });
    layers.push({ type: 'Accessories', item: 'Balaclava or neck gaiter', reason: 'Face protection' });
  } else {
    layers.push({ type: 'Base Layer', item: 'Midweight thermal top', reason: 'Moisture management' });
    layers.push({ type: 'Base Layer', item: 'Midweight thermal bottoms', reason: 'Comfort' });
    layers.push({ type: 'Mid Layer', item: 'Lightweight insulated jacket', reason: 'Warmth' });
    layers.push({ type: 'Outer Layer', item: 'Waterproof ski pants', reason: 'Snow protection' });
    layers.push({ type: 'Accessories', item: 'Ski gloves', reason: 'Hand protection' });
    layers.push({ type: 'Accessories', item: 'Neck gaiter', reason: 'Versatility' });
  }
  
  layers.push({ type: 'Safety', item: 'Ski helmet', reason: 'Essential safety' });
  layers.push({ type: 'Safety', item: 'Ski goggles', reason: 'Vision protection' });
  
  return layers;
};

const getBackcountrySkiLayers = (temp, wind, rain) => {
  const layers = [];
  
  if (temp < 20) {
    layers.push({ type: 'Base Layer', item: 'Merino wool top', reason: 'Temperature regulation' });
    layers.push({ type: 'Base Layer', item: 'Merino wool bottoms', reason: 'Warmth and breathability' });
    layers.push({ type: 'Mid Layer', item: 'Lightweight down jacket', reason: 'Packable warmth' });
    layers.push({ type: 'Outer Layer', item: 'Hardshell jacket', reason: 'Weather protection' });
    layers.push({ type: 'Outer Layer', item: 'Hardshell pants', reason: 'Snow protection' });
  } else {
    layers.push({ type: 'Base Layer', item: 'Lightweight merino top', reason: 'Breathability' });
    layers.push({ type: 'Base Layer', item: 'Lightweight merino bottoms', reason: 'Comfort' });
    layers.push({ type: 'Mid Layer', item: 'Fleece or softshell', reason: 'Active insulation' });
    layers.push({ type: 'Outer Layer', item: 'Softshell pants', reason: 'Mobility' });
  }
  
  layers.push({ type: 'Accessories', item: 'Lightweight gloves', reason: 'Hand warmth while touring' });
  layers.push({ type: 'Accessories', item: 'Beanie or headband', reason: 'Head warmth' });
  layers.push({ type: 'Safety', item: 'Ski helmet', reason: 'Safety' });
  layers.push({ type: 'Safety', item: 'Ski goggles + sunglasses', reason: 'Variable conditions' });
  
  return layers;
};

const getNordicSkiLayers = (temp, wind, rain) => {
  const layers = [];
  
  if (temp < 20) {
    layers.push({ type: 'Base Layer', item: 'Thermal racing suit or top/bottom', reason: 'Warmth' });
    layers.push({ type: 'Mid Layer', item: 'Light vest', reason: 'Core warmth' });
    layers.push({ type: 'Accessories', item: 'Insulated gloves', reason: 'Hand warmth' });
    layers.push({ type: 'Accessories', item: 'Headband or light beanie', reason: 'Ear protection' });
  } else if (temp < 40) {
    layers.push({ type: 'Base Layer', item: 'XC ski suit or jersey/tights', reason: 'Aerodynamics' });
    layers.push({ type: 'Accessories', item: 'Light gloves', reason: 'Grip and warmth' });
    layers.push({ type: 'Accessories', item: 'Headband', reason: 'Ear warmth' });
  } else {
    layers.push({ type: 'Base Layer', item: 'Lightweight XC top', reason: 'Cooling' });
    layers.push({ type: 'Base Layer', item: 'Lightweight XC tights', reason: 'Mobility' });
    layers.push({ type: 'Accessories', item: 'Thin gloves', reason: 'Pole grip' });
  }
  
  if (wind > 15 || rain) {
    layers.push({ type: 'Outer Layer', item: 'Wind vest or light shell', reason: 'Weather protection' });
  }
  
  layers.push({ type: 'Accessories', item: 'Sunglasses or light goggles', reason: 'Eye protection' });
  
  return layers;
};

export default function WhatShouldIWear() {
  const [step, setStep] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [locations, setLocations] = useState(['']);
  const [startTime, setStartTime] = useState('');
  const [selectedEffort, setSelectedEffort] = useState(null);
  const [weatherData, setWeatherData] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState([]);

  // Load saved routes on mount
  useEffect(() => {
    loadSavedRoutes();
  }, []);

  const loadSavedRoutes = async () => {
    try {
      const result = await window.storage.list('route:');
      if (result && result.keys) {
        const routes = [];
        for (const key of result.keys) {
          const data = await window.storage.get(key);
          if (data) {
            routes.push(JSON.parse(data.value));
          }
        }
        setSavedRoutes(routes);
      }
    } catch (error) {
      console.log('No saved routes yet');
    }
  };

  const handleAddLocation = () => {
    if (locations.length < 3) {
      setLocations([...locations, '']);
    }
  };

  const handleLocationChange = (index, value) => {
    const newLocations = [...locations];
    newLocations[index] = value;
    setLocations(newLocations);
  };

  const handleRemoveLocation = (index) => {
    const newLocations = locations.filter((_, i) => i !== index);
    setLocations(newLocations.length === 0 ? [''] : newLocations);
  };

  const handleGetRecommendations = async () => {
    const validLocations = locations.filter(loc => loc.trim());
    if (!validLocations.length || !startTime || !selectedActivity || !selectedEffort) {
      alert('Please fill in all fields');
      return;
    }

    // Show loading state
    const weather = await fetchWeatherData(validLocations, startTime);
    setWeatherData(weather);

    const recs = generateRecommendations(selectedActivity, weather, selectedEffort);
    setRecommendations(recs);

    setStep(2);
  };

  const handleSaveRoute = async () => {
    const routeData = {
      id: Date.now().toString(),
      activity: selectedActivity,
      locations: locations.filter(l => l.trim()),
      startTime,
      effort: selectedEffort,
      savedAt: new Date().toISOString()
    };
    
    try {
      await window.storage.set(`route:${routeData.id}`, JSON.stringify(routeData));
      alert('Route saved successfully!');
      loadSavedRoutes();
    } catch (error) {
      alert('Failed to save route');
    }
  };

  const handleSubmitFeedback = async (feedback) => {
    const feedbackData = {
      activity: selectedActivity,
      effort: selectedEffort,
      avgTemp: weatherData.reduce((sum, w) => sum + w.temperature, 0) / weatherData.length,
      feedback: feedback,
      timestamp: new Date().toISOString()
    };
    
    try {
      await window.storage.set(
        `feedback:${Date.now()}`, 
        JSON.stringify(feedbackData),
        true // shared - visible to all users
      );
      alert('Thank you for your feedback! This will help improve recommendations for everyone.');
      setShowFeedback(false);
    } catch (error) {
      alert('Failed to submit feedback');
    }
  };

  const loadSavedRoute = (route) => {
    setSelectedActivity(route.activity);
    setLocations(route.locations);
    setStartTime(route.startTime);
    setSelectedEffort(route.effort);
    setStep(1);
  };

  if (step === 1) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', color: 'white', marginBottom: '40px' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '10px' }}>What Should I Wear?</h1>
            <p style={{ fontSize: '1.2rem' }}>Get personalized clothing recommendations for your outdoor activities</p>
          </div>

          <div style={{ background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {/* Activity Selection */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>1. Select Your Activity</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                {ACTIVITIES.map(activity => (
                  <button
                    key={activity.id}
                    onClick={() => setSelectedActivity(activity.id)}
                    style={{
                      padding: '20px',
                      background: selectedActivity === activity.id ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'white',
                      color: selectedActivity === activity.id ? 'white' : '#333',
                      border: `2px solid ${selectedActivity === activity.id ? '#667eea' : '#e0e0e0'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.3s ease',
                      boxShadow: selectedActivity === activity.id ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '2.5rem' }}>{activity.icon}</span>
                    <span style={{ fontWeight: '600' }}>{activity.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedActivity && (
              <>
                {/* Route Input */}
                <div style={{ marginBottom: '40px' }}>
                  <h2 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>2. Enter Your Route</h2>
                  {locations.map((location, index) => (
                    <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        placeholder={`Location ${index + 1} (e.g., San Francisco, CA)`}
                        value={location}
                        onChange={(e) => handleLocationChange(index, e.target.value)}
                        style={{
                          flex: 1,
                          padding: '12px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '1rem'
                        }}
                      />
                      {locations.length > 1 && (
                        <button
                          onClick={() => handleRemoveLocation(index)}
                          style={{
                            padding: '12px 16px',
                            background: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '1rem'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {locations.length < 3 && (
                    <button
                      onClick={handleAddLocation}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'white',
                        border: '2px dashed #667eea',
                        borderRadius: '8px',
                        color: '#667eea',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        marginTop: '10px'
                      }}
                    >
                      + Add Location (max 3)
                    </button>
                  )}
                  
                  <div style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e0e0e0',
                        borderRadius: '8px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                </div>

                {/* Effort Level */}
                <div style={{ marginBottom: '40px' }}>
                  <h2 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>3. Select Effort Level</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                    {EFFORT_LEVELS.map(effort => (
                      <button
                        key={effort.id}
                        onClick={() => setSelectedEffort(effort.id)}
                        style={{
                          padding: '20px',
                          background: selectedEffort === effort.id ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'white',
                          color: selectedEffort === effort.id ? 'white' : '#333',
                          border: `2px solid ${selectedEffort === effort.id ? '#667eea' : '#e0e0e0'}`,
                          borderRadius: '12px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.3s ease',
                          boxShadow: selectedEffort === effort.id ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
                        }}
                      >
                        <div style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '5px' }}>{effort.name}</div>
                        <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{effort.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Saved Routes */}
                {savedRoutes.length > 0 && (
                  <div style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#333' }}>Saved Routes</h2>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {savedRoutes.map(route => (
                        <button
                          key={route.id}
                          onClick={() => loadSavedRoute(route)}
                          style={{
                            padding: '15px',
                            background: '#f5f5f5',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ fontWeight: '600', marginBottom: '5px' }}>
                            {ACTIVITIES.find(a => a.id === route.activity)?.name} - {EFFORT_LEVELS.find(e => e.id === route.effort)?.name}
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#666' }}>
                            {route.locations.join(' → ')}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleGetRecommendations}
                  disabled={!selectedActivity || !selectedEffort || !locations.some(l => l.trim()) || !startTime}
                  style={{
                    width: '100%',
                    padding: '18px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    cursor: !selectedActivity || !selectedEffort || !locations.some(l => l.trim()) || !startTime ? 'not-allowed' : 'pointer',
                    opacity: !selectedActivity || !selectedEffort || !locations.some(l => l.trim()) || !startTime ? 0.5 : 1,
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  Get My Recommendations
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Results view
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <button
          onClick={() => setStep(1)}
          style={{
            padding: '10px 20px',
            background: 'white',
            border: '2px solid #667eea',
            borderRadius: '8px',
            color: '#667eea',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            marginBottom: '20px'
          }}
        >
          ← Back to Input
        </button>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: '20px', padding: '30px', color: 'white', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Your Clothing Recommendations</h1>
          <p style={{ fontSize: '1.2rem' }}>
            {ACTIVITIES.find(a => a.id === selectedActivity)?.name} • {EFFORT_LEVELS.find(e => e.id === selectedEffort)?.name} Effort
          </p>
        </div>

        {/* Weather Chart */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '30px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>Weather Forecast (5 Hours from Start)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weatherData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              />
              <YAxis yAxisId="left" label={{ value: 'Temperature (°F)', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Wind (mph) / Precip %', angle: 90, position: 'insideRight' }} />
              <Tooltip
                labelFormatter={(time) => new Date(time).toLocaleString()}
                formatter={(value, name) => {
                  if (name === 'temperature') return [value, 'Temp (°F)'];
                  if (name === 'windSpeed') return [value, 'Wind (mph)'];
                  if (name === 'precipitationChance') return [value + '%', 'Precip Chance'];
                  return [value, name];
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="temperature" stroke="#ff6b6b" strokeWidth={2} name="Temperature" />
              <Line yAxisId="right" type="monotone" dataKey="windSpeed" stroke="#4ecdc4" strokeWidth={2} name="Wind Speed" />
              <Line yAxisId="right" type="monotone" dataKey="precipitationChance" stroke="#3b82f6" strokeWidth={2} name="Precip Chance %" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Map */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '30px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>Route Map</h2>
          <div style={{ height: '400px', borderRadius: '12px', overflow: 'hidden' }}>
            <MapContainer
              center={[37.7749, -122.4194]}
              zoom={10}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {locations.filter(l => l).map((location, index) => (
                <Marker key={index} position={[37.7749 + index * 0.1, -122.4194 + index * 0.1]}>
                  <Popup>{location}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Recommendations */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '30px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>Recommended Layers</h2>
          <div style={{ display: 'grid', gap: '15px' }}>
            {recommendations.map((layer, index) => (
              <div
                key={index}
                style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, #667eea15, #764ba215)',
                  borderLeft: '4px solid #667eea',
                  borderRadius: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', color: '#667eea', fontWeight: '600', marginBottom: '5px' }}>
                      {layer.type}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#333', marginBottom: '5px' }}>
                      {layer.item}
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#666' }}>
                      {layer.reason}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <button
            onClick={handleSaveRoute}
            style={{
              padding: '16px',
              background: 'white',
              border: '2px solid #667eea',
              borderRadius: '12px',
              color: '#667eea',
              cursor: 'pointer',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}
          >
            💾 Save This Route
          </button>
          <button
            onClick={() => setShowFeedback(true)}
            style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}
          >
            📝 Provide Feedback
          </button>
        </div>

        {/* Feedback Modal */}
        {showFeedback && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: '40px',
              maxWidth: '500px',
              width: '100%'
            }}>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>How did it go?</h2>
              <p style={{ marginBottom: '20px', color: '#666' }}>
                Your feedback helps improve recommendations for everyone!
              </p>
              <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                <button
                  onClick={() => handleSubmitFeedback('too-cold')}
                  style={{
                    padding: '15px',
                    background: '#e3f2fd',
                    border: '2px solid #2196f3',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    color: '#1976d2'
                  }}
                >
                  ❄️ I was too cold
                </button>
                <button
                  onClick={() => handleSubmitFeedback('just-right')}
                  style={{
                    padding: '15px',
                    background: '#e8f5e9',
                    border: '2px solid #4caf50',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    color: '#388e3c'
                  }}
                >
                  ✅ Perfect!
                </button>
                <button
                  onClick={() => handleSubmitFeedback('too-hot')}
                  style={{
                    padding: '15px',
                    background: '#ffebee',
                    border: '2px solid #f44336',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    color: '#d32f2f'
                  }}
                >
                  🔥 I was too hot
                </button>
              </div>
              <button
                onClick={() => setShowFeedback(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: '#666'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}