const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const cartImg = document.getElementById('img-cart');
const faceImg = document.getElementById('img-face');

const uiScore = document.getElementById('score');
const uiGameOver = document.getElementById('game-over');
const uiStartScreen = document.getElementById('start-screen');
const uiFinalScore = document.getElementById('final-score');
const btnRestart = document.getElementById('restart-btn');
const btnStart = document.getElementById('start-btn');
const audioGameOver = document.getElementById('bgm-gameover');
const audioBgm = document.getElementById('bgm-music');
audioBgm.volume = 0.5;
audioGameOver.volume = 0.7;

const bgVideo = document.getElementById('bg-video');

// Game State
let isPlaying = false;
let startTime = 0;
let lastTime = 0;
let distance = 0;
let speed = 0;
const BASE_SPEED = 200;
const MAX_SPEED = 800;

// Visual Configuration
const VIDEO_WIDTH = 300;
const VIDEO_HEIGHT = 500;
const VIDEO_GAP = 400;
const NECK_LENGTH = 150; // Length of the stick

// Physics State (Inverted Pendulum Cart-Pole)
let angle = 0; // 0 is upright
let angularVelocity = 0;

// Tuning Constants
const GRAVITY = 15.0;     // Force pulling head down (Tipping)
const CART_POWER = 55.0;  // Strong recovery force
const DAMPING = 0.92;     // Air resistance
const MAX_ANGLE = Math.PI / 2; // 90 degrees = fallen

// Cart State
let cartX = 0;
let cartVelocity = 0;
const CART_SPEED_FACTOR = 1200;
const CART_FRICTION = 0.85;

// Input State
const keys = {
    ArrowLeft: false,
    ArrowRight: false
};

// Canvas Sizing
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (!isPlaying) {
        cartX = canvas.width * 0.5;
    }
}
window.addEventListener('resize', resize);
resize();

// Input Handling
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = false;
    }
});

// Game Loop
function update(timestamp) {
    if (!isPlaying) return;

    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // 1. Update Game Speed (Scrolling)
    const timeSinceStart = (timestamp - startTime) / 1000;
    speed = Math.min(BASE_SPEED + (timeSinceStart * 10), MAX_SPEED);
    distance += speed * dt;
    uiScore.innerText = `${Math.floor(distance / 100)} m`;

    // 2. Cart Physics (Visual Position)
    let dirInput = 0;
    if (keys.ArrowLeft) dirInput = -1;
    if (keys.ArrowRight) dirInput = 1;

    // Move Cart
    cartVelocity += dirInput * CART_SPEED_FACTOR * dt;
    cartVelocity *= Math.pow(CART_FRICTION, dt * 60);
    cartX += cartVelocity * dt;

    // Clamp Cart
    const edgeMargin = 50;
    if (cartX < edgeMargin) {
        cartX = edgeMargin;
        cartVelocity = 0;
    } else if (cartX > canvas.width - edgeMargin) {
        cartX = canvas.width - edgeMargin;
        cartVelocity = 0;
    }

    // 3. Pendulum Physics (Torque Balance)
    // Difficulty Progression: Every 10m (1000px), increase difficulty
    const level = Math.floor(distance / 1000); // 0, 1, 2...

    // Dynamic Physics Parameters
    // Gravity increases by 2.0 per level (Harder to keep upright)
    const effectiveGravity = GRAVITY + (level * 2.0);
    // Noise increases by 3.0 per level (More chaotic wind)
    const noiseRange = 8.0 + (level * 3.0);

    const gravityTorque = Math.sin(angle) * effectiveGravity;
    const inertiaTorque = -dirInput * CART_POWER;

    // Wind/Instability
    const noise = (Math.random() - 0.5) * noiseRange;

    // Total Angular Acceleration
    const angularAccel = gravityTorque + inertiaTorque + noise;

    // Update Angle
    angularVelocity += angularAccel * dt;
    angularVelocity *= Math.pow(DAMPING, dt * 60);
    angle += angularVelocity * dt;

    // 4. Check Game Over
    if (Math.abs(angle) > MAX_ANGLE) {
        gameOver();
        return;
    }

    draw();
    requestAnimationFrame(update);
}

