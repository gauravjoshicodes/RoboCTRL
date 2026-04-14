/**
 * ════════════════════════════════════════════════════════
 *  Robot Motion Control — Tesla Dashboard Simulator
 *  Physics, Telemetry, Autonomous Mode, Weather, Compass
 * ════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════
//  1. CANVAS & GLOBALS
// ═══════════════════════════════════════
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const sCanvas = document.getElementById('speedoCanvas');
const sCtx = sCanvas.getContext('2d');
const mmCanvas = document.getElementById('minimap');
const mCtx = mmCanvas.getContext('2d');

const WORLD = 3000;
let lastTime = 0, dt = 0, frameCount = 0, fps = 60;
let nightMode = false, rainMode = false, showTrail = true;
let camZoom = 1.6;

// ═══════════════════════════════════════
//  2. PHYSICS & ROBOT STATE
// ═══════════════════════════════════════
const PHY = {
    accel: 0.04, brake: 0.08, friction: 0.018, engineBrake: 0.025,
    maxSpeed: 4.5, maxReverse: 2.0,
    steerSpeed: 0.035, steerReturn: 0.08, maxSteer: 0.045,
    turnRate: 0.0025, wheelBase: 44,
};

const robot = {
    x: WORLD / 2, y: WORLD / 2, angle: -Math.PI / 2,
    speed: 0, targetSpeed: 0,
    steer: 0,
    width: 46, height: 58,
    direction: 'stop',
    trail: [],
    // Telemetry
    battery: 100, temp: 32, health: 100, power: 0,
};

// Camera
const cam = { x: WORLD / 2, y: WORLD / 2 };

// Autonomous mode
let autoMode = false;
let autoTimer = 0;
let autoSeq = ['forward', 'forward', 'forward', 'left', 'forward', 'forward', 'right', 'forward'];
let autoStep = 0;

// Obstacles
let obstacles = [];

// Rain drops
let rainDrops = [];

// ═══════════════════════════════════════
//  3. DIRECTION LOGIC (maps to Arduino)
// ═══════════════════════════════════════
const DIR = {
    forward:  { IN1:'HIGH',IN2:'LOW', IN3:'HIGH',IN4:'LOW', lDir:'FORWARD', rDir:'FORWARD', row:'rFwd' },
    backward: { IN1:'LOW',IN2:'HIGH',IN3:'LOW', IN4:'HIGH',lDir:'BACKWARD',rDir:'BACKWARD',row:'rBwd' },
    left:     { IN1:'LOW',IN2:'HIGH',IN3:'HIGH',IN4:'LOW', lDir:'BACKWARD',rDir:'FORWARD', row:'rLeft' },
    right:    { IN1:'HIGH',IN2:'LOW', IN3:'LOW', IN4:'HIGH',lDir:'FORWARD', rDir:'BACKWARD',row:'rRight' },
    stop:     { IN1:'LOW',IN2:'LOW', IN3:'LOW', IN4:'LOW', lDir:'STOPPED', rDir:'STOPPED', row:'rStop' },
};

const DIR_COLOR = {
    forward:'#38bdf8', backward:'#f87171', left:'#fbbf24', right:'#a78bfa', stop:'#475569'
};

// ═══════════════════════════════════════
//  4. WORLD GENERATION
// ═══════════════════════════════════════
function generateWorld() {
    obstacles = [];
    const rng = s => { let h = s; return () => { h = (h * 16807) % 2147483647; return (h-1)/2147483646; }; };
    const r = rng(42);
    for (let i = 0; i < 50; i++) {
        const ox = r() * WORLD, oy = r() * WORLD;
        const ow = 40 + r() * 80, oh = 40 + r() * 80;
        const dx = ox + ow/2 - WORLD/2, dy = oy + oh/2 - WORLD/2;
        if (Math.sqrt(dx*dx+dy*dy) < 180) continue;
        obstacles.push({ x:ox, y:oy, w:ow, h:oh });
    }
}

// ═══════════════════════════════════════
//  5. INPUT
// ═══════════════════════════════════════
const keys = {};
let btnControl = false; // true = direction set by button click (persist until key used)

document.addEventListener('keydown', e => {
    keys[e.key] = true;
    btnControl = false; // Keyboard takes over from button control
    if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

function getInput() {
    if (autoMode) return;
    if (btnControl) return; // Button-set direction persists — don't override

    const fwd = keys['w'] || keys['W'] || keys['ArrowUp'];
    const bwd = keys['s'] || keys['S'] || keys['ArrowDown'];
    const left = keys['a'] || keys['A'] || keys['ArrowLeft'];
    const right = keys['d'] || keys['D'] || keys['ArrowRight'];
    const brake = keys[' '];

    let newDir = robot.direction;
    if (brake) newDir = 'stop';
    else if (fwd && left) newDir = 'left';
    else if (fwd && right) newDir = 'right';
    else if (fwd) newDir = 'forward';
    else if (bwd) newDir = 'backward';
    else if (left) newDir = 'left';
    else if (right) newDir = 'right';
    else if (!fwd && !bwd && !left && !right) newDir = 'stop';

    if (newDir !== robot.direction) setDirection(newDir);
}

// Button clicks — set direction AND flag to persist it
document.getElementById('bFwd').addEventListener('click', () => { btnControl = true; setDirection('forward'); });
document.getElementById('bBwd').addEventListener('click', () => { btnControl = true; setDirection('backward'); });
document.getElementById('bLeft').addEventListener('click', () => { btnControl = true; setDirection('left'); });
document.getElementById('bRight').addEventListener('click', () => { btnControl = true; setDirection('right'); });
document.getElementById('bStop').addEventListener('click', () => { btnControl = true; setDirection('stop'); });

// ═══════════════════════════════════════
//  6. SET DIRECTION (core function)
// ═══════════════════════════════════════
function setDirection(dir) {
    const prev = robot.direction;
    robot.direction = dir;
    const s = DIR[dir];
    const pwm = dir === 'stop' ? 0 : document.getElementById('pwmSlider').value;

    // Update pins
    setPin('pIN1', s.IN1); setPin('pIN2', s.IN2);
    setPin('pIN3', s.IN3); setPin('pIN4', s.IN4);
    document.getElementById('pENA').textContent = pwm;
    document.getElementById('pENA').className = `pv pwm ${pwm > 0 ? 'high' : ''}`;
    document.getElementById('pENB').textContent = pwm;
    document.getElementById('pENB').className = `pv pwm ${pwm > 0 ? 'high' : ''}`;

    // Motor direction labels
    const mDirL = document.getElementById('mDirL');
    const mDirR = document.getElementById('mDirR');
    mDirL.textContent = s.lDir; mDirL.className = `mc-dir ${s.lDir === 'FORWARD' ? 'fwd' : s.lDir === 'BACKWARD' ? 'bwd' : ''}`;
    mDirR.textContent = s.rDir; mDirR.className = `mc-dir ${s.rDir === 'FORWARD' ? 'fwd' : s.rDir === 'BACKWARD' ? 'bwd' : ''}`;
    document.getElementById('mCardL').className = `motor-card ${s.lDir === 'FORWARD' ? 'fwd' : s.lDir === 'BACKWARD' ? 'bwd' : ''}`;
    document.getElementById('mCardR').className = `motor-card ${s.rDir === 'FORWARD' ? 'fwd' : s.rDir === 'BACKWARD' ? 'bwd' : ''}`;

    // Buttons
    ['bFwd','bBwd','bLeft','bRight','bStop'].forEach(id => document.getElementById(id).classList.remove('active'));
    const bMap = { forward:'bFwd', backward:'bBwd', left:'bLeft', right:'bRight', stop:'bStop' };
    document.getElementById(bMap[dir]).classList.add('active');

    // Truth table
    document.querySelectorAll('.tt tbody tr').forEach(r => r.classList.remove('active-row'));
    document.getElementById(s.row).classList.add('active-row');

    // Main status
    const ms = document.getElementById('mainStatus');
    const mt = document.getElementById('mainStatusText');
    if (autoMode) { ms.className = 'main-status auto'; mt.textContent = 'AUTONOMOUS'; }
    else if (dir === 'stop') { ms.className = 'main-status'; mt.textContent = 'IDLE'; }
    else if (dir === 'forward') { ms.className = 'main-status active'; mt.textContent = 'MOVING FORWARD'; }
    else if (dir === 'backward') { ms.className = 'main-status reverse'; mt.textContent = 'REVERSING'; }
    else { ms.className = 'main-status turning'; mt.textContent = `TURNING ${dir.toUpperCase()}`; }

    // Status badge
    const sb = document.getElementById('statusBadge');
    if (sb) { /* handled by mainStatus */ }

    // Log (only if direction changed)
    if (prev !== dir) {
        logSerial(`>>> ${s.lDir === 'STOPPED' ? 'STOP' : dir.toUpperCase()} | IN1=${s.IN1} IN2=${s.IN2} IN3=${s.IN3} IN4=${s.IN4} | PWM=${pwm}`, dir);
    }
}

