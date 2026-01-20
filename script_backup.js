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

// Ball on Plate Physics
const PLATE_WIDTH = 250;
let ballOffset = 0;
let ballVelocity = 0;
let ballAngle = 0;
let ballDropY = 0;       // Vertical drop distance
let ballDropVelocity = 0; // Vertical drop speed

const DAMPING = 0.99;    // Slight friction for the ball
// const GRAVITY_SLOPE = 0; // Flat plate, so no gravity slope bias initially

// Cart State
let cartX = 0;
let cartVelocity = 0;
const CART_ACCEL = 2500; // How fast the cart accelerates
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

    const dt = (timestamp - lastTime) / 1000; // delta time in seconds
    lastTime = timestamp;

    // 1. Update Game Speed (Scrolling)
    const timeSinceStart = (timestamp - startTime) / 1000;
    speed = Math.min(BASE_SPEED + (timeSinceStart * 10), MAX_SPEED);
    distance += speed * dt;
    uiScore.innerText = `${Math.floor(distance / 100)} m`;

    // 2. Cart Physics (The Plate)
    let cartAccelInput = 0;
    if (keys.ArrowLeft) cartAccelInput -= CART_ACCEL;
    if (keys.ArrowRight) cartAccelInput += CART_ACCEL;

    cartVelocity += cartAccelInput * dt;
    cartVelocity *= Math.pow(CART_FRICTION, dt * 60);
    cartX += cartVelocity * dt;

    // Clamp Cart to Screen
    const edgeMargin = 50;
    if (cartX < edgeMargin) {
        cartX = edgeMargin;
        cartVelocity = 0;
    } else if (cartX > canvas.width - edgeMargin) {
        cartX = canvas.width - edgeMargin;
        cartVelocity = 0;
    }

    // 3. Ball Physics (The Face)
    // Only apply horizontal physics if NOT falling
    if (ballDropY <= 0) {
        // Accel: When cart speeds Right (+), Ball feels force Left (-)
        const inertiaForce = -cartAccelInput * 0.002;

        // Instability (Wind/Noise) + Convex Slope (Ball falls away from center)
        // ballOffset * 5.0 -> Stronger force pulling away from center as it moves out
        const slopeAccel = ballOffset * 5.0;
        const noise = (Math.random() - 0.5) * 10.0; // Stronger noise

        // Update Ball Velocity
        ballVelocity += (inertiaForce + slopeAccel + noise) * dt;
        ballVelocity *= Math.pow(DAMPING, dt * 60); // Friction rolling on plate

        // Update Ball Position (Offset from center)
        ballOffset += ballVelocity * dt;

        // Update Ball Rotation (Visual only)
        // angle change = distance moved / radius
        // Assuming ball radius approx 40px (scaled down face)
        const ballRadius = 40;
        ballAngle += (ballVelocity * dt) / ballRadius;
    }

    // 4. Falling & Game Over Logic
    const isOffPlate = Math.abs(ballOffset) > PLATE_WIDTH / 2;

    if (isOffPlate) {
        // Apply Gravity for Falling
        ballDropVelocity += 1000 * dt; // Strong gravity
        ballDropY += ballDropVelocity * dt;

        // Horizontal momentum continues
        ballOffset += ballVelocity * dt;
        ballAngle += (ballVelocity * dt) / 40;
    }

    // Game Over if it falls deep enough (e.g. past the floor)
    // Floor is roughly at canvas.height * 0.8. Let's say +200px drop.
    if (ballDropY > 200) {
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
    const floorY = canvas.height * 0.8;

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
                // Pole
                ctx.fillStyle = '#5D4037';
                ctx.fillRect(x + vW / 2 - 10, drawY + vH, 20, canvas.height - (drawY + vH));
                // Frame
                ctx.fillStyle = '#3E2723';
                ctx.fillRect(x - 10, drawY - 10, vW + 20, vH + 20);
                // Video
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
    const faceScale = 0.35; // Reduced from 0.5 to match cart size better

    if (cartImg.complete && faceImg.complete) {
        // Draw Cart (Plate)
        const cW = cartImg.width * scale;
        const cH = cartImg.height * scale;
        const cX = cartX - cW / 2;
        const cY = floorY - cH + 10;

        // Draw Cart First
        ctx.drawImage(cartImg, cX, cY, cW, cH);

        // Draw Face (Ball) on top of Cart
        const fW = faceImg.width * faceScale;
        const fH = faceImg.height * faceScale;

        // Ball Position: Cart Center + Offset
        // Y position: Sitting on top of cart (approx cY)
        // Let's assume the cart top is flat around 20px from top
        const ballX = cartX + ballOffset;
        const ballY = (cY - fH / 2 + 30) + ballDropY; // Add Falling Offset

        ctx.save();
        ctx.translate(ballX, ballY);
        ctx.rotate(ballAngle);

        // Draw centered on pivot
        ctx.drawImage(faceImg, -fW / 2, -fH / 2, fW, fH);
        ctx.restore();
    }
}

// Controls
function startGame() {
    isPlaying = true;
    distance = 0;
    speed = BASE_SPEED;

    // Reset Physics
    cartX = canvas.width * 0.5;
    cartVelocity = 0;

    ballOffset = 0;
    // Initial Kick: Ball starts rolling randomly!
    ballVelocity = (Math.random() - 0.5) * 100; // Strong start push
    ballAngle = 0;

    // Reset Fall State
    ballDropY = 0;
    ballDropVelocity = 0;

    // Audio Reset
    audioGameOver.pause();
    audioGameOver.currentTime = 0;

    // Video Play
    bgVideo.play().catch(e => console.log('Video play failed', e));

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

    // Play audio from 0.5s
    audioGameOver.currentTime = 0.5;
    audioGameOver.play().catch(e => console.log('Audio play failed:', e));

    draw();
}

btnStart.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);

cartImg.onload = () => { if (!isPlaying) draw(); };
faceImg.onload = () => { if (!isPlaying) draw(); };
