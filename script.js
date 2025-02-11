// Initialize the map centered on Israel
function initMap() {
  // Approximate center of Israel [latitude, longitude]
  const map = L.map('map').setView([31.5, 34.75], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: ' OpenStreetMap contributors'
  }).addTo(map);
  return map;
}

const map = initMap();

// Global arrays and layers for markers and route
let selectedCities = [];
const markersLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);

// Set up event listeners for user input and buttons
document.getElementById('add-city-btn').addEventListener('click', addCity);
document.getElementById('calculate-btn').addEventListener('click', calculateDistance);
document.getElementById('reset-btn').addEventListener('click', resetRoute);
document.getElementById('city-input').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    addCity();
  }
});

// Add a city/place to the list and immediately indicate its location on the map
function addCity() {
  const input = document.getElementById('city-input');
  const cityName = input.value.trim();
  if (cityName === '') return;
  
  // Allow duplicate locations to support closed routes
  const cityObj = { name: cityName, lat: null, lon: null };
  selectedCities.push(cityObj);
  updateCityList();
  
  // As soon as a location is added, immediately geocode and update markers
  geocodeCity(cityName).then(coords => {
    if (coords) {
      cityObj.lat = coords.lat;
      cityObj.lon = coords.lon;
      updateMarkers();
    } else {
      alert(`Could not geocode: ${cityName}`);
    }
  });
  
  input.value = '';
}

// Update the list of cities displayed in the sidebar with a delete option
function updateCityList() {
  const list = document.getElementById('city-list');
  list.innerHTML = '';
  selectedCities.forEach((city, index) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = city.name;
    li.appendChild(span);
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✖';
    removeBtn.addEventListener('click', function() {
      selectedCities.splice(index, 1);
      updateCityList();
      updateMarkers();
    });
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

// Update markers on the map based on the cities array
function updateMarkers() {
  markersLayer.clearLayers();
  selectedCities.forEach(city => {
    if (city.lat !== null && city.lon !== null) {
      L.marker([city.lat, city.lon]).addTo(markersLayer).bindPopup(city.name);
    }
  });
}

// Geocode a city/place using OpenStreetMap's Nominatim service (restricted to Israel)
async function geocodeCity(cityName) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(cityName)}&countrycodes=IL`;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'IsraelAirDistanceCalculator/1.0' } });
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Calculate the haversine distance between two coordinates
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate total air distance along the route and display a polyline connecting the locations
async function calculateDistance() {
  if (selectedCities.length < 2) {
    alert('Please add at least 2 places.');
    return;
  }

  routeLayer.clearLayers();

  const geocodedCities = [];
  for (let city of selectedCities) {
    if (city.lat !== null && city.lon !== null) {
      geocodedCities.push(city);
    } else {
      const coords = await geocodeCity(city.name);
      if (coords) {
        city.lat = coords.lat;
        city.lon = coords.lon;
        geocodedCities.push(city);
      } else {
        alert(`Could not geocode: ${city.name}`);
      }
    }
  }

  if (geocodedCities.length < 2) {
    return;
  }

  // Update markers in case any missing coordinates were resolved now
  updateMarkers();
  
  const latLngs = geocodedCities.map(city => [city.lat, city.lon]);

  // Draw a polyline connecting the selected places
  const polyline = L.polyline(latLngs, { color: 'blue', weight: 3 }).addTo(routeLayer);
  map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

  // Calculate the total air distance along the route
  let totalDistance = 0;
  for (let i = 1; i < latLngs.length; i++) {
    totalDistance += haversineDistance(latLngs[i-1][0], latLngs[i-1][1], latLngs[i][0], latLngs[i][1]);
  }

  const resultDiv = document.getElementById('result');
  resultDiv.textContent = `Total Air Route Distance: ${totalDistance.toFixed(2)} km`;

  // Trigger a pop animation to emphasize the result
  resultDiv.classList.remove('animate');
  void resultDiv.offsetWidth; // reflow to restart animation
  resultDiv.classList.add('animate');
}

// Reset the entire route planning, clear all inputs, markers, and routes, and recenter the map
function resetRoute() {
  selectedCities = [];
  updateCityList();
  markersLayer.clearLayers();
  routeLayer.clearLayers();
  document.getElementById('result').textContent = '';
  map.setView([31.5, 34.75], 8);
}