// Drawing
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Background (Scrolling Floor) ---
    const floorY = canvas.height * 0.9; // 0.8 -> 0.9 (Thinner floor)

    // Draw Sky
    const gradient = ctx.createLinearGradient(0, 0, 0, floorY);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F7FA');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, floorY);

    // Background Video
    if (bgVideo.readyState >= 2) {
        const vW = VIDEO_WIDTH;
        const vH = VIDEO_HEIGHT;
        const spacing = vW + VIDEO_GAP;
        const scrollOffset = -(distance % spacing);
        const drawY = floorY - vH;

        for (let x = scrollOffset - spacing; x < canvas.width + spacing; x += spacing) {
            if (x + vW > 0 && x < canvas.width) {
                ctx.fillStyle = '#5D4037';
                ctx.fillRect(x + vW / 2 - 10, drawY + vH, 20, canvas.height - (drawY + vH));
                ctx.fillStyle = '#3E2723';
                ctx.fillRect(x - 10, drawY - 10, vW + 20, vH + 20);
                ctx.drawImage(bgVideo, x, drawY, vW, vH);
            }
        }
    }

    // Draw Floor
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(0, floorY, canvas.width, canvas.height - floorY);

    // Draw Stripes
    const stripeWidth = 50;
    const offset = -(distance % (stripeWidth * 2));
    ctx.fillStyle = '#6D4C41';
    for (let x = offset; x < canvas.width; x += stripeWidth * 2) {
        ctx.beginPath();
        ctx.moveTo(x, floorY);
        ctx.lineTo(x + stripeWidth, floorY);
        ctx.lineTo(x + stripeWidth - 20, canvas.height);
        ctx.lineTo(x - 20, canvas.height);
        ctx.fill();
    }

    // --- Draw Entities ---
    const scale = 0.8;
    const faceScale = 0.5;

    if (cartImg.complete && faceImg.complete) {
        const cW = cartImg.width * scale;
        const cH = cartImg.height * scale;
        const cX = cartX - cW / 2;
        const cY = floorY - cH + 10;

        // Pivot Point (Center of Cart Top)
        const pivotX = cartX;
        const pivotY = cY + 40; // Moved down deeper into the cart

        // Draw Logic: 
        // 1. Prepare to Draw Neck & Face
        ctx.save();
        ctx.translate(pivotX, pivotY); // Move to pivot
        ctx.rotate(angle); // Rotate pendulum

        // 2. Draw Neck (Black Stick)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -NECK_LENGTH);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 3. Draw Plate (White Dish under Face)
        ctx.beginPath();
        // Draw an ellipse at the top of the neck
        // Ellipse center: (0, -NECK_LENGTH)
        ctx.ellipse(0, -NECK_LENGTH, 40, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF';
        ctx.fill();
        ctx.strokeStyle = '#CCC';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 4. Draw Face (On top of Plate)
        const fW = faceImg.width * faceScale;
        const fH = faceImg.height * faceScale;
        // Face sits on the plate (at -NECK_LENGTH)
        ctx.drawImage(faceImg, -fW / 2, -NECK_LENGTH - fH + 10, fW, fH);

        ctx.restore();

        // 5. Draw Cart Last (Front) - Covers the base of the neck
        ctx.drawImage(cartImg, cX, cY, cW, cH);
    }
}

// Controls
function startGame() {
    isPlaying = true;
    distance = 0;
    speed = BASE_SPEED;

    cartX = canvas.width * 0.5;
    cartVelocity = 0;

    angle = (Math.random() - 0.5) * 0.2;
    angularVelocity = 0;

    audioGameOver.pause();
    audioGameOver.currentTime = 0;

    bgVideo.play().catch(e => console.log('Video play failed', e));

    // Play BGM if not already playing
    if (audioBgm.paused) {
        audioBgm.play().catch(e => console.log('BGM play failed', e));
    }

    startTime = performance.now();
    lastTime = startTime;

    uiStartScreen.classList.add('hidden');
    uiGameOver.classList.add('hidden');

    resize();
    requestAnimationFrame(update);
}

function gameOver() {
    isPlaying = false;
    uiFinalScore.innerText = Math.floor(distance / 100);
    uiGameOver.classList.remove('hidden');

    audioGameOver.currentTime = 0.5;
    audioGameOver.play().catch(e => console.log('Audio play failed:', e));

    draw();
}

btnStart.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);

cartImg.onload = () => { if (!isPlaying) draw(); };
faceImg.onload = () => { if (!isPlaying) draw(); };
