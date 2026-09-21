// ========================================
// home.js — weather + spotlight functionality
// ========================================

// ------- CONFIG -------
const WEATHER_API_KEY = 'e210cf4f6d00faea2146920a769c7a20'; // <-- replace with your key
const KAMPALA_LAT = 0.3476;
const KAMPALA_LON = 32.5825;
const WEATHER_URL = `https://api.openweathermap.org/data/2.5/forecast?lat=${KAMPALA_LAT}&lon=${KAMPALA_LON}&units=metric&appid=${WEATHER_API_KEY}`;

// ------- DOM refs -------
const currentWeatherEl = document.getElementById('weather-current');
const forecastEl = document.getElementById('weather-forecast');
const spotlightsEl = document.getElementById('spotlights');

// ========================================
// WEATHER
// ========================================
async function loadWeather() {
    try {
        const response = await fetch(WEATHER_URL);
        if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
        const data = await response.json();
        renderCurrentWeather(data);
        renderForecast(data);
    } catch (error) {
        console.error('Weather error:', error);
        if (currentWeatherEl) {
            currentWeatherEl.innerHTML = '<p class="error-message">Weather data unavailable.</p>';
        }
        if (forecastEl) {
            forecastEl.innerHTML = '<p class="error-message">Forecast unavailable.</p>';
        }
    }
}

function renderCurrentWeather(data) {
    if (!currentWeatherEl) return;

    const current = data.list[0];
    const temp = Math.round(current.main.temp);
    const description = current.weather[0].description;
    const icon = current.weather[0].icon;
    const iconUrl = `https://openweathermap.org/img/wn/${icon}@2x.png`;

    currentWeatherEl.innerHTML = `
        <img src="${iconUrl}" alt="${description}" class="weather-icon" width="80" height="80">
        <p class="weather-temp">${temp}°C</p>
        <p class="weather-desc">${description}</p>
        <p class="weather-meta">Humidity: ${current.main.humidity}% · Wind: ${current.wind.speed} m/s</p>
    `;
}

function renderForecast(data) {
    if (!forecastEl) return;

    // The 3-hour forecast returns 40 entries (5 days). Group by day.
    const dailyMap = {};
    data.list.forEach(entry => {
        const date = new Date(entry.dt * 1000);
        const dayKey = date.toISOString().split('T')[0];
        if (!dailyMap[dayKey]) {
            dailyMap[dayKey] = { temps: [], entries: [] };
        }
        dailyMap[dayKey].temps.push(entry.main.temp);
        dailyMap[dayKey].entries.push(entry);
    });

    // Take today + next 3 days (skip today)
    const dayKeys = Object.keys(dailyMap).slice(1, 4);

    forecastEl.innerHTML = dayKeys.map(key => {
        const dayData = dailyMap[key];
        const avg = Math.round(dayData.temps.reduce((a, b) => a + b, 0) / dayData.temps.length);
        const dateObj = new Date(key + 'T12:00:00');
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const dayDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        // Pick a representative icon (midday entry)
        const middayEntry = dayData.entries[Math.floor(dayData.entries.length / 2)];
        const icon = middayEntry.weather[0].icon;
        const iconUrl = `https://openweathermap.org/img/wn/${icon}.png`;

        return `
            <div class="forecast-card">
                <p class="forecast-day">${dayName}</p>
                <p class="forecast-date">${dayDate}</p>
                <img src="${iconUrl}" alt="forecast icon" width="50" height="50">
                <p class="forecast-temp">${avg}°C</p>
            </div>
        `;
    }).join('');
}

// ========================================
// SPOTLIGHTS
// ========================================
async function loadSpotlights() {
    try {
        const response = await fetch('data/members.json');
        if (!response.ok) throw new Error('Failed to load members');
        const data = await response.json();

        // Filter for Gold (3) and Silver (2) members
        const eligible = data.members.filter(
            m => m.membershipLevel === 3 || m.membershipLevel === 2
        );

        // Shuffle and pick 3
        const shuffled = eligible.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);

        renderSpotlights(selected);
    } catch (error) {
        console.error('Spotlight error:', error);
        if (spotlightsEl) {
            spotlightsEl.innerHTML = '<p class="error-message">Spotlights unavailable.</p>';
        }
    }
}

function getLevelLabel(level) {
    if (level === 3) return 'Gold Member';
    if (level === 2) return 'Silver Member';
    return 'Member';
}

function renderSpotlights(members) {
    if (!spotlightsEl) return;

    if (!members || members.length === 0) {
        spotlightsEl.innerHTML = '<p class="error-message">No spotlights available.</p>';
        return;
    }

    spotlightsEl.innerHTML = members.map(member => `
        <article class="spotlight-card">
            <img
                src="images/${member.image}"
                alt="${member.name} logo"
                width="100"
                height="100"
                loading="lazy"
                onerror="this.onerror=null;this.src='images/placeholder.svg';"
            >
            <h3>${member.name}</h3>
            <p class="tagline">"${member.tagline}"</p>
            <p><strong>Address:</strong> ${member.address}</p>
            <p><strong>Phone:</strong> <a href="tel:${member.phone.replace(/\s+/g, '')}">${member.phone}</a></p>
            <p><strong>Website:</strong> <a href="${member.website}" target="_blank" rel="noopener noreferrer">Visit site</a></p>
            <p class="level">${getLevelLabel(member.membershipLevel)}</p>
        </article>
    `).join('');
}

// ========================================
// INIT
// ========================================
loadWeather();
loadSpotlights();