function setPin(id, val) {
    const el = document.getElementById(id);
    el.textContent = val;
    el.className = `pv ${val === 'HIGH' ? 'high' : ''}`;
}

// ═══════════════════════════════════════
//  7. PHYSICS UPDATE
// ═══════════════════════════════════════
function updatePhysics() {
    const f = Math.min(dt / 16.67, 2.5);
    const pwmFactor = document.getElementById('pwmSlider').value / 255;
    const maxSpd = PHY.maxSpeed * pwmFactor;

    // ── Acceleration & Steering based on direction ──
    switch (robot.direction) {
        case 'forward':
            // Pure forward: speed up, angle stays LOCKED (no turning)
            robot.speed += PHY.accel * f;
            if (robot.speed > maxSpd) robot.speed = maxSpd;
            break;

        case 'backward':
            // Pure backward: reverse, angle stays LOCKED
            robot.speed -= PHY.accel * 0.7 * f;
            if (robot.speed < -PHY.maxReverse * pwmFactor) robot.speed = -PHY.maxReverse * pwmFactor;
            break;

        case 'left':
            // Differential drive: left motor backward, right motor forward → turns left
            // Also moves forward slightly while turning
            robot.speed += PHY.accel * 0.4 * f;
            if (robot.speed > maxSpd * 0.5) robot.speed = maxSpd * 0.5;
            robot.angle -= 0.025 * f;
            break;

        case 'right':
            // Differential drive: left motor forward, right motor backward → turns right
            robot.speed += PHY.accel * 0.4 * f;
            if (robot.speed > maxSpd * 0.5) robot.speed = maxSpd * 0.5;
            robot.angle += 0.025 * f;
            break;

        case 'stop':
            // Brake to zero
            if (robot.speed > 0) { robot.speed -= PHY.brake * f; if (robot.speed < 0) robot.speed = 0; }
            else if (robot.speed < 0) { robot.speed += PHY.brake * f; if (robot.speed > 0) robot.speed = 0; }
            break;
    }

    // Friction
    robot.speed *= (1 - PHY.friction * f);
    if (Math.abs(robot.speed) < 0.005) robot.speed = 0;

    // Position update
    const prevX = robot.x, prevY = robot.y;
    robot.x += Math.cos(robot.angle) * robot.speed * f;
    robot.y += Math.sin(robot.angle) * robot.speed * f;

    // World bounds
    robot.x = Math.max(20, Math.min(WORLD - 20, robot.x));
    robot.y = Math.max(20, Math.min(WORLD - 20, robot.y));

    // Collision
    for (const o of obstacles) {
        const hw = robot.width / 2, hh = robot.height / 2;
        if (robot.x + hw > o.x && robot.x - hw < o.x + o.w &&
            robot.y + hh > o.y && robot.y - hh < o.y + o.h) {
            robot.x = prevX; robot.y = prevY;
            robot.speed *= -0.3;
            robot.health = Math.max(0, robot.health - 2);
            showToast('⚠ Collision detected!');
            break;
        }
    }

    // Trail
    if (showTrail && robot.direction !== 'stop' && Math.abs(robot.speed) > 0.1) {
        robot.trail.push({ x: robot.x, y: robot.y, dir: robot.direction });
        if (robot.trail.length > 800) robot.trail.shift();
    }

    // Telemetry
    updateTelemetry(f);
}

// ═══════════════════════════════════════
//  8. TELEMETRY SIMULATION
// ═══════════════════════════════════════
function updateTelemetry(f) {
    const moving = Math.abs(robot.speed) > 0.05;

    // Battery: drains when moving
    if (moving) robot.battery = Math.max(0, robot.battery - 0.003 * f);
    else robot.battery = Math.min(100, robot.battery + 0.001 * f);

    // Temperature: rises when moving, cools when idle
    const targetTemp = moving ? 32 + Math.abs(robot.speed) * 15 : 32;
    robot.temp += (targetTemp - robot.temp) * 0.01 * f;

    // Power draw
    robot.power = Math.abs(robot.speed) * 1.8;

    // Update DOM
    const absSpd = Math.abs(robot.speed);
    document.getElementById('telSpeed').innerHTML = `${(absSpd * 20).toFixed(0)} <small>cm/s</small>`;
    document.getElementById('telBattery').textContent = `${robot.battery.toFixed(0)}%`;
    document.getElementById('batteryFill').style.width = `${robot.battery}%`;
    document.getElementById('batteryFill').style.background =
        robot.battery > 50 ? 'linear-gradient(90deg,#38bdf8,#4ade80)' :
        robot.battery > 20 ? 'linear-gradient(90deg,#fbbf24,#fb923c)' : '#f87171';

    document.getElementById('telTemp').textContent = `${robot.temp.toFixed(0)}°C`;
    document.getElementById('tempFill').style.width = `${Math.min(100, (robot.temp - 20) / 60 * 100)}%`;
    document.getElementById('tempFill').style.background =
        robot.temp < 50 ? '#4ade80' : robot.temp < 70 ? '#fbbf24' : '#f87171';

    document.getElementById('telPower').innerHTML = `${robot.power.toFixed(1)} <small>W</small>`;

    document.getElementById('telHealth').textContent = `${robot.health.toFixed(0)}%`;
    document.getElementById('healthFill').style.width = `${robot.health}%`;
    document.getElementById('healthFill').style.background =
        robot.health > 60 ? '#4ade80' : robot.health > 30 ? '#fbbf24' : '#f87171';

    // Sensor status
    const sensor = document.getElementById('telSensor');
    if (robot.battery > 5) {
        sensor.textContent = 'ACTIVE'; sensor.className = 'status-value green-text';
    } else {
        sensor.textContent = 'INACTIVE'; sensor.className = 'status-value red-text';
    }

    // Warnings
    if (robot.battery < 15 && frameCount % 120 === 0) showToast('🔋 Low battery warning!');
    if (robot.temp > 65 && frameCount % 120 === 0) showToast('🌡 Motor overheating!');
    if (robot.health < 25 && frameCount % 180 === 0) showToast('❤️ Robot health critical!');

    // Speed display
    document.getElementById('speedoNum').textContent = Math.round(absSpd * 20);

    // Position display
    document.getElementById('posDisplay').textContent =
        `X: ${Math.round(robot.x)}  Y: ${Math.round(robot.y)}  θ: ${Math.round(robot.angle * 180 / Math.PI)}°`;

    // Compass
    const deg = ((robot.angle * 180 / Math.PI) % 360 + 450) % 360;
    document.getElementById('compassNeedle').style.transform = `translate(-50%,0) rotate(${deg}deg)`;
    document.getElementById('compassDeg').textContent = `${Math.round(deg)}°`;
}

// ═══════════════════════════════════════
//  9. AUTONOMOUS MODE
// ═══════════════════════════════════════
document.getElementById('modeManual').addEventListener('click', () => {
    autoMode = false;
    document.getElementById('modeManual').classList.add('active');
    document.getElementById('modeAuto').classList.remove('active');
    document.getElementById('autoStatus').style.display = 'none';
    setDirection('stop');
    logSerial('[MODE] Switched to MANUAL control.', 'info');
});

document.getElementById('modeAuto').addEventListener('click', () => {
    autoMode = true;
    document.getElementById('modeAuto').classList.add('active');
    document.getElementById('modeManual').classList.remove('active');
    document.getElementById('autoStatus').style.display = 'flex';
    autoStep = 0; autoTimer = 0;
    logSerial('[MODE] AUTONOMOUS navigation started.', 'forward');
});

function updateAutoMode() {
    if (!autoMode) return;
    autoTimer += dt;
    if (autoTimer > 2000) {
        autoTimer = 0;
        const dir = autoSeq[autoStep % autoSeq.length];
        setDirection(dir);
        autoStep++;
    }
}

// ═══════════════════════════════════════
//  10. CAMERA
// ═══════════════════════════════════════
function updateCamera() {
    const f = Math.min(dt / 16.67, 2);
    cam.x += (robot.x - cam.x) * 0.2 * f;
    cam.y += (robot.y - cam.y) * 0.2 * f;
}

// ═══════════════════════════════════════
//  11. RENDERING
// ═══════════════════════════════════════
function resizeCanvas() {
    const r = canvas.parentElement.getBoundingClientRect();
    canvas.width = r.width;
    canvas.height = r.height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function render() {
    const W = canvas.width, H = canvas.height;
    // Background
    ctx.fillStyle = nightMode ? '#030508' : '#0a1018';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-cam.x, -cam.y);

    drawGrid();
    drawObstacles();
    drawTrail();
    drawDirectionGuide();
    drawRobotShadow();
    drawRobot();
    drawRain();

    ctx.restore();
    drawVignette();
}

function drawGrid() {
    const vw = canvas.width / camZoom, vh = canvas.height / camZoom;
    const sx = cam.x - vw / 2 - 50, sy = cam.y - vh / 2 - 50;
    const ex = sx + vw + 100, ey = sy + vh + 100;
    ctx.strokeStyle = nightMode ? 'rgba(30,50,60,0.15)' : 'rgba(56,189,248,0.04)';
    ctx.lineWidth = 0.8;
    const gs = 60;
    for (let x = Math.floor(sx/gs)*gs; x <= ex; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, ey); ctx.stroke();
    }
    for (let y = Math.floor(sy/gs)*gs; y <= ey; y += gs) {
        ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(ex, y); ctx.stroke();
    }
}

function drawObstacles() {
    for (const o of obstacles) {
        ctx.fillStyle = nightMode ? 'rgba(15,25,35,0.7)' : 'rgba(20,35,50,0.5)';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = nightMode ? 'rgba(40,80,100,0.15)' : 'rgba(56,189,248,0.06)';
        ctx.lineWidth = 1;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        if (nightMode) {
            ctx.fillStyle = 'rgba(56,189,248,0.04)';
            for (let wx = o.x + 8; wx < o.x + o.w - 8; wx += 14)
                for (let wy = o.y + 8; wy < o.y + o.h - 8; wy += 14)
                    if (Math.random() > 0.8) ctx.fillRect(wx, wy, 5, 5);
        }
    }
}

function drawTrail() {
    if (!showTrail || robot.trail.length < 2) return;
    for (let i = 1; i < robot.trail.length; i++) {
        const a = (i / robot.trail.length) * 0.45;
        ctx.strokeStyle = DIR_COLOR[robot.trail[i].dir];
        ctx.globalAlpha = a;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(robot.trail[i - 1].x, robot.trail[i - 1].y);
        ctx.lineTo(robot.trail[i].x, robot.trail[i].y);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

function drawDirectionGuide() {
    if (robot.direction === 'stop') return;
    const color = DIR_COLOR[robot.direction];
    const cosA = Math.cos(robot.angle), sinA = Math.sin(robot.angle);

    if (robot.direction === 'forward' || robot.direction === 'backward') {
        const sign = robot.direction === 'forward' ? 1 : -1;
        const ex = robot.x + cosA * 60 * sign, ey = robot.y + sinA * 60 * sign;
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(robot.x, robot.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.setLineDash([]);
        // Arrow
        const ha = robot.direction === 'forward' ? robot.angle : robot.angle + Math.PI;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(ha) * 8, ey + Math.sin(ha) * 8);
        ctx.lineTo(ex + Math.cos(ha - 0.5) * -5, ey + Math.sin(ha - 0.5) * -5);
        ctx.lineTo(ex + Math.cos(ha + 0.5) * -5, ey + Math.sin(ha + 0.5) * -5);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
    } else {
        // Turning arc
        const turnDir = robot.direction === 'left' ? -1 : 1;
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(robot.x, robot.y, 50, robot.angle, robot.angle + turnDir * Math.PI/2, robot.direction === 'left');
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

function drawRobotShadow() {
    ctx.save();
    ctx.translate(robot.x + 5, robot.y + 5);
    ctx.rotate(robot.angle + Math.PI / 2);  // offset so FRONT at local -Y aligns with cos/sin movement
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.roundRect(-robot.width/2 - 2, -robot.height/2 - 2, robot.width + 4, robot.height + 4, 7);
    ctx.fill();
    ctx.restore();
}

function drawRobot() {
    const moving = robot.direction !== 'stop' || Math.abs(robot.speed) > 0.05;
    const color = DIR_COLOR[robot.direction];

    ctx.save();
    ctx.translate(robot.x, robot.y);
    ctx.rotate(robot.angle + Math.PI / 2);  // offset so FRONT at local -Y aligns with cos/sin movement

    const w = robot.width, h = robot.height;
    const hw = w / 2, hh = h / 2;

    // ── Wheels (4 wheels with animated treads) ──
    const wW = 8, wH = 18;
    const wOff = hw + 3;
    const drawWheel = (wx, wy, label) => {
        ctx.fillStyle = moving ? '#2a3a4a' : '#1e2d3d';
        ctx.strokeStyle = moving ? color : '#334155';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(wx - wW/2, wy - wH/2, wW, wH, 2); ctx.fill(); ctx.stroke();
        // Tread animation
        if (Math.abs(robot.speed) > 0.05) {
            ctx.strokeStyle = 'rgba(255,255,255,0.07)';
            ctx.lineWidth = 0.6;
            const off = (Date.now() * robot.speed * 0.3) % wH;
            for (let t = -wH/2 + (off % 3); t < wH/2; t += 3) {
                ctx.beginPath(); ctx.moveTo(wx - wW/2 + 1, t); ctx.lineTo(wx + wW/2 - 1, t); ctx.stroke();
            }
        }
        // Wheel direction arrows when moving
        if (moving && label) {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(label, wx, wy);
        }
    };

    const s = DIR[robot.direction];
    const lArr = moving ? (s.lDir === 'FORWARD' ? '▲' : s.lDir === 'BACKWARD' ? '▼' : '') : '';
    const rArr = moving ? (s.rDir === 'FORWARD' ? '▲' : s.rDir === 'BACKWARD' ? '▼' : '') : '';

    // Front wheels, Rear wheels
    drawWheel(-wOff, -h * 0.3, lArr);
    drawWheel( wOff, -h * 0.3, rArr);
    drawWheel(-wOff,  h * 0.3, lArr);
    drawWheel( wOff,  h * 0.3, rArr);

    // ── Body: Pointed front, flat rear (asymmetric) ──
    const bodyG = ctx.createLinearGradient(0, -hh - 10, 0, hh);
    bodyG.addColorStop(0, '#1a3558');
    bodyG.addColorStop(0.4, '#162d4a');
    bodyG.addColorStop(1, '#0f2035');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    // Pointed nose shape: front tapers to a point
    ctx.moveTo(0, -hh - 12);          // Front tip (extends beyond body)
    ctx.lineTo(hw - 2, -hh + 8);      // Front-right corner
    ctx.lineTo(hw, hh);               // Rear-right corner (flat)
    ctx.lineTo(-hw, hh);              // Rear-left corner (flat)
    ctx.lineTo(-hw + 2, -hh + 8);     // Front-left corner
    ctx.closePath();
    ctx.fill();

    // Body outline with color feedback
    ctx.strokeStyle = moving ? color : 'rgba(56,189,248,0.2)';
    ctx.lineWidth = 2; ctx.stroke();

    // ── FRONT: Big bright arrow pointing forward ──
    // Large front arrow (very visible)
    ctx.fillStyle = moving ? color : '#38bdf8';
    ctx.shadowColor = moving ? color : '#38bdf8';
    ctx.shadowBlur = moving ? 15 : 6;
    ctx.beginPath();
    ctx.moveTo(0, -hh - 10);       // Tip
    ctx.lineTo(-12, -hh + 10);     // Left base
    ctx.lineTo(-4, -hh + 5);       // Left notch
    ctx.lineTo(-4, -hh + 14);      // Left stem
    ctx.lineTo(4, -hh + 14);       // Right stem
    ctx.lineTo(4, -hh + 5);        // Right notch
    ctx.lineTo(12, -hh + 10);      // Right base
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // "FRONT" label — large and bright
    ctx.fillStyle = moving ? color : 'rgba(56,189,248,0.7)';
    ctx.font = 'bold 8px Orbitron';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FRONT', 0, -hh + 22);

    // Front sensor dots row
    ctx.fillStyle = moving ? color : 'rgba(56,189,248,0.35)';
    [-12, -6, 0, 6, 12].forEach(dx => {
        ctx.beginPath(); ctx.arc(dx, -hh + 1, 2, 0, Math.PI * 2); ctx.fill();
    });

    // ── Headlights (front, cyan glow) ──
    ctx.fillStyle = '#66e0ff';
    ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.roundRect(-hw + 4, -hh + 6, 7, 4, 1.5); ctx.fill();
    ctx.beginPath(); ctx.roundRect(hw - 11, -hh + 6, 7, 4, 1.5); ctx.fill();
    ctx.shadowBlur = 0;

    // ── REAR: Flat with red tail lights ──
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-hw + 3, hh - 10, w - 6, 8);

    // Tail lights (red)
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.roundRect(-hw + 4, hh - 8, 8, 4, 1.5); ctx.fill();
    ctx.beginPath(); ctx.roundRect(hw - 12, hh - 8, 8, 4, 1.5); ctx.fill();
    ctx.shadowBlur = 0;

    // "REAR" label
    ctx.fillStyle = 'rgba(248,113,113,0.6)';
    ctx.font = 'bold 7px Orbitron';
    ctx.fillText('REAR', 0, hh - 15);

    // ── LEFT / RIGHT side labels ──
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = 'bold 7px Orbitron';
    // Left label (rotated)
    ctx.save();
    ctx.translate(-hw + 7, 0);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('LEFT', 0, 0);
    ctx.restore();
    // Right label (rotated)
    ctx.save();
    ctx.translate(hw - 7, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('RIGHT', 0, 0);
    ctx.restore();
    ctx.restore();

    // ── Side marker lights ──
    // Left side (amber)
    ctx.fillStyle = 'rgba(251,191,36,0.5)';
    ctx.beginPath(); ctx.roundRect(-hw - 1, -6, 3, 12, 1); ctx.fill();
    // Right side (amber)
    ctx.beginPath(); ctx.roundRect(hw - 2, -6, 3, 12, 1); ctx.fill();

    // ── Center sensor/MCU indicator ──
    ctx.fillStyle = moving ? color : '#38bdf8';
    ctx.shadowColor = moving ? color : '#38bdf8';
    ctx.shadowBlur = moving ? 12 : 4;
    ctx.beginPath(); ctx.arc(0, 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Inner circle ring
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(0, 5, 8, 0, Math.PI * 2); ctx.stroke();

    // ── Glow pulse outline when moving ──
    if (moving) {
        const pulse = 0.1 + Math.sin(Date.now() * 0.004) * 0.06;
        ctx.strokeStyle = color;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -hh - 14);
        ctx.lineTo(hw + 2, -hh + 8);
        ctx.lineTo(hw + 2, hh + 2);
        ctx.lineTo(-hw - 2, hh + 2);
        ctx.lineTo(-hw - 2, -hh + 8);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    ctx.restore();
}

function drawRain() {
    if (!rainMode) return;
    if (frameCount % 2 === 0) {
        for (let i = 0; i < 5; i++) {
            rainDrops.push({
                x: cam.x + (Math.random() - 0.5) * canvas.width / camZoom * 1.3,
                y: cam.y - canvas.height / camZoom / 2 - 10,
                speed: 6 + Math.random() * 4, len: 10 + Math.random() * 14, life: 60,
            });
        }
    }
    ctx.strokeStyle = 'rgba(120,160,200,0.2)'; ctx.lineWidth = 0.7;
    for (let i = rainDrops.length - 1; i >= 0; i--) {
        const r = rainDrops[i];
        r.y += r.speed; r.x += 1; r.life--;
        ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + 2, r.y + r.len); ctx.stroke();
        if (r.life <= 0) rainDrops.splice(i, 1);
    }
    if (rainDrops.length > 400) rainDrops.splice(0, 80);
}

function drawVignette() {
    const W = canvas.width, H = canvas.height;
    const g = ctx.createRadialGradient(W/2, H/2, W*0.2, W/2, H/2, W*0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${nightMode ? 0.5 : 0.25})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ═══════════════════════════════════════
//  12. SPEEDOMETER
// ═══════════════════════════════════════
function drawSpeedometer() {
    const c = sCtx, S = 190, cx = S/2, cy = S/2 + 10, r = 75;
    c.clearRect(0, 0, S, S);
    const pct = Math.min(Math.abs(robot.speed) / PHY.maxSpeed, 1);
    const sA = Math.PI * 0.75, eA = Math.PI * 2.25, sw = eA - sA;

    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cy, r, sA, eA); c.stroke();

    const g = c.createConicGradient(sA, cx, cy);
    g.addColorStop(0, '#38bdf8'); g.addColorStop(0.5, '#4ade80'); g.addColorStop(0.8, '#fbbf24'); g.addColorStop(1, '#f87171');
    c.strokeStyle = g; c.lineWidth = 6;
    c.beginPath(); c.arc(cx, cy, r, sA, sA + sw * pct); c.stroke();

    c.shadowColor = '#38bdf8'; c.shadowBlur = 10;
    c.strokeStyle = `rgba(56,189,248,${pct * 0.4})`; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, r, sA, sA + sw * pct); c.stroke();
    c.shadowBlur = 0;

    for (let i = 0; i <= 10; i++) {
        const a = sA + (sw * i) / 10;
        c.strokeStyle = i/10 <= pct ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)';
        c.lineWidth = i % 2 === 0 ? 1.5 : 0.7;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * (r-8), cy + Math.sin(a) * (r-8));
        c.lineTo(cx + Math.cos(a) * (r - (i%2===0 ? 18 : 13)), cy + Math.sin(a) * (r - (i%2===0 ? 18 : 13)));
        c.stroke();
    }

    const nA = sA + sw * pct;
    c.save(); c.translate(cx, cy); c.rotate(nA);
    c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 4;
    c.beginPath(); c.moveTo(0, -2); c.lineTo(r-14, 0); c.lineTo(0, 2); c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#1e293b'; c.beginPath(); c.arc(0, 0, 4, 0, Math.PI*2); c.fill();
    c.restore();
}

// ═══════════════════════════════════════
//  13. MINIMAP
// ═══════════════════════════════════════
function drawMinimap() {
    const c = mCtx, S = 140;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(5,10,15,0.85)'; c.fillRect(0, 0, S, S);
    c.strokeStyle = 'rgba(56,189,248,0.08)'; c.lineWidth = 0.5;
    for (let x = 0; x <= S; x += S/8) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,S); c.stroke(); }
    for (let y = 0; y <= S; y += S/8) { c.beginPath(); c.moveTo(0,y); c.lineTo(S,y); c.stroke(); }

    c.fillStyle = 'rgba(30,50,70,0.4)';
    for (const o of obstacles) c.fillRect((o.x/WORLD)*S, (o.y/WORLD)*S, Math.max(1,(o.w/WORLD)*S), Math.max(1,(o.h/WORLD)*S));

    // Trail
    c.fillStyle = 'rgba(56,189,248,0.15)';
    for (let i = 0; i < robot.trail.length; i += 8) c.fillRect((robot.trail[i].x/WORLD)*S, (robot.trail[i].y/WORLD)*S, 1, 1);

    const px = (robot.x/WORLD)*S, py = (robot.y/WORLD)*S;
    c.save(); c.translate(px, py); c.rotate(robot.angle);
    c.fillStyle = 'rgba(56,189,248,0.1)';
    c.beginPath(); c.moveTo(0,0); c.lineTo(14,-8); c.lineTo(14,8); c.closePath(); c.fill();
    c.restore();

    c.fillStyle = '#38bdf8'; c.shadowColor = '#38bdf8'; c.shadowBlur = 5;
    c.beginPath(); c.arc(px, py, 3, 0, Math.PI*2); c.fill();
    c.shadowBlur = 0;
}

// ═══════════════════════════════════════
//  14. SERIAL LOG
// ═══════════════════════════════════════
function logSerial(msg, type = 'info') {
    const el = document.getElementById('serial');
    const line = document.createElement('div');
    line.className = `sline ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString('en-US',{hour12:false})}] ${msg}`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
    while (el.children.length > 60) el.removeChild(el.firstChild);
}
document.getElementById('clearLog').addEventListener('click', () => {
    document.getElementById('serial').innerHTML = '';
    logSerial('[SYS] Log cleared.', 'info');
});

// ═══════════════════════════════════════
//  15. UI CONTROLS
// ═══════════════════════════════════════
document.getElementById('pwmSlider').addEventListener('input', e => {
    document.getElementById('pwmVal').textContent = e.target.value;
    if (robot.direction !== 'stop') {
        document.getElementById('pENA').textContent = e.target.value;
        document.getElementById('pENB').textContent = e.target.value;
    }
});

document.getElementById('btnReset').addEventListener('click', () => {
    robot.x = WORLD/2; robot.y = WORLD/2; robot.angle = -Math.PI/2;
    robot.speed = 0; robot.trail = [];
    robot.battery = 100; robot.temp = 32; robot.health = 100;
    setDirection('stop');
    logSerial('[SYS] Robot reset to center.', 'info');
});

document.getElementById('btnNight').addEventListener('click', () => {
    nightMode = !nightMode;
    document.getElementById('btnNight').classList.toggle('on', nightMode);
});

document.getElementById('btnRain').addEventListener('click', () => {
    rainMode = !rainMode;
    document.getElementById('btnRain').classList.toggle('on', rainMode);
    if (!rainMode) rainDrops = [];
});

document.getElementById('btnZoomIn').addEventListener('click', () => { camZoom = Math.min(3.2, camZoom + 0.3); });
document.getElementById('btnZoomOut').addEventListener('click', () => { camZoom = Math.max(0.6, camZoom - 0.3); });

// ═══════════════════════════════════════
//  16. TOAST
// ═══════════════════════════════════════
let toastTimer = null;
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════
//  17. GAME LOOP
// ═══════════════════════════════════════
function loop(ts) {
    dt = ts - lastTime; lastTime = ts; frameCount++;
    if (frameCount % 20 === 0) fps = Math.round(1000 / dt);
    document.getElementById('fpsDisplay').textContent = `${fps} FPS`;

    getInput();
    updateAutoMode();
    updatePhysics();
    updateCamera();
    render();
    drawSpeedometer();
    drawMinimap();

    requestAnimationFrame(loop);
}

generateWorld();
setDirection('stop');
cam.x = robot.x; cam.y = robot.y;
requestAnimationFrame(loop);
