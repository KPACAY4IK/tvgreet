'use strict';

/* ---------- конфигурация ---------- */
const DEFAULTS = {
  name: '',
  lat: 43.238,
  lon: 76.889,
  voice: true,
  greetHour: 8,
  idleMin: 5,
  wallpaper: 'bing'
};

function loadCfg() {
  try {
    return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('tvgreet') || '{}'));
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}
function saveCfg() {
  localStorage.setItem('tvgreet', JSON.stringify(cfg));
}
let cfg = loadCfg();

const $ = (id) => document.getElementById(id);

/* ---------- обои: реальные фото ---------- */
const wall = (function () {
  const img = $('wall');
  const overlay = $('wall-overlay');
  let mode = cfg.wallpaper || 'bing';
  let cycleTimer = null;

  function applyBing() {
    img.style.opacity = '0';
    fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        const url = 'https://www.bing.com' + j.images[0].url.replace('1920x1080', '1920x1080');
        loadImage(url);
      })
      .catch(function () { applyRandom(); });
  }

  function applyRandom() {
    img.style.opacity = '0';
    loadImage('https://picsum.photos/1920/1080?random=' + Date.now());
  }

  function applyGradient() {
    img.style.opacity = '0';
    img.removeAttribute('src');
    const h = new Date().getHours();
    let c1, c2;
    if (h < 6) { c1 = '#0a0c22'; c2 = '#1a1e3e'; }
    else if (h < 9) { c1 = '#e87852'; c2 = '#f5c16c'; }
    else if (h < 17) { c1 = '#4a90d9'; c2 = '#87ceeb'; }
    else if (h < 20) { c1 = '#e28054'; c2 = '#6a4c93'; }
    else { c1 = '#1a1e3e'; c2 = '#0a0c22'; }
    document.body.style.background = 'linear-gradient(' + c1 + ',' + c2 + ')';
    img.style.opacity = '0';
  }

  function loadImage(url) {
    const tmp = new Image();
    tmp.onload = function () {
      img.src = url;
      img.style.opacity = '1';
    };
    tmp.onerror = function () {
      if (mode === 'bing') applyRandom();
      else applyGradient();
    };
    tmp.src = url;
  }

  function apply() {
    clearTimeout(cycleTimer);
    if (mode === 'bing') applyBing();
    else if (mode === 'random') applyRandom();
    else applyGradient();
  }

  function setMode(m) {
    mode = m;
    apply();
  }

  function startCycle() {
    clearTimeout(cycleTimer);
    if (mode === 'random') {
      cycleTimer = setTimeout(function () { applyRandom(); startCycle(); }, 5 * 60 * 1000);
    } else if (mode === 'bing') {
      cycleTimer = setTimeout(function () { applyBing(); startCycle(); }, 30 * 60 * 1000);
    }
  }

  apply();
  startCycle();

  return {
    setMode: function (m) { setMode(m); startCycle(); },
    dim: function (d) {
      overlay.style.background = d
        ? 'rgba(0,0,0,0.55)'
        : 'linear-gradient(to bottom, rgba(0,0,0,.15) 0%, rgba(0,0,0,.05) 40%, rgba(0,0,0,.45) 100%)';
    }
  };
})();

/* ---------- погода (Open-Meteo) ---------- */
const WMO = {
  0: ['ясно', '☀️'], 1: ['малооблачно', '🌤'], 2: ['переменная облачность', '⛅'],
  3: ['пасмурно', '☁️'], 45: ['туман', '🌫'], 48: ['изморозь', '🌫'],
  51: ['слабая морось', '🌦'], 53: ['морось', '🌦'], 55: ['сильная морось', '🌦'],
  61: ['слабый дождь', '🌧'], 63: ['дождь', '🌧'], 65: ['сильный дождь', '🌧'],
  71: ['слабый снег', '🌨'], 73: ['снег', '🌨'], 75: ['сильный снег', '❄️'],
  77: ['снежная крупа', '❄️'], 80: ['ливень', '🌦'], 81: ['сильный ливень', '🌧'],
  82: ['проливной дождь', '🌧'], 85: ['снегопад', '🌨'], 86: ['сильный снегопад', '❄️'],
  95: ['гроза', '⛈'], 96: ['гроза с градом', '⛈'], 99: ['сильная гроза', '⛈']
};

