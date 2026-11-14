'use strict';

/* ============================================================
   КОНФИГУРАЦИЯ
   ============================================================ */
const DEFAULTS = {
  name: 'Шухрат',
  lat: 43.238,
  lon: 76.889,
  tzOffset: -1,
  voice: true,
  idleMin: 2,
  wallpaper: 'video',
  greeting: 'Ассаляму алейкум',
  videoInterval: 10,
  videoPreset: 'ocean',
  customVideos: ''
};

function loadCfg() {
  var c = {};
  try { c = JSON.parse(localStorage.getItem('tvgreet') || '{}') || {}; } catch (e) {}
  try {
    var m = document.cookie.match(/tvgreet=([^;]+)/);
    if (m) { var cc = JSON.parse(decodeURIComponent(m[1])); for (var k in cc) if (!(k in c)) c[k] = cc[k]; }
  } catch (e) {}
  return Object.assign({}, DEFAULTS, c);
}
function saveCfg() {
  var s = JSON.stringify(cfg);
  try { localStorage.setItem('tvgreet', s); } catch (e) {}
  try { document.cookie = 'tvgreet=' + encodeURIComponent(s) + ';path=/;max-age=31536000'; } catch (e) {}
}
let cfg = loadCfg();

const $ = (id) => document.getElementById(id);

/* ============================================================
   ОТЛАДКА (оверлей на экране)
   ============================================================ */
let debugLines = [];
function showDebug(msg) {
  debugLines.push('[' + new Date().toLocaleTimeString() + '] ' + msg);
  if (debugLines.length > 8) debugLines.shift();
  var d = $('debug');
  if (d) {
    d.textContent = debugLines.join('\n');
    d.style.display = 'block';
    clearTimeout(d._hide);
    d._hide = setTimeout(function () { d.style.display = 'none'; }, 15000);
  }
  try { console.log('[tvgreet]', msg); } catch (e) {}
}

/* ============================================================
   БАЗОВЫЙ URL — для локальных видео
   ============================================================ */
function getBaseUrl() {
  var href = window.location.href;
  return href.replace(/app\/index\.html.*$/, '').replace(/#.*$/, '');
}

/* ============================================================
   ПРЕСЕТЫ ВИДЕО (прямые CDN-URL — работают и в браузере, и в TizenBrew)
   ============================================================ */
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/KPACAY4IK/tvgreet/';

const PRESETS = {
  ocean:     { name: '🌊 Океан',    urls: ['https://videos.pexels.com/video-files/1093662/1093662-hd_1920_1080_30fps.mp4'], local: ['videos/ocean.mp4', 'videos/ocean3.mp4'] },
  fireplace: { name: '🔥 Камин',    urls: ['https://videos.pexels.com/video-files/3045163/3045163-hd_1920_1080_25fps.mp4'] },
  rain:      { name: '🌧 Дождь',    urls: ['https://videos.pexels.com/video-files/2257011/2257011-hd_1920_1080_24fps.mp4'] },
  snow:      { name: '❄️ Снег',     urls: ['https://videos.pexels.com/video-files/856973/856973-hd_1920_1080_25fps.mp4'] },
  space:     { name: '🌌 Космос',   urls: ['https://videos.pexels.com/video-files/3129957/3129957-hd_1920_1080_25fps.mp4'] },
  forest:    { name: '🌲 Лес',      urls: ['https://videos.pexels.com/video-files/3214448/3214448-hd_1920_1080_25fps.mp4'] },
  custom:    { name: '⭐ Свои URL', urls: [] }
};

function getVideoUrls() {
  if (cfg.videoPreset === 'custom') {
    return (cfg.customVideos || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  var p = PRESETS[cfg.videoPreset] || PRESETS.ocean;
  var urls = (p.urls || []).slice();
  /* добавляем локальные файлы как запасной вариант (для браузера) */
  if (p.local && p.local.length) {
    var base = getBaseUrl();
    p.local.forEach(function (f) { urls.push(base + f); });
  }
  return urls;
}

/* ============================================================
   ВИДЕОФОН (MP4 через same-origin прокси)
   ============================================================ */
const wall = (function () {
  const vidEl = $('vid-wall');
  const img = $('wall');
  const overlay = $('wall-overlay');
  const canvas = $('anim-wall');
  const ctx = canvas.getContext('2d');
  let mode = cfg.wallpaper || 'live';
  let cycleTimer = null;
  let animFrame = null;
  let videoIdx = 0;

  function playVideo(idx) {
    var urls = getVideoUrls();
    showDebug('video urls: ' + urls.length + ' шт, preset=' + cfg.videoPreset);
    if (urls.length === 0) {
      showDebug('нет видео — живые обои');
      startLive();
      return;
    }
    videoIdx = ((idx % urls.length) + urls.length) % urls.length;
    var url = urls[videoIdx];
    showDebug('пробую: ' + url.substring(0, 80));
    hideAll();
    vidEl.style.display = 'block';
    vidEl.style.opacity = '0';
    vidEl.src = url;
    vidEl.load();
    var ok = false;
    vidEl.oncanplay = function () {
      ok = true;
      showDebug('видео загружено, play()');
      vidEl.play().then(function () {
        vidEl.style.opacity = '1';
        showDebug('видео играет!');
      }).catch(function (err) {
        showDebug('play() ошибка: ' + (err && err.message || err));
        startLive();
      });
    };
    vidEl.onerror = function () {
      showDebug('видео ошибка загрузки');
      if (!ok) startLive();
    };
    setTimeout(function () {
      if (!ok && vidEl.paused) {
        showDebug('таймаут — видео не стартовало');
        startLive();
      }
    }, 5000);
  }

  function scheduleVideoCycle() {
    clearTimeout(cycleTimer);
    var mins = Math.max(1, parseInt(cfg.videoInterval, 10) || 10);
    cycleTimer = setTimeout(function () {
      playVideo(videoIdx + 1);
      scheduleVideoCycle();
    }, mins * 60 * 1000);
  }

  function hideAll() {
    clearTimeout(cycleTimer);
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    vidEl.style.display = 'none';
    vidEl.pause();
    img.style.display = 'none';
    canvas.style.display = 'none';
  }

  /* === Canvas живые обои === */
  let W = 1920, H = 1080;
  function resize() { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; }

  const stars = [], clouds = [], drops = [], flakes = [], fireflies = [], auroraWaves = [];
  function initParticles() {
    stars.length = 0; clouds.length = 0; drops.length = 0; flakes.length = 0; fireflies.length = 0; auroraWaves.length = 0;
    for (var i = 0; i < 70; i++) stars.push({ x: Math.random(), y: Math.random() * 0.65, r: Math.random() * 1.5 + 0.5, tw: Math.random() * 6.28 });
    for (var i = 0; i < 6; i++) clouds.push({ x: Math.random() * 1.4 - 0.2, y: 0.08 + Math.random() * 0.3, s: 0.5 + Math.random() * 0.8, v: 0.00003 + Math.random() * 0.00006 });
    for (var i = 0; i < 60; i++) drops.push({ x: Math.random(), y: Math.random(), l: 0.015 + Math.random() * 0.025, v: 0.005 + Math.random() * 0.007 });
    for (var i = 0; i < 50; i++) flakes.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.2, v: 0.0006 + Math.random() * 0.0012, w: Math.random() * 6.28 });
    for (var i = 0; i < 18; i++) fireflies.push({ x: Math.random(), y: 0.5 + Math.random() * 0.45, r: 1.5 + Math.random() * 2, vx: (Math.random() - 0.5) * 0.0004, vy: (Math.random() - 0.5) * 0.0003, ph: Math.random() * 6.28 });
    for (var i = 0; i < 4; i++) auroraWaves.push({ y: 0.1 + i * 0.08, amp: 0.03 + Math.random() * 0.04, speed: 0.0003 + Math.random() * 0.0005, ph: Math.random() * 6.28, hue: 120 + i * 30 });
  }

  function skyColors(h) {
    var stops = [[0,[12,14,42],[22,26,62]],[5,[30,28,68],[60,48,100]],[7,[210,100,70],[245,180,100]],[10,[70,140,210],[130,195,235]],[14,[60,135,215],[120,190,240]],[17,[215,110,65],[240,170,95]],[19,[80,50,110],[140,80,140]],[21,[25,25,65],[40,35,85]],[24,[12,14,42],[22,26,62]]];
    var a = stops[0], b = stops[stops.length - 1];
    for (var i = 0; i < stops.length - 1; i++) if (h >= stops[i][0] && h <= stops[i+1][0]) { a = stops[i]; b = stops[i+1]; break; }
    var t = (h - a[0]) / Math.max(0.001, b[0] - a[0]);
    function mix(ca, cb) { return [0,1,2].map(function (i) { return Math.round(ca[i] + (cb[i]-ca[i])*t); }); }
    return { top: mix(a[1],b[1]), bot: mix(a[2],b[2]) };
  }

  let weatherFx = 'clear';

  function drawSky(h) {
    var c = skyColors(h);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb('+c.top.join(',')+')'); g.addColorStop(1, 'rgb('+c.bot.join(',')+')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function drawStars(h, t) {
    if (h > 5.5 && h < 20) return;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], tw = 0.3 + 0.7 * Math.abs(Math.sin(s.tw + t * 0.8));
      ctx.fillStyle = 'rgba(255,255,255,' + (0.8*tw).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, 6.28); ctx.fill();
    }
  }
  function drawSunMoon(h, t) {
    if (h > 5.5 && h < 18.5) {
      var dt = (h-5.5)/13, x = W*(0.1+dt*0.8), y = H*(0.6-Math.sin(dt*Math.PI)*0.42), r = Math.min(W,H)*0.05;
      var g = ctx.createRadialGradient(x,y,r*0.2,x,y,r*3.5); g.addColorStop(0,'rgba(255,240,180,0.9)'); g.addColorStop(1,'rgba(255,240,180,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r*3.5,0,6.28); ctx.fill();
      ctx.fillStyle = '#fff5c8'; ctx.beginPath(); ctx.arc(x,y,r,0,6.28); ctx.fill();
    } else {
      var mx = W*0.75, my = H*0.18, r = Math.min(W,H)*0.045;
      var g = ctx.createRadialGradient(mx,my,r*0.2,mx,my,r*3); g.addColorStop(0,'rgba(210,220,255,0.85)'); g.addColorStop(1,'rgba(210,220,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx,my,r*3,0,6.28); ctx.fill();
      ctx.fillStyle = '#e4eaff'; ctx.beginPath(); ctx.arc(mx,my,r,0,6.28); ctx.fill();
      ctx.fillStyle = 'rgba(18,22,50,0.5)'; ctx.beginPath(); ctx.arc(mx-r*0.35,my-r*0.2,r*0.82,0,6.28); ctx.fill();
    }
  }
  function drawClouds(t) {
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i]; c.x += c.v; if (c.x > 1.3) c.x = -0.3;
      var x = c.x*W, y = c.y*H, s = c.s*Math.min(W,H)*0.12;
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.ellipse(x,y,s*1.5,s*0.5,0,0,6.28); ctx.ellipse(x-s*0.6,y+s*0.15,s*0.85,s*0.38,0,0,6.28); ctx.ellipse(x+s*0.7,y+s*0.12,s*0.95,s*0.36,0,0,6.28); ctx.fill();
    }
  }
  function drawRain() {
    ctx.strokeStyle = 'rgba(180,200,255,0.45)'; ctx.lineWidth = 1.3;
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i]; d.y += d.v; if (d.y > 1.05) { d.y = -0.05; d.x = Math.random(); }
      ctx.beginPath(); ctx.moveTo(d.x*W, d.y*H); ctx.lineTo(d.x*W-5, d.y*H+d.l*H); ctx.stroke();
    }
  }
  function drawSnow() {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i]; f.y += f.v; f.w += 0.015; if (f.y > 1.05) { f.y = -0.05; f.x = Math.random(); }
      ctx.beginPath(); ctx.arc(f.x*W+Math.sin(f.w)*10, f.y*H, f.r, 0, 6.28); ctx.fill();
    }
  }
  function drawAurora(t) {
    for (var i = 0; i < auroraWaves.length; i++) {
      var w = auroraWaves[i]; ctx.beginPath();
      for (var x = 0; x <= W; x += 20) {
        var y = H*(w.y+Math.sin(x*0.002+t*w.speed*60+w.ph)*w.amp);
        if (x === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.lineTo(W,H*(w.y+0.12)); ctx.lineTo(0,H*(w.y+0.12)); ctx.closePath();
      var g = ctx.createLinearGradient(0,H*w.y,0,H*(w.y+0.12)); g.addColorStop(0,'hsla('+w.hue+',80%,60%,0.12)'); g.addColorStop(1,'hsla('+w.hue+',80%,60%,0)');
      ctx.fillStyle = g; ctx.fill();
    }
  }
  function drawFireflies(t) {
    for (var i = 0; i < fireflies.length; i++) {
      var f = fireflies[i]; f.x += f.vx; f.y += f.vy;
      if (f.x < 0.02 || f.x > 0.98) f.vx *= -1; if (f.y < 0.45 || f.y > 0.97) f.vy *= -1;
      var glow = 0.3+0.7*Math.abs(Math.sin(t*0.001+f.ph)), r = f.r*glow;
      var g = ctx.createRadialGradient(f.x*W,f.y*H,0,f.x*W,f.y*H,r*6); g.addColorStop(0,'rgba(255,255,150,'+(0.6*glow).toFixed(3)+')'); g.addColorStop(1,'rgba(255,255,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x*W,f.y*H,r*6,0,6.28); ctx.fill();
    }
  }
  function drawHills() {
    var base = H*0.82;
    ctx.fillStyle = 'rgba(15,22,35,0.7)';
    ctx.beginPath(); ctx.moveTo(0,H); ctx.lineTo(0,base+25);
    for (var x = 0; x <= W; x += 35) ctx.lineTo(x, base+Math.sin(x*0.0022)*42+Math.sin(x*0.0007+2)*55);
    ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(10,16,26,0.8)';
    ctx.beginPath(); ctx.moveTo(0,H); ctx.lineTo(0,base+90);
    for (var x = 0; x <= W; x += 35) ctx.lineTo(x, base+90+Math.sin(x*0.0016+4)*38+Math.sin(x*0.0006)*28);
    ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
  }

  function frame(ts) {
    var now = new Date();
    var h = now.getHours() + now.getMinutes()/60;
    drawSky(h); drawStars(h,ts||0); drawSunMoon(h,ts||0);
    if (h < 6 || h > 20) drawAurora(ts||0);
    drawClouds(ts||0);
    if (weatherFx === 'rain') drawRain();
    if (weatherFx === 'snow') drawSnow();
    drawHills();
    if (h > 19 || h < 6) drawFireflies(ts||0);
    animFrame = requestAnimationFrame(frame);
  }

  function startLive() {
    hideAll();
    canvas.style.display = 'block';
    resize(); initParticles();
    if (!animFrame) animFrame = requestAnimationFrame(frame);
  }

  function loadRandom() {
    hideAll();
    img.style.display = 'block';
    img.onload = function () { img.style.opacity = '1'; };
    img.onerror = function () { img.style.opacity = '0'; startLive(); };
    img.src = 'https://picsum.photos/1920/1080?random=' + Date.now();
    img.style.opacity = '0';
    document.body.style.background = 'linear-gradient(135deg, #1a237e, #283593)';
  }

  function apply() {
    if (mode === 'video') {
      playVideo(videoIdx);
      scheduleVideoCycle();
    } else if (mode === 'live') {
      startLive();
    } else if (mode === 'photo') {
      loadRandom();
      cycleTimer = setTimeout(function () { loadRandom(); }, 5*60*1000);
    } else {
      hideAll();
      document.body.style.background = 'linear-gradient(135deg, #1a237e, #283593)';
    }
  }

  window.addEventListener('resize', function () { if (animFrame) resize(); });
  vidEl.style.transition = 'opacity 1.5s';
  vidEl.loop = true;
  vidEl.muted = true;
  apply();

  return {
    setMode: function (m) { mode = m; apply(); },
    setWeather: function (fx) { weatherFx = fx; },
    next: function () {
      if (mode === 'video') { playVideo(videoIdx + 1); scheduleVideoCycle(); }
      else if (mode === 'photo') { loadRandom(); }
    },
    dim: function (d) {
      overlay.style.background = d ? 'rgba(0,0,0,0.5)' : 'linear-gradient(to bottom, rgba(0,0,0,.12) 0%, rgba(0,0,0,.03) 40%, rgba(0,0,0,.4) 100%)';
    }
  };
})();

/* ============================================================
   ПОГОДА
   ============================================================ */
const WMO = {
  0: ['ясно','☀️','clear'], 1: ['малооблачно','🌤','clear'], 2: ['переменная облачность','⛅','cloud'],
  3: ['пасмурно','☁️','cloud'], 45: ['туман','🌫','fog'], 48: ['изморозь','🌫','fog'],
  51: ['слабая морось','🌦','rain'], 53: ['морось','🌦','rain'], 55: ['сильная морось','🌦','rain'],
  61: ['слабый дождь','🌧','rain'], 63: ['дождь','🌧','rain'], 65: ['сильный дождь','🌧','rain'],
  71: ['слабый снег','🌨','snow'], 73: ['снег','🌨','snow'], 75: ['сильный снег','❄️','snow'],
  77: ['снежная крупа','❄️','snow'], 80: ['ливень','🌦','rain'], 81: ['сильный ливень','🌧','rain'],
  82: ['проливной дождь','🌧','rain'], 85: ['снегопад','🌨','snow'], 86: ['сильный снегопад','❄️','snow'],
  95: ['гроза','⛈','rain'], 96: ['гроза с градом','⛈','rain'], 99: ['сильная гроза','⛈','rain']
};
let weather = null;

function fetchWeather() {
  fetch('https://api.open-meteo.com/v1/forecast?latitude='+cfg.lat+'&longitude='+cfg.lon+
    '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1')
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var c = j.current;
      weather = { temp: Math.round(c.temperature_2m), code: c.weather_code, tmax: Math.round(j.daily.temperature_2m_max[0]), tmin: Math.round(j.daily.temperature_2m_min[0]) };
      renderWeather();
      var info = WMO[weather.code]; if (info) wall.setWeather(info[2]);
    })
    .catch(function () { $('w-desc').textContent = 'погода недоступна'; });
}

function renderWeather() {
  if (!weather) return;
  var info = WMO[weather.code] || ['—',''];
  $('w-icon').textContent = info[1];
  $('w-temp').textContent = (weather.temp > 0 ? '+' : '') + weather.temp + '°';
  $('w-desc').textContent = info[0] + ' · ' + weather.tmin + '…' + (weather.tmax > 0 ? '+' : '') + weather.tmax + '°';
}

/* ============================================================
   ЧАСЫ (с учётом сдвига часового пояса)
   ============================================================ */
function tick() {
  var now = new Date();
  var tz = parseInt(cfg.tzOffset, 10) || 0;
  var shifted = new Date(now.getTime() + tz * 3600000);
  var hh = String(shifted.getUTCHours()).padStart(2, '0');
  var mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  $('clock').textContent = hh + ':' + mm;
  $('saver-clock').textContent = hh + ':' + mm;
  var days = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  var months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  var ds = days[shifted.getUTCDay()] + ', ' + shifted.getUTCDate() + ' ' + months[shifted.getUTCMonth()];
  $('date').textContent = ds;
  $('saver-date').textContent = ds;
}

function greetingText() {
  var now = new Date();
  var tz = parseInt(cfg.tzOffset, 10) || 0;
  var shifted = new Date(now.getTime() + tz * 3600000);
  var h = shifted.getUTCHours();
  var t = cfg.greeting || 'Ассаляму алейкум';
  if (cfg.name) t += ', ' + cfg.name;
  t += '!';
  if (weather) {
    var info = WMO[weather.code] || ['—',''];
    t += ' Сейчас ' + (weather.temp > 0 ? '+' : '') + weather.temp + '°, ' + info[0] + '.';
  }
  t += ' Время ' + h + ' ' + String(shifted.getUTCMinutes()).padStart(2, '0') + '.';
  return t;
}

function showGreeting(speakIt) {
  $('greeting').textContent = greetingText().split('. ')[0] + '.';
  $('greeting').classList.add('show');
  if (speakIt) speak(greetingText());
}

/* ============================================================
   ГОЛОС
   ============================================================ */
function speak(text) {
  if (!cfg.voice) return;
  try {
    var short = text.length > 180 ? text.substring(0, 178) + '...' : text;
    var audio = new Audio('https://translate.google.com/translate_tts?ie=UTF-8&tl=ru&client=tw-ob&q=' + encodeURIComponent(short));
    audio.onerror = function () { speakFallback(text); };
    audio.play().catch(function () { speakFallback(text); });
    return;
  } catch (e) { speakFallback(text); }
}

function speakFallback(text) {
  try {
    if (window.tizen && tizen.tts) {
      var voices = tizen.tts.getAllVoices(), v = null;
      for (var i = 0; i < voices.length; i++) if (voices[i].language && voices[i].language.indexOf('ru') === 0) { v = voices[i]; break; }
      if (!v && voices.length > 0) v = voices[0];
      tizen.tts.prepare(function () {
        try { tizen.tts.speak(text, function(){}, function(){}, function(){}, v ? {voice:v} : undefined); }
        catch (e2) { try { tizen.tts.speak(text, function(){}, function(){}, function(){}); } catch (e3) {} }
      }, function () {});
      return;
    }
  } catch (e) {}
  try { if (window.speechSynthesis) { var u = new SpeechSynthesisUtterance(text); u.lang = 'ru-RU'; speechSynthesis.speak(u); } } catch (e) {}
}

/* ============================================================
   ЗАСТАВКА
   ============================================================ */
let idleTimer = null, saverOn = false;
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
   НАСТРОЙКИ с навигацией стрелками
   ============================================================ */
const fields = ['s-name','s-greeting','s-lat','s-lon','s-tz','s-voice','s-idle','s-wall','s-videopreset','s-videoint','s-videos','s-save','s-test','s-close'];
let focusIdx = 0;

function highlightField() {
  fields.forEach(function (id, i) {
    var el = $(id);
    if (el) {
      el.style.outline = (i === focusIdx) ? '3px solid #4a86ff' : 'none';
      el.style.outlineOffset = '2px';
    }
  });
  var el = $(fields[focusIdx]);
  if (el) {
    try { el.focus(); } catch (e) {}
    if (el.scrollIntoView) try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }
}

function openSettings() {
  $('s-name').value = cfg.name;
  $('s-greeting').value = cfg.greeting || 'Ассаляму алейкум';
  $('s-lat').value = cfg.lat;
  $('s-lon').value = cfg.lon;
  $('s-tz').value = cfg.tzOffset;
  $('s-voice').checked = !!cfg.voice;
  $('s-idle').value = cfg.idleMin;
  $('s-wall').value = cfg.wallpaper || 'live';
  $('s-videopreset').value = cfg.videoPreset || 'ocean';
  $('s-videoint').value = cfg.videoInterval || 10;
  $('s-videos').value = cfg.customVideos || '';
  $('settings').classList.remove('hidden');
  clearTimeout(idleTimer);
  focusIdx = 0;
  setTimeout(highlightField, 50);
}

function closeSettings() {
  $('settings').classList.add('hidden');
  resetIdle();
}

function saveSettings() {
  cfg.name = $('s-name').value.trim();
  cfg.greeting = $('s-greeting').value.trim() || 'Ассаляму алейкум';
  cfg.lat = parseFloat($('s-lat').value) || DEFAULTS.lat;
  cfg.lon = parseFloat($('s-lon').value) || DEFAULTS.lon;
  cfg.tzOffset = parseInt($('s-tz').value, 10) || 0;
  cfg.voice = $('s-voice').checked;
  cfg.idleMin = Math.min(120, Math.max(1, parseInt($('s-idle').value, 10) || 2));
  cfg.wallpaper = $('s-wall').value;
  cfg.videoPreset = $('s-videopreset').value || 'ocean';
  cfg.videoInterval = Math.min(120, Math.max(1, parseInt($('s-videoint').value, 10) || 10));
  cfg.customVideos = $('s-videos').value.trim();
  saveCfg();
  wall.setMode(cfg.wallpaper);
  fetchWeather();
  tick();
  closeSettings();
}

/* ============================================================
   УПРАВЛЕНИЕ
   ============================================================ */
function bindUI() {
  $('s-save').onclick = saveSettings;
  $('s-test').onclick = function () { cfg.voice = true; speak('Голос работает. ' + greetingText()); };
  $('s-close').onclick = closeSettings;
  $('btn-back').onclick = function () {
    try { window.history.back(); } catch (e) {}
    try { window.parent.postMessage('back', '*'); } catch (e) {}
  };
}

function bindKeys() {
  document.addEventListener('keydown', function (e) {
    resetIdle();
    var k = e.keyCode || e.which;
    var keyName = e.key || '';
    showDebug('KEY code=' + k + ' key=' + keyName);
    var inSettings = !$('settings').classList.contains('hidden');

    if (inSettings) {
      /* ↑ / Down */
      if (k === 38 || k === 10038 || keyName === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        focusIdx = (focusIdx - 1 + fields.length) % fields.length;
        highlightField(); return;
      }
      /* ↓ / Up */
      if (k === 40 || k === 10040 || keyName === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation();
        focusIdx = (focusIdx + 1) % fields.length;
        highlightField(); return;
      }
      /* ← */
      if (k === 37 || k === 10037 || keyName === 'ArrowLeft') {
        e.preventDefault(); e.stopPropagation();
        var el = $(fields[focusIdx]);
        if (el && el.tagName === 'SELECT') el.selectedIndex = Math.max(0, el.selectedIndex - 1);
        return;
      }
      /* → */
      if (k === 39 || k === 10039 || keyName === 'ArrowRight') {
        e.preventDefault(); e.stopPropagation();
        var el = $(fields[focusIdx]);
        if (el && el.tagName === 'SELECT') el.selectedIndex = Math.min(el.options.length - 1, el.selectedIndex + 1);
        return;
      }
      /* OK / Enter */
      if (k === 13 || keyName === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        var el = $(fields[focusIdx]);
        if (!el) return;
        if (el.tagName === 'BUTTON') { el.click(); return; }
        if (el.type === 'checkbox') { el.checked = !el.checked; return; }
        return;
      }
    }

    /* Жёлтая (настройки): 405=Samsung, 77=M, 18=Alt, 10135 */
    if (k === 77 || k === 18 || k === 10135 || k === 405 || keyName === 'F2') {
      e.preventDefault();
      showDebug('→ ' + (inSettings ? 'закрыть' : 'открыть') + ' настройки');
      if (inSettings) closeSettings(); else openSettings();
    } else if (k === 27 || k === 10009 || k === 461 || keyName === 'Escape' || keyName === 'GoBack') {
      /* Назад / Escape */
      if (inSettings) { e.preventDefault(); e.stopPropagation(); closeSettings(); }
    } else if (k === 84 || k === 404 || keyName === 'F1') {
      /* Зелёная — приветствие */
      e.preventDefault();
      showGreeting(true);
    } else if (k === 78 || k === 403 || keyName === 'F3') {
      /* Красная — следующий ролик */
      e.preventDefault();
      wall.next();
    }
  }, true);

  document.addEventListener('mousemove', resetIdle);
  document.addEventListener('click', resetIdle);

  /* === Регистрация кнопок Samsung пульта === */
  try {
    if (window.tizen && tizen.tvinputdevice) {
      showDebug('tizen доступен, регистрирую кнопки');
      var keys = ['Menu','Tools','ColorF0Red','ColorF1Green','ColorF2Yellow','ColorF3Blue',
                  'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',
                  'Return','Exit','Info','Source','ChannelList',
                  'VolumeUp','VolumeDown','VolumeMute','Play','Pause','Stop','Rewind','FastForward'];
      keys.forEach(function (key) {
        try {
          tizen.tvinputdevice.registerKey(key);
        } catch (e) {
          showDebug('registerKey ' + key + ': ' + e.message);
        }
      });
      showDebug('кнопки зарегистрированы (' + keys.length + ' шт)');
    } else {
      showDebug('tizen.tvinputdevice НЕ доступен');
    }
  } catch (e) {
    showDebug('ошибка tizen: ' + e.message);
  }
}

/* ============================================================
   СТАРТ
   ============================================================ */
function init() {
  showDebug('модуль запущен, wallpaper=' + cfg.wallpaper + ', preset=' + cfg.videoPreset);
  showDebug('URL: ' + window.location.href.substring(0, 80));
  showDebug('tizen: ' + (window.tizen ? 'да' : 'нет'));
  tick();
  setInterval(tick, 1000);
  fetchWeather();
  setInterval(fetchWeather, 15 * 60 * 1000);
  bindUI();
  bindKeys();
  resetIdle();
  setTimeout(function () { showGreeting(true); }, 1500);
}

init();
