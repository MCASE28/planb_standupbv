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

// Game State
let isPlaying = false;
let startTime = 0;
let lastTime = 0;
let distance = 0;
let speed = 0;
const BASE_SPEED = 200; // pixels per second
const MAX_SPEED = 800;

// Physics State
let angle = 0; // radians
let angularVelocity = 0; // radians per second
const GRAVITY = 25.0; // Much stronger gravity (was 4.0)
const BALANCE_FORCE = 80.0; // Much stronger input (was 8.0)
const DAMPING = 0.92; // Less damping for more swing
const MAX_ANGLE = Math.PI / 2.5; // ~72 degrees, failure threshold

// Input State
const keys = {
    ArrowLeft: false,
    ArrowRight: false
};

// Canvas Sizing
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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

    // 1. Update Speed & Distance
    // Speed increases slowly over time
    const timeSinceStart = (timestamp - startTime) / 1000;
    speed = Math.min(BASE_SPEED + (timeSinceStart * 10), MAX_SPEED);

    distance += speed * dt;
    uiScore.innerText = `${Math.floor(distance / 100)} m`;

    // 2. Physics (Inverted Pendulumish)
    // Gravity pulls the face down (increases angle deviation)
    const gravityTorque = Math.sin(angle) * GRAVITY;

    // Random "Wind" / Noise to create instability
    // Random force, changing every frame
    const noise = (Math.random() - 0.5) * 20.0; // Stronger noise (was 2.0)

    // Input torque (to correct balance)
    let inputTorque = 0;
    if (keys.ArrowLeft) inputTorque -= BALANCE_FORCE; // Tilt left
    if (keys.ArrowRight) inputTorque += BALANCE_FORCE; // Tilt right

    // Note: If you press Right, you want to push the "head" right? 
    // Usually in these games:
    // Face Falling Right -> Press Left to move Cart Left (balancing)? 
    // OR Press Left to push Face Left?
    // Requirement says: "face.png가 앞뒤로 쏠리는걸 좌/우 방향키로 균형을 잡으면서"
    // Let's implement intuitive controls: Press Left -> Face tilts Left (counter-clockwise).

    // Update angular velocity
    // Add noise to the equation
    angularVelocity += (gravityTorque + inputTorque + noise) * dt;
    angularVelocity *= Math.pow(DAMPING, dt * 60); // Damping relative to 60fps

    // Update angle
    angle += angularVelocity * dt;

    // 3. Check Game Over
    if (Math.abs(angle) > MAX_ANGLE) {
        gameOver();
        return;
    }

    draw();
    requestAnimationFrame(update);
}

// Drawing
function draw() {
    // Clear screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Background (Scrolling Floor) ---
    const floorY = canvas.height * 0.8;

    // Draw Sky/Background
    // We can draw some passing clouds or just simple gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, floorY);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F7FA');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, floorY);

    // Draw Floor
    ctx.fillStyle = '#8D6E63'; // Brownish ground
    ctx.fillRect(0, floorY, canvas.width, canvas.height - floorY);

    // Draw Scrolling Pattern (Stripes on floor)
    const stripeWidth = 50;
    const offset = -(distance % (stripeWidth * 2));

    ctx.fillStyle = '#6D4C41'; // Darker brown for stripes
    for (let x = offset; x < canvas.width; x += stripeWidth * 2) {
        // Skewing the stripes for perspective effect
        ctx.beginPath();
        ctx.moveTo(x, floorY);
        ctx.lineTo(x + stripeWidth, floorY);
        ctx.lineTo(x + stripeWidth - 20, canvas.height); // Slant left
        ctx.lineTo(x - 20, canvas.height);
        ctx.fill();
    }

    // --- Draw Entities ---
    // Position: Fixed X (left side), Fixed Y (on floor)
    const cartX = canvas.width * 0.2; // 20% from left
    const scale = 0.8; // Scale factor for images

    // Cart
    // Draw cart centered horizontally at cartX, bottom at floorY
    if (cartImg.complete) {
        const cW = cartImg.width * scale;
        const cH = cartImg.height * scale;
        const cX = cartX - cW / 2;
        const cY = floorY - cH + 10; // +10 to sink slightly into ground
        ctx.drawImage(cartImg, cX, cY, cW, cH);

        // Face
        // Pivots around the top-center of the Cart
        // Let's assume the "neck" is roughly top center of cart
        const pivotX = cartX;
        const pivotY = cY + 20; // Slightly down from top of cart

        if (faceImg.complete) {
            const fW = faceImg.width * scale;
            const fH = faceImg.height * scale;

            ctx.save();
            ctx.translate(pivotX, pivotY);
            ctx.rotate(angle);
            // Draw face such that its bottom-center is at the pivot
            // Adjust depending on where the "neck" of the face is. 
            // Usually bottom center of face.png
            ctx.drawImage(faceImg, -fW / 2, -fH + 20, fW, fH); // +20 overlap with cart
            ctx.restore();
        }
    }
}

// Controls
function startGame() {
    isPlaying = true;
    distance = 0;
    speed = BASE_SPEED;

    // Initial Instability: Start with a slight random tilt or push
    // Random angle between -0.1 and 0.1 radians -> Increased to +/- 0.5
    angle = (Math.random() - 0.5) * 0.5;
    angularVelocity = 0;

    startTime = performance.now();
    lastTime = startTime;

    uiStartScreen.classList.add('hidden');
    uiGameOver.classList.add('hidden');

    resize(); // Ensure size is correct
    requestAnimationFrame(update);
}

function gameOver() {
    isPlaying = false;
    uiFinalScore.innerText = Math.floor(distance / 100);
    uiGameOver.classList.remove('hidden');
    draw(); // Draw one last frame with the fallen angle
}

// Event Listeners
btnStart.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);

// Initial Draw (Waiting screen)
cartImg.onload = () => {
    if (!isPlaying) draw();
};
faceImg.onload = () => {
    if (!isPlaying) draw();
};
