'use strict';

/* ---------- конфигурация ---------- */
const DEFAULTS = {
  name: 'Шухрат',
  lat: 43.238,
  lon: 76.889,
  voice: true,
  idleMin: 2,
  wallpaper: 'video',
  greeting: 'Ассаляму алейкум',
  videoInterval: 10,
  videos: ''
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

/* ============================================================
   ЖИВЫЕ ОБОИ — Canvas-анимация
   Небо по времени суток, солнце/луна, звёзды, облака,
   дождь/снег, аврора, светлячки
   ============================================================ */
const wall = (function () {
  const img = $('wall');
  const overlay = $('wall-overlay');
  const canvas = $('anim-wall');
  const ytFrame = $('yt-wall');
  const ctx = canvas.getContext('2d');
  let mode = cfg.wallpaper || 'video';
  let cycleTimer = null;
  let animFrame = null;
  let videoIdx = 0;

  function getVideoIds() {
    const raw = (cfg.videos || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    return raw.map(function (u) {
      const m = u.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
      return m ? m[1] : null;
    }).filter(Boolean);
  }

  function playVideo(idx) {
    const ids = getVideoIds();
    if (ids.length === 0) {
      ytFrame.style.display = 'none';
      document.body.style.background = 'linear-gradient(135deg, #0d1b2a, #1b2838)';
      return;
    }
    videoIdx = ((idx % ids.length) + ids.length) % ids.length;
    const id = ids[videoIdx];
    const src = 'https://www.youtube.com/embed/' + id +
      '?autoplay=1&mute=1&loop=1&playlist=' + id +
      '&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1&playsinline=1';
    canvas.style.display = 'none';
    img.style.display = 'none';
    ytFrame.style.display = 'block';
    ytFrame.src = src;
  }

  function scheduleVideoCycle() {
    clearTimeout(cycleTimer);
    const mins = Math.max(1, parseInt(cfg.videoInterval, 10) || 10);
    cycleTimer = setTimeout(function () {
      playVideo(videoIdx + 1);
      scheduleVideoCycle();
    }, mins * 60 * 1000);
  }

  /* размеры */
  let W = 1920, H = 1080;
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
  }

  /* частицы */
  const stars = [], clouds = [], drops = [], flakes = [], fireflies = [], auroraWaves = [];
  function initParticles() {
    stars.length = 0; clouds.length = 0; drops.length = 0;
    flakes.length = 0; fireflies.length = 0; auroraWaves.length = 0;
    for (let i = 0; i < 70; i++)
      stars.push({ x: Math.random(), y: Math.random() * 0.65, r: Math.random() * 1.5 + 0.5, tw: Math.random() * 6.28 });
    for (let i = 0; i < 6; i++)
      clouds.push({ x: Math.random() * 1.4 - 0.2, y: 0.08 + Math.random() * 0.3, s: 0.5 + Math.random() * 0.8, v: 0.00003 + Math.random() * 0.00006 });
    for (let i = 0; i < 60; i++)
      drops.push({ x: Math.random(), y: Math.random(), l: 0.015 + Math.random() * 0.025, v: 0.005 + Math.random() * 0.007 });
    for (let i = 0; i < 50; i++)
      flakes.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.2, v: 0.0006 + Math.random() * 0.0012, w: Math.random() * 6.28 });
    for (let i = 0; i < 18; i++)
      fireflies.push({ x: Math.random(), y: 0.5 + Math.random() * 0.45, r: 1.5 + Math.random() * 2, vx: (Math.random() - 0.5) * 0.0004, vy: (Math.random() - 0.5) * 0.0003, ph: Math.random() * 6.28 });
    for (let i = 0; i < 4; i++)
      auroraWaves.push({ y: 0.1 + i * 0.08, amp: 0.03 + Math.random() * 0.04, speed: 0.0003 + Math.random() * 0.0005, ph: Math.random() * 6.28, hue: 120 + i * 30 });
  }

  /* палитра неба */
  function skyColors(h) {
    const stops = [
      [0, [12, 14, 42], [22, 26, 62]],
      [5, [30, 28, 68], [60, 48, 100]],
      [7, [210, 100, 70], [245, 180, 100]],
      [10, [70, 140, 210], [130, 195, 235]],
      [14, [60, 135, 215], [120, 190, 240]],
      [17, [215, 110, 65], [240, 170, 95]],
      [19, [80, 50, 110], [140, 80, 140]],
      [21, [25, 25, 65], [40, 35, 85]],
      [24, [12, 14, 42], [22, 26, 62]]
    ];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (h >= stops[i][0] && h <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const t = (h - a[0]) / Math.max(0.001, b[0] - a[0]);
    function mix(ca, cb) {
      return [0, 1, 2].map(function (i) { return Math.round(ca[i] + (cb[i] - ca[i]) * t); });
    }
    return { top: mix(a[1], b[1]), bot: mix(a[2], b[2]) };
  }

  /* рисование */
  let weatherFx = 'clear';

  function drawSky(h) {
    const c = skyColors(h);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + c.top.join(',') + ')');
    g.addColorStop(1, 'rgb(' + c.bot.join(',') + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars(h, t) {
    if (h > 5.5 && h < 20) return;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(s.tw + t * 0.8));
      ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * tw).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, 6.28);
      ctx.fill();
    }
  }

  function drawSunMoon(h, t) {
    const isDay = h > 5.5 && h < 18.5;
    if (isDay) {
      const dayT = (h - 5.5) / 13;
      const x = W * (0.1 + dayT * 0.8);
      const y = H * (0.6 - Math.sin(dayT * Math.PI) * 0.42);
      const r = Math.min(W, H) * 0.05;
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 3.5);
      g.addColorStop(0, 'rgba(255,240,180,0.9)');
      g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 3.5, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff5c8';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
    } else {
      const mx = W * 0.75, my = H * 0.18;
      const r = Math.min(W, H) * 0.045;
      const g = ctx.createRadialGradient(mx, my, r * 0.2, mx, my, r * 3);
      g.addColorStop(0, 'rgba(210,220,255,0.85)');
      g.addColorStop(1, 'rgba(210,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(mx, my, r * 3, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#e4eaff';
      ctx.beginPath(); ctx.arc(mx, my, r, 0, 6.28); ctx.fill();
      ctx.fillStyle = 'rgba(18,22,50,0.5)';
      ctx.beginPath(); ctx.arc(mx - r * 0.35, my - r * 0.2, r * 0.82, 0, 6.28); ctx.fill();
    }
  }

  function drawClouds(t) {
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      c.x += c.v;
      if (c.x > 1.3) c.x = -0.3;
      const x = c.x * W, y = c.y * H, s = c.s * Math.min(W, H) * 0.12;
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y, s * 1.5, s * 0.5, 0, 0, 6.28);
      ctx.ellipse(x - s * 0.6, y + s * 0.15, s * 0.85, s * 0.38, 0, 0, 6.28);
      ctx.ellipse(x + s * 0.7, y + s * 0.12, s * 0.95, s * 0.36, 0, 0, 6.28);
      ctx.fill();
    }
  }

  function drawRain() {
    ctx.strokeStyle = 'rgba(180,200,255,0.45)';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y += d.v;
      if (d.y > 1.05) { d.y = -0.05; d.x = Math.random(); }
      const x = d.x * W, y = d.y * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + d.l * H);
      ctx.stroke();
    }
  }

  function drawSnow() {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i];
      f.y += f.v;
      f.w += 0.015;
      if (f.y > 1.05) { f.y = -0.05; f.x = Math.random(); }
      ctx.beginPath();
      ctx.arc(f.x * W + Math.sin(f.w) * 10, f.y * H, f.r, 0, 6.28);
      ctx.fill();
    }
  }

  function drawAurora(t) {
    for (let i = 0; i < auroraWaves.length; i++) {
      const w = auroraWaves[i];
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) {
        const y = H * (w.y + Math.sin(x * 0.002 + t * w.speed * 60 + w.ph) * w.amp);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H * (w.y + 0.12));
      ctx.lineTo(0, H * (w.y + 0.12));
      ctx.closePath();
      const g = ctx.createLinearGradient(0, H * w.y, 0, H * (w.y + 0.12));
      g.addColorStop(0, 'hsla(' + w.hue + ',80%,60%,0.12)');
      g.addColorStop(1, 'hsla(' + w.hue + ',80%,60%,0)');
      ctx.fillStyle = g;
      ctx.fill();
    }
  }

  function drawFireflies(t) {
    for (let i = 0; i < fireflies.length; i++) {
      const f = fireflies[i];
      f.x += f.vx;
      f.y += f.vy;
      if (f.x < 0.02 || f.x > 0.98) f.vx *= -1;
      if (f.y < 0.45 || f.y > 0.97) f.vy *= -1;
      const glow = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.001 + f.ph));
      const r = f.r * glow;
      const g = ctx.createRadialGradient(f.x * W, f.y * H, 0, f.x * W, f.y * H, r * 6);
      g.addColorStop(0, 'rgba(255,255,150,' + (0.6 * glow).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,255,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x * W, f.y * H, r * 6, 0, 6.28);
      ctx.fill();
    }
  }

  function drawHills() {
    const base = H * 0.82;
    ctx.fillStyle = 'rgba(15,22,35,0.7)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, base + 25);
    for (let x = 0; x <= W; x += 35) {
      ctx.lineTo(x, base + Math.sin(x * 0.0022) * 42 + Math.sin(x * 0.0007 + 2) * 55);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(10,16,26,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, base + 90);
    for (let x = 0; x <= W; x += 35) {
      ctx.lineTo(x, base + 90 + Math.sin(x * 0.0016 + 4) * 38 + Math.sin(x * 0.0006) * 28);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function frame(ts) {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    drawSky(h);
    drawStars(h, ts || 0);
    drawSunMoon(h, ts || 0);
    if (h < 6 || h > 20) drawAurora(ts || 0);
    drawClouds(ts || 0);
    if (weatherFx === 'rain') drawRain();
    if (weatherFx === 'snow') drawSnow();
    drawHills();
    if (h > 19 || h < 6) drawFireflies(ts || 0);
    animFrame = requestAnimationFrame(frame);
  }

  function startLive() {
    img.style.display = 'none';
    canvas.style.display = 'block';
    resize();
    initParticles();
    if (!animFrame) animFrame = requestAnimationFrame(frame);
  }

  function stopLive() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    canvas.style.display = 'none';
    img.style.display = 'block';
  }

  /* фото-режим */
  function loadImage(url) {
    img.onload = function () { img.style.opacity = '1'; };
    img.onerror = function () { img.style.opacity = '0'; };
    img.src = url;
    img.style.opacity = '0';
    document.body.style.background = 'linear-gradient(135deg, #1a237e, #283593)';
  }

  function loadRandom() {
    img.style.display = 'block';
    loadImage('https://picsum.photos/1920/1080?random=' + Date.now());
  }

  /* переключение */
  function apply() {
    clearTimeout(cycleTimer);
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    ytFrame.style.display = 'none';
    img.style.display = 'none';
    canvas.style.display = 'none';

    if (mode === 'video') {
      playVideo(videoIdx);
      scheduleVideoCycle();
    } else if (mode === 'live') {
      startLive();
    } else if (mode === 'photo') {
      loadRandom();
      cycleTimer = setTimeout(function () { loadRandom(); }, 5 * 60 * 1000);
    } else {
      document.body.style.background = 'linear-gradient(135deg, #1a237e, #283593)';
    }
  }

  window.addEventListener('resize', function () {
    if (animFrame) resize();
  });

  apply();

  return {
    setMode: function (m) { mode = m; apply(); },
    setWeather: function (fx) { weatherFx = fx; },
    next: function () {
      if (mode === 'video') {
        playVideo(videoIdx + 1);
        scheduleVideoCycle();
      } else if (mode === 'photo') {
        loadRandom();
      }
    },
    dim: function (d) {
      overlay.style.background = d
        ? 'rgba(0,0,0,0.5)'
        : 'linear-gradient(to bottom, rgba(0,0,0,.12) 0%, rgba(0,0,0,.03) 40%, rgba(0,0,0,.4) 100%)';
    }
  };
})();

/* ============================================================
   ПОГОДА
   ============================================================ */
const WMO = {
  0: ['ясно', '☀️', 'clear'], 1: ['малооблачно', '🌤', 'clear'], 2: ['переменная облачность', '⛅', 'cloud'],
  3: ['пасмурно', '☁️', 'cloud'], 45: ['туман', '🌫', 'fog'], 48: ['изморозь', '🌫', 'fog'],
  51: ['слабая морось', '🌦', 'rain'], 53: ['морось', '🌦', 'rain'], 55: ['сильная морось', 'rain'],
  61: ['слабый дождь', '🌧', 'rain'], 63: ['дождь', '🌧', 'rain'], 65: ['сильный дождь', '🌧', 'rain'],
  71: ['слабый снег', '🌨', 'snow'], 73: ['снег', '🌨', 'snow'], 75: ['сильный снег', '❄️', 'snow'],
  77: ['снежная крупа', '❄️', 'snow'], 80: ['ливень', '🌦', 'rain'], 81: ['сильный ливень', '🌧', 'rain'],
  82: ['проливной дождь', '🌧', 'rain'], 85: ['снегопад', '🌨', 'snow'], 86: ['сильный снегопад', '❄️', 'snow'],
  95: ['гроза', '⛈', 'rain'], 96: ['гроза с градом', '⛈', 'rain'], 99: ['сильная гроза', '⛈', 'rain']
};

