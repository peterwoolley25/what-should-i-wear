import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart } from 'recharts';
import 'leaflet/dist/leaflet.css';
import RouteInput from './components/RouteInput';
import { samplePoints } from './utils/gpxParser';

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

// Component to update map center when coordinates change
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 12);
    }
  }, [center, map]);
  return null;
}

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
const fetchWeatherData = async (locations, startTime, providedCoords = null) => {
  try {
    // Use provided coordinates or geocode the location
    let coords = providedCoords;
    if (!coords) {
      coords = await geocodeLocation(locations[0]);
      if (!coords) {
        throw new Error('Could not find location');
      }
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

    return { weatherData, coords };
  } catch (error) {
    console.error('Weather fetch error:', error);
    // Fallback to mock data if API fails
    return { weatherData: generateMockWeather(locations, startTime), coords: null };
  }
};

// Fetch weather data for multiple GPX points and aggregate
const fetchGPXWeatherData = async (sampledPoints, startTime) => {
  try {
    // Fetch weather for each sampled point in parallel
    const weatherPromises = sampledPoints.map(point =>
      fetchWeatherData(
        [point.name || `Point ${point.index}`],
        startTime,
        {
          lat: point.lat,
          lon: point.lon,
          name: point.name || `Lat ${point.lat.toFixed(2)}, Lon ${point.lon.toFixed(2)}`
        }
      )
    );

    const allWeatherResults = await Promise.all(weatherPromises);

    // Aggregate weather data by time slot
    const aggregatedWeather = [];
    for (let hourIndex = 0; hourIndex < 5; hourIndex++) {
      const hourDataPoints = allWeatherResults
        .map(result => result.weatherData[hourIndex])
        .filter(Boolean);

      if (hourDataPoints.length > 0) {
        const temps = hourDataPoints.map(d => d.temperature);
        const winds = hourDataPoints.map(d => d.windSpeed);
        const precips = hourDataPoints.map(d => d.precipitationChance);
        const humidities = hourDataPoints.map(d => d.humidity);

        aggregatedWeather.push({
          location: 'GPX Route',
          time: hourDataPoints[0].time,
          temperature: Math.round((Math.min(...temps) + Math.max(...temps)) / 2), // Average of min and max
          temperatureMin: Math.min(...temps),
          temperatureMax: Math.max(...temps),
          windSpeed: Math.max(...winds),
          precipitationChance: Math.max(...precips),
          humidity: Math.round(humidities.reduce((sum, h) => sum + h, 0) / humidities.length),
          weatherCode: hourDataPoints[0].weatherCode,
          isAggregated: true
        });
      }
    }

    return {
      weatherData: aggregatedWeather,
      coords: sampledPoints[0] ? {
        lat: sampledPoints[0].lat,
        lon: sampledPoints[0].lon,
        name: 'GPX Route'
      } : null
    };
  } catch (error) {
    console.error('GPX weather fetch error:', error);
    // Fallback to mock data if API fails
    return { weatherData: generateMockWeather(['GPX Route'], startTime), coords: null };
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
  // For GPX routes with aggregated data, use minimum temperature for conservative recommendations
  const isAggregated = weatherData.length > 0 && weatherData[0].isAggregated;
  let avgTemp;

  if (isAggregated) {
    // Use the coldest temperature across all sampled points
    avgTemp = Math.min(...weatherData.map(w => w.temperatureMin || w.temperature));
  } else {
    // Standard average for single location
    avgTemp = weatherData.reduce((sum, w) => sum + w.temperature, 0) / weatherData.length;
  }

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
  const [locationCoords, setLocationCoords] = useState(null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [activeInputIndex, setActiveInputIndex] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);

  // GPX-related state
  const [inputMethod, setInputMethod] = useState('search');
  const [gpxPoints, setGpxPoints] = useState([]);
  const [sampledGpxPoints, setSampledGpxPoints] = useState([]);
  const [gpxMetadata, setGpxMetadata] = useState(null);

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

  const searchLocationSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
      );
      const data = await response.json();

      if (data.results) {
        const suggestions = data.results.map(result => ({
          name: result.name,
          country: result.country,
          admin1: result.admin1,
          lat: result.latitude,
          lon: result.longitude,
          displayName: `${result.name}${result.admin1 ? ', ' + result.admin1 : ''}, ${result.country}`
        }));
        setLocationSuggestions(suggestions);
      } else {
        setLocationSuggestions([]);
      }
    } catch (error) {
      console.error('Location search error:', error);
      setLocationSuggestions([]);
    }
  };

  const handleLocationChange = (index, value) => {
    const newLocations = [...locations];
    newLocations[index] = value;
    setLocations(newLocations);
    setActiveInputIndex(index);

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Debounce the search
    const timeout = setTimeout(() => {
      searchLocationSuggestions(value);
    }, 300);
    setSearchTimeout(timeout);
  };

  const selectLocationSuggestion = (index, suggestion) => {
    const newLocations = [...locations];
    newLocations[index] = suggestion.displayName;
    setLocations(newLocations);
    setLocationSuggestions([]);
    setActiveInputIndex(null);

    // Store the coordinates for the selected location
    setLocationCoords({
      lat: suggestion.lat,
      lon: suggestion.lon,
      name: suggestion.displayName
    });
  };

  const handleRemoveLocation = (index) => {
    const newLocations = locations.filter((_, i) => i !== index);
    setLocations(newLocations.length === 0 ? [''] : newLocations);
  };

  const handleRouteChange = (routeData) => {
    console.log('handleRouteChange called with:', routeData);

    setInputMethod(routeData.inputMethod || 'search');
    setLocations(routeData.locations || ['']);
    setStartTime(routeData.startTime || '');

    if (routeData.inputMethod === 'gpx' && routeData.gpxPoints) {
      console.log('GPX mode detected, gpxPoints:', routeData.gpxPoints.length);
      setGpxPoints(routeData.gpxPoints);
      setGpxMetadata(routeData.gpxMetadata);

      // Sample points for weather fetching (10-12 points)
      const sampled = samplePoints(routeData.gpxPoints, 10);
      console.log('Sampled points:', sampled.length);
      setSampledGpxPoints(sampled);

      // Set location coords to first point for map centering
      if (sampled.length > 0) {
        setLocationCoords({
          lat: sampled[0].lat,
          lon: sampled[0].lon,
          name: routeData.gpxMetadata?.name || 'GPX Route'
        });
      }
    } else {
      console.log('Search mode or no GPX points');
      setGpxPoints([]);
      setSampledGpxPoints([]);
      setGpxMetadata(null);
    }
  };

  const handleGetRecommendations = async () => {
    if (!startTime || !selectedActivity || !selectedEffort) {
      alert('Please fill in all fields');
      return;
    }

    let weather, coords;

    // Handle GPX mode
    if (inputMethod === 'gpx' && sampledGpxPoints.length > 0) {
      const result = await fetchGPXWeatherData(sampledGpxPoints, startTime);
      weather = result.weatherData;
      coords = result.coords;
    } else {
      // Handle search mode
      const validLocations = locations.filter(loc => loc.trim());
      if (!validLocations.length) {
        alert('Please enter a location');
        return;
      }

      if (!locationCoords) {
        alert('Please select a location from the dropdown suggestions');
        return;
      }

      const result = await fetchWeatherData(validLocations, startTime, locationCoords);
      weather = result.weatherData;
      coords = result.coords;
    }

    setWeatherData(weather);
    // Update coords in case they changed
    if (coords) {
      setLocationCoords(coords);
    }

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
                  <h2 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>2. Enter Your Location or Upload GPX</h2>
                  <RouteInput onRouteChange={handleRouteChange} />
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

                {/* Debug info */}
                {console.log('Button state check:', {
                  selectedActivity,
                  selectedEffort,
                  startTime,
                  inputMethod,
                  sampledGpxPointsLength: sampledGpxPoints.length,
                  locationsHasValue: locations.some(l => l.trim()),
                  shouldDisable: !selectedActivity || !selectedEffort || !startTime || (inputMethod === 'gpx' ? sampledGpxPoints.length === 0 : !locations.some(l => l.trim()))
                })}

                <button
                  onClick={handleGetRecommendations}
                  disabled={
                    !selectedActivity ||
                    !selectedEffort ||
                    !startTime ||
                    (inputMethod === 'gpx' ? sampledGpxPoints.length === 0 : !locations.some(l => l.trim()))
                  }
                  style={{
                    width: '100%',
                    padding: '18px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    cursor: (
                      !selectedActivity ||
                      !selectedEffort ||
                      !startTime ||
                      (inputMethod === 'gpx' ? sampledGpxPoints.length === 0 : !locations.some(l => l.trim()))
                    ) ? 'not-allowed' : 'pointer',
                    opacity: (
                      !selectedActivity ||
                      !selectedEffort ||
                      !startTime ||
                      (inputMethod === 'gpx' ? sampledGpxPoints.length === 0 : !locations.some(l => l.trim()))
                    ) ? 0.5 : 1,
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
          <h2 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>
            Weather Forecast (5 Hours from Start)
            {inputMethod === 'gpx' && <span style={{ fontSize: '1rem', color: '#667eea', marginLeft: '10px' }}>• Route Range</span>}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={weatherData}>
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
                  if (name === 'temperatureMin') return [value, 'Min Temp (°F)'];
                  if (name === 'temperatureMax') return [value, 'Max Temp (°F)'];
                  if (name === 'windSpeed') return [value, 'Wind (mph)'];
                  if (name === 'precipitationChance') return [value + '%', 'Precip Chance'];
                  return [value, name];
                }}
              />
              <Legend />

              {/* Temperature display - range for GPX, single line for search */}
              {inputMethod === 'gpx' && weatherData.length > 0 && weatherData[0].isAggregated ? (
                <>
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperatureMax"
                    stroke="#ff8888"
                    fill="#ff6b6b"
                    fillOpacity={0.3}
                    name="Max Temp"
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperatureMin"
                    stroke="#ff4444"
                    fill="#ffffff"
                    fillOpacity={0.5}
                    name="Min Temp"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperature"
                    stroke="#ff6b6b"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    name="Avg Temp"
                    dot={false}
                  />
                </>
              ) : (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#ff6b6b"
                  strokeWidth={2}
                  name="Temperature"
                />
              )}

              <Line yAxisId="right" type="monotone" dataKey="windSpeed" stroke="#4ecdc4" strokeWidth={2} name="Wind Speed" />
              <Line yAxisId="right" type="monotone" dataKey="precipitationChance" stroke="#3b82f6" strokeWidth={2} name="Precip Chance %" strokeDasharray="5 5" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Map */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '30px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>Location Map</h2>
          <div style={{ height: '400px', borderRadius: '12px', overflow: 'hidden' }}>
            {locationCoords ? (
              <MapContainer
                center={[locationCoords.lat, locationCoords.lon]}
                zoom={inputMethod === 'gpx' && gpxPoints.length > 0 ? 10 : 12}
                style={{ height: '100%', width: '100%' }}
                key={`${locationCoords.lat}-${locationCoords.lon}-${inputMethod}`}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapUpdater center={[locationCoords.lat, locationCoords.lon]} />

                {inputMethod === 'gpx' && gpxPoints.length > 0 ? (
                  <>
                    {/* Full GPX route polyline */}
                    <Polyline
                      positions={gpxPoints.map(p => [p.lat, p.lon])}
                      color="#667eea"
                      weight={3}
                      opacity={0.7}
                    />
                    {/* Sampled weather points as circle markers */}
                    {sampledGpxPoints.map((point, idx) => (
                      <CircleMarker
                        key={idx}
                        center={[point.lat, point.lon]}
                        radius={8}
                        fillColor="#ff6b6b"
                        color="white"
                        weight={2}
                        fillOpacity={0.8}
                      >
                        <Popup>
                          <strong>Point {idx + 1}</strong><br />
                          {point.name || `Lat: ${point.lat.toFixed(4)}, Lon: ${point.lon.toFixed(4)}`}
                        </Popup>
                      </CircleMarker>
                    ))}
                  </>
                ) : (
                  /* Single location marker for search mode */
                  <Marker position={[locationCoords.lat, locationCoords.lon]}>
                    <Popup>{locationCoords.name}</Popup>
                  </Marker>
                )}
              </MapContainer>
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f5f5f5',
                color: '#666'
              }}>
                Map will display after location is geocoded
              </div>
            )}
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