let weather = null;

function fetchWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + cfg.lat +
    '&longitude=' + cfg.lon +
    '&current=temperature_2m,weather_code,wind_speed_10m' +
    '&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1';
  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (j) {
      const c = j.current;
      weather = {
        temp: Math.round(c.temperature_2m),
        code: c.weather_code,
        tmax: Math.round(j.daily.temperature_2m_max[0]),
        tmin: Math.round(j.daily.temperature_2m_min[0])
      };
      renderWeather();
    })
    .catch(function () {
      $('w-desc').textContent = 'погода недоступна';
    });
}

function renderWeather() {
  if (!weather) return;
  const info = WMO[weather.code] || ['—', ''];
  $('w-icon').textContent = info[1];
  $('w-temp').textContent = (weather.temp > 0 ? '+' : '') + weather.temp + '°';
  $('w-desc').textContent = info[0] + ' · ' + weather.tmin + '…' + (weather.tmax > 0 ? '+' : '') + weather.tmax + '°';
}

/* ---------- часы ---------- */
function tick() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  $('clock').textContent = hh + ':' + mm;
  $('saver-clock').textContent = hh + ':' + mm;
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  $('date').textContent = dateStr;
  $('saver-date').textContent = dateStr;
}

/* ---------- приветствие + голос ---------- */
function greetingText() {
  const now = new Date();
  const h = now.getHours();
  let part = 'Доброй ночи';
  if (h >= 5 && h < 12) part = 'Доброе утро';
  else if (h >= 12 && h < 18) part = 'Добрый день';
  else if (h >= 18 && h < 23) part = 'Добрый вечер';
  let t = part;
  if (cfg.name) t += ', ' + cfg.name;
  t += '!';
  if (weather) {
    const info = WMO[weather.code] || ['—', ''];
    t += ' Сейчас ' + (weather.temp > 0 ? 'плюс ' : 'минус ') + Math.abs(weather.temp) +
      ' градусов, ' + info[0] + '.';
  }
  t += ' Время ' + h + ' ' + String(now.getMinutes()).padStart(2, '0') + '.';
  return t;
}

function showGreeting(speakIt) {
  const short = greetingText().split('. ')[0] + '.';
  const el = $('greeting');
  el.textContent = short;
  el.classList.add('show');
  if (speakIt) speak(greetingText());
}

function speak(text) {
  if (!cfg.voice) return;
  /* 1. Tizen TTS (работает внутри TizenBrew / Tizen web app) */
  try {
    if (window.tizen && tizen.tts) {
      const voices = tizen.tts.getAllVoices();
      let v = null;
      for (let i = 0; i < voices.length; i++) {
        if (voices[i].language && voices[i].language.indexOf('ru') === 0) { v = voices[i]; break; }
      }
      tizen.tts.prepare(function () {
        try {
          const opt = v ? { voice: v } : undefined;
          tizen.tts.speak(text, function () {}, function () {}, opt);
        } catch (e2) {
          try { tizen.tts.speak(text, function () {}, function () {}); } catch (e3) {}
        }
      }, function () {});
      return;
    }
  } catch (e) {}
  /* 2. Web Speech API (Chrome / браузер) */
  try {
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      u.rate = 0.95;
      speechSynthesis.speak(u);
    }
  } catch (e) {}
}

/* ---------- заставка ---------- */
let idleTimer = null;
let saverOn = false;

function resetIdle() {
  if (saverOn) exitSaver();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(enterSaver, Math.max(1, cfg.idleMin) * 60 * 1000);
}