let weather = null;

function fetchWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + cfg.lat +
    '&longitude=' + cfg.lon +
    '&current=temperature_2m,weather_code' +
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
      const info = WMO[weather.code];
      if (info) wall.setWeather(info[2]);
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

/* ============================================================
   ЧАСЫ И ПРИВЕТСТВИЕ
   ============================================================ */
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

function greetingText() {
  const now = new Date();
  let t = cfg.greeting || 'Ассаляму алейкум';
  if (cfg.name) t += ', ' + cfg.name;
  t += '!';
  if (weather) {
    const info = WMO[weather.code] || ['—', ''];
    t += ' Сейчас ' + (weather.temp > 0 ? 'плюс ' : 'минус ') + Math.abs(weather.temp) +
      ' градусов, ' + info[0] + '.';
  }
  t += ' Время ' + now.getHours() + ' ' + String(now.getMinutes()).padStart(2, '0') + '.';
  return t;
}

function showGreeting(speakIt) {
  const short = greetingText().split('. ')[0] + '.';
  const el = $('greeting');
  el.textContent = short;
  el.classList.add('show');
  if (speakIt) speak(greetingText());
}

/* ============================================================
   ГОЛОС
   ============================================================ */
function speak(text) {
  if (!cfg.voice) return;
  try {
    const short = text.length > 180 ? text.substring(0, 178) + '...' : text;
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=ru&client=tw-ob&q=' + encodeURIComponent(short);
    const audio = new Audio(url);
    audio.onerror = function () { speakFallback(text); };
    audio.play().catch(function () { speakFallback(text); });
    return;
  } catch (e) {
    speakFallback(text);
  }
}

function speakFallback(text) {
  try {
    if (window.tizen && tizen.tts) {
      const voices = tizen.tts.getAllVoices();
      let v = null;
      for (let i = 0; i < voices.length; i++) {
        if (voices[i].language && voices[i].language.indexOf('ru') === 0) { v = voices[i]; break; }
      }
      if (!v && voices.length > 0) v = voices[0];
      tizen.tts.prepare(function () {
        try {
          tizen.tts.speak(text, function () {}, function () {}, function () {}, v ? { voice: v } : undefined);
        } catch (e2) {
          try { tizen.tts.speak(text, function () {}, function () {}, function () {}); } catch (e3) {}
        }
      }, function () {});
      return;
    }
  } catch (e) {}
  try {
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      speechSynthesis.speak(u);
    }
  } catch (e) {}
}

/* ============================================================
   ЗАСТАВКА
   ============================================================ */
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

/* ============================================================
   НАСТРОЙКИ
   ============================================================ */
function openSettings() {
  $('s-name').value = cfg.name;
  $('s-greeting').value = cfg.greeting || 'Ассаляму алейкум';
  $('s-lat').value = cfg.lat;
  $('s-lon').value = cfg.lon;
  $('s-voice').checked = !!cfg.voice;
  $('s-idle').value = cfg.idleMin;
  $('s-wall').value = cfg.wallpaper || 'video';
  $('s-videoint').value = cfg.videoInterval || 10;
  $('s-videos').value = cfg.videos || '';
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
    cfg.greeting = $('s-greeting').value.trim() || 'Ассаляму алейкум';
    cfg.lat = parseFloat($('s-lat').value) || DEFAULTS.lat;
    cfg.lon = parseFloat($('s-lon').value) || DEFAULTS.lon;
    cfg.voice = $('s-voice').checked;
    cfg.idleMin = Math.min(120, Math.max(1, parseInt($('s-idle').value, 10) || 2));
    cfg.wallpaper = $('s-wall').value;
    cfg.videoInterval = Math.min(120, Math.max(1, parseInt($('s-videoint').value, 10) || 10));
    cfg.videos = $('s-videos').value.trim();
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
    var k = e.keyCode;
    /* кластеры кнопок: клавиатура + пульт ТВ */
    if (k === 77 || k === 18 || k === 10135 || k === 405) {
      /* M / Menu / Tools / Yellow → настройки */
      if ($('settings').classList.contains('hidden')) openSettings();
      else closeSettings();
    } else if (k === 27 || k === 10009 || k === 461) {
      /* Esc / Back → закрыть */
      if (!$('settings').classList.contains('hidden')) closeSettings();
    } else if (k === 84 || k === 404) {
      /* T / Green → повторить приветствие */
      showGreeting(true);
    } else if (k === 78 || k === 403) {
      /* N / Red → следующий ролик */
      wall.next();
    }
  });
  document.addEventListener('mousemove', resetIdle);
  document.addEventListener('click', resetIdle);

  /* регистрируем кнопки пульта */
  try {
    if (window.tizen && tizen.tvinputdevice) {
      ['Menu', 'Tools', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow'].forEach(function (key) {
        try { tizen.tvinputdevice.registerKey(key); } catch (e) {}
      });
    }
  } catch (e) {}
}

/* ============================================================
   СТАТУС TTS
   ============================================================ */
function checkTTS() {
  const el = $('tts-status');
  let status = 'Голос: Google TTS (нейросетевой)';
  try {
    if (window.tizen && tizen.tts) {
      const voices = tizen.tts.getAllVoices();
      status += ' + Tizen TTS (' + voices.length + ' голосов)';
    }
  } catch (e) {}
  el.textContent = status;
  el.classList.add('show');
  setTimeout(function () { el.classList.remove('show'); }, 8000);
}

/* ============================================================
   СТАРТ
   ============================================================ */
function init() {
  tick();
  setInterval(tick, 1000);
  fetchWeather();
  setInterval(fetchWeather, 15 * 60 * 1000);
  bindUI();
  bindKeys();
  resetIdle();
  checkTTS();
  setTimeout(function () { showGreeting(true); }, 1500);
}

init();