function enterSaver() {
  saverOn = true;
  $('main').classList.add('hidden');
  $('saver').classList.remove('hidden');
  wall.dim(true);
}

function exitSaver() {
  saverOn = false;
  $('saver').classList.add('hidden');
  $('main').classList.remove('hidden');
  wall.dim(false);
}

/* ---------- настройки ---------- */
function openSettings() {
  $('s-name').value = cfg.name;
  $('s-lat').value = cfg.lat;
  $('s-lon').value = cfg.lon;
  $('s-voice').checked = !!cfg.voice;
  $('s-hour').value = cfg.greetHour;
  $('s-idle').value = cfg.idleMin;
  $('s-wall').value = cfg.wallpaper || 'bing';
  $('settings').classList.remove('hidden');
  clearTimeout(idleTimer);
}

function closeSettings() {
  $('settings').classList.add('hidden');
  resetIdle();
}

function bindUI() {
  $('s-save').onclick = function () {
    cfg.name = $('s-name').value.trim();
    cfg.lat = parseFloat($('s-lat').value) || DEFAULTS.lat;
    cfg.lon = parseFloat($('s-lon').value) || DEFAULTS.lon;
    cfg.voice = $('s-voice').checked;
    cfg.greetHour = Math.min(23, Math.max(0, parseInt($('s-hour').value, 10) || 8));
    cfg.idleMin = Math.min(120, Math.max(1, parseInt($('s-idle').value, 10) || 5));
    cfg.wallpaper = $('s-wall').value;
    saveCfg();
    wall.setMode(cfg.wallpaper);
    fetchWeather();
    closeSettings();
  };
  $('s-test').onclick = function () {
    cfg.voice = true;
    speak('Голос работает. ' + greetingText());
  };
  $('s-close').onclick = closeSettings;
}

function bindKeys() {
  document.addEventListener('keydown', function (e) {
    resetIdle();
    if (e.keyCode === 77 || e.keyCode === 18 || e.keyCode === 10135) {
      if ($('settings').classList.contains('hidden')) openSettings();
      else closeSettings();
    } else if (e.keyCode === 27 || e.keyCode === 10009 || e.keyCode === 461) {
      if (!$('settings').classList.contains('hidden')) closeSettings();
    } else if (e.keyCode === 84) {
      showGreeting(true);
    }
  });
  document.addEventListener('mousemove', resetIdle);
  document.addEventListener('click', resetIdle);

  try {
    if (window.tizen && tizen.tvinputdevice) {
      ['Menu', 'Tools', 'ColorF0Red'].forEach(function (k) {
        try { tizen.tvinputdevice.registerKey(k); } catch (e) {}
      });
    }
  } catch (e) {}
}

/* ---------- автозапуск по расписанию (tizen.alarm) ---------- */
function setupAlarm() {
  if (!window.tizen || !tizen.alarm) return;
  try {
    tizen.alarm.getAll(function (alarms) {
      alarms.forEach(function (a) { try { tizen.alarm.remove(a.id); } catch (e) {} });
    }, function () {});
    const ac = new tizen.ApplicationControl(
      'http://tizen.org/appcontrol/operation/default', null, null, null,
      [new tizen.ApplicationControlData('http://tizen.org/appcontrol/data/alarm', ['greeting'])]
    );
    const now = new Date();
    const next = new Date(now);
    next.setHours(cfg.greetHour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    try {
      tizen.alarm.addAbsoluteAlarm(ac, next, 'DAY', function () {}, function () {});
    } catch (e) {
      tizen.alarm.addAbsoluteAlarm(ac, next, function () {}, function () {});
    }
  } catch (e) {}
}

/* ---------- старт ---------- */
function init() {
  tick();
  setInterval(tick, 1000);
  fetchWeather();
  setInterval(fetchWeather, 15 * 60 * 1000);
  bindUI();
  bindKeys();
  setupAlarm();
  resetIdle();
  setTimeout(function () { showGreeting(true); }, 1500);
}

init();
