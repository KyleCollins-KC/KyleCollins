document.addEventListener('DOMContentLoaded', () => {
    const circle = document.getElementById('orbiting-circle');
    const trailContainer = document.getElementById('trail-container');
    const particleContainer = document.getElementById('particle-container');
    const body = document.body;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    const circleSize = 80;

    // --- Animation, Trail, Ripple, and Particle Constants ---
    const INITIAL_MOVEMENT_SPEED_PIXELS_PER_FRAME = 7;
    const ORBIT_SHRINK_SPEED = 0.7; // How fast the orbit radius decreases per frame
    const ORBIT_SPEED_AT_START_RADIUS = 8;
    const ORBIT_SPEED_NEAR_CENTER = 10;
    const INITIAL_OFFSCREEN_X_OFFSET = -150;
    const INITIAL_OFFSCREEN_Y_OFFSET = 100;
    const TARGET_ONSCREEN_ENTRY_MARGIN = 50;
    const ORBIT_INITIAL_RADIUS_FACTOR = 0.35;
    const ORBIT_INITIAL_ANGLE = Math.PI * 1.5;
    const ORBIT_ARRIVAL_THRESHOLD = 10;

    // --- NEW SNAKE EFFECT CONSTANTS ---
    const SNAKE_EFFECT_ENABLED = true;
    const SNAKE_AMPLITUDE = 2;        // Max deviation in pixels from the central path (half the peak-to-peak wiggle)
    const SNAKE_WAVELENGTH_PIXELS = 360; // Approx. distance traveled along the path for one full sine wave cycle
    // --- END NEW SNAKE EFFECT CONSTANTS ---

    const TRAIL_CREATION_INTERVAL_FRAMES = 1;
    const TRAIL_SEGMENT_SIZE_FACTOR = 0.9;
    const TRAIL_SEGMENT_INITIAL_OPACITY = 0.4;
    const TRAIL_SEGMENT_FADE_DURATION = 1500;

    // ... (Ripple and Particle Constants remain the same) ...
    const NUM_RIPPLE_RINGS = 3;
    const RIPPLE_RING_DELAY = 750;
    const RIPPLE_RING_DURATION = 2000;
    const RIPPLE_MAX_SCALE = 50;
    const RIPPLE_INITIAL_OPACITY = 0.7;
    const RIPPLE_SCALER_BASE_SIZE = 20;

    const PARTICLES_PER_SPAWN_FROM_RING = 4;
    const RING_PARTICLE_SPAWN_INTERVAL_MS = 150;
    const RING_PARTICLE_BASE_SIZE_MIN = 4;
    const RING_PARTICLE_BASE_SIZE_MAX = 8;
    const RING_PARTICLE_INITIAL_VELOCITY_MAGNITUDE = 1.5;
    const RING_PARTICLE_FLOAT_SPEED_MAX = 5;
    const RING_PARTICLE_LIFESPAN_MS = 0;
    const PARTICLE_BASE_OPACITY = 0.8;
    const PARTICLE_RANDOM_WALK_STRENGTH = 0.25;
    const PARTICLE_TWINKLE_CHANCE_PER_FRAME = 0.01;
    const PARTICLE_TWINKLE_DURATION_MIN_MS = 200;
    const PARTICLE_TWINKLE_DURATION_MAX_MS = 600;
    const PARTICLE_TWINKLE_OPACITY_MIN = 0.2;
    const PARTICLE_TWINKLE_OPACITY_MAX = 1.0;
    const PARTICLE_SIZE_ANIMATION_ENABLED = true;
    const PARTICLE_SIZE_PULSE_SPEED = 0.05;
    const PARTICLE_SIZE_PULSE_MAGNITUDE = 0.9;
    const MOUSE_REPULSION_RADIUS = 100;
    const MOUSE_REPULSION_STRENGTH = 4;

    // --- State Variables ---
    let currentX, currentY;
    let currentPhase = 'INITIALIZING';
    let currentGlobalRadius;
    let currentGlobalAngle;
    let frameCount = 0;
    let initialOrbitRadiusForSpeedCalc;
    let targetEntryScreenX, targetEntryScreenY;
    let targetOrbitStartX, targetOrbitStartY;
    let activeFloatingParticles = [];
    let mouseX = -1000;
    let mouseY = -1000;
    let mouseHasMoved = false;

    // --- NEW SNAKE EFFECT STATE VARIABLE ---
    let snakePhase = 0; // Current phase of the sine wave for the snake effect
    // --- END NEW SNAKE EFFECT STATE VARIABLE ---

    document.addEventListener('mousemove', (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;
        mouseHasMoved = true;
    });
    document.addEventListener('mouseleave', () => {
        mouseX = -1000;
        mouseY = -1000;
    });

    function initializeAnimation() {
        currentX = INITIAL_OFFSCREEN_X_OFFSET;
        currentY = screenHeight + INITIAL_OFFSCREEN_Y_OFFSET - circleSize / 2;
        circle.style.left = `${currentX}px`;
        circle.style.top = `${currentY}px`;
        targetEntryScreenX = TARGET_ONSCREEN_ENTRY_MARGIN;
        targetEntryScreenY = screenHeight - TARGET_ONSCREEN_ENTRY_MARGIN - circleSize;
        initialOrbitRadiusForSpeedCalc = Math.min(screenWidth, screenHeight) * ORBIT_INITIAL_RADIUS_FACTOR;
        targetOrbitStartX = centerX + Math.cos(ORBIT_INITIAL_ANGLE) * initialOrbitRadiusForSpeedCalc - circleSize / 2;
        targetOrbitStartY = centerY + Math.sin(ORBIT_INITIAL_ANGLE) * initialOrbitRadiusForSpeedCalc - circleSize / 2;

        snakePhase = 0; // Reset snake phase

        setTimeout(() => {
            circle.style.opacity = '1';
            currentPhase = 'ENTERING_SCREEN';
            requestAnimationFrame(animateCircle);
            requestAnimationFrame(animateFloatingParticles);
        }, 50);
    }

    // MODIFIED moveTowards to include snake effect
    function moveTowards(targetX, targetY, speed) {
        const prevX = currentX; // Position before this movement step (center of snake path)
        const prevY = currentY; // Position before this movement step (center of snake path)

        const dx = targetX - currentX; // Vector from current snake-center to target
        const dy = targetY - currentY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let reachedTarget = false;
        let nextCenterX, nextCenterY; // The new center of the snake path

        if (distance <= speed) {
            nextCenterX = targetX;
            nextCenterY = targetY;
            reachedTarget = true;
        } else {
            nextCenterX = currentX + (dx / distance) * speed;
            nextCenterY = currentY + (dy / distance) * speed;
        }

        // Calculate actual movement along the center path for this frame
        const movedDx = nextCenterX - prevX;
        const movedDy = nextCenterY - prevY;
        const movedMagnitude = Math.sqrt(movedDx * movedDx + movedDy * movedDy);

        currentX = nextCenterX; // Update currentX/Y to the new center of the path
        currentY = nextCenterY;

        if (SNAKE_EFFECT_ENABLED && movedMagnitude > 0.01 && !reachedTarget) {
            const normMovedDx = movedDx / movedMagnitude;
            const normMovedDy = movedDy / movedMagnitude;

            // Perpendicular vector for snake offset
            const perpDx = -normMovedDy;
            const perpDy = normMovedDx;

            const snakeOffsetValue = SNAKE_AMPLITUDE * Math.sin(snakePhase);

            // Apply the snake offset to the current position (which is the center of the path)
            currentX += perpDx * snakeOffsetValue;
            currentY += perpDy * snakeOffsetValue;

            // Increment snakePhase based on distance traveled along the primary path
            snakePhase += (Math.PI * 2 / SNAKE_WAVELENGTH_PIXELS) * movedMagnitude;
            snakePhase %= (Math.PI * 2); // Keep phase within 0-2PI
        }
        return reachedTarget;
    }

    function createTrailSegment() {
        const segment = document.createElement('div');
        segment.classList.add('trail-segment');
        const segmentSize = circleSize * TRAIL_SEGMENT_SIZE_FACTOR;
        segment.style.width = `${segmentSize}px`;
        segment.style.height = `${segmentSize}px`;
        // Trail follows the actual (snaked) position of the circle's top-left
        const segmentX = currentX + (circleSize / 2) - (segmentSize / 2);
        const segmentY = currentY + (circleSize / 2) - (segmentSize / 2);
        segment.style.left = `${segmentX}px`;
        segment.style.top = `${segmentY}px`;
        segment.style.opacity = TRAIL_SEGMENT_INITIAL_OPACITY.toString();
        trailContainer.appendChild(segment);
        segment.animate([
            { opacity: TRAIL_SEGMENT_INITIAL_OPACITY, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0.2)' }
        ], { duration: TRAIL_SEGMENT_FADE_DURATION, easing: 'ease-out', fill: 'forwards' });
        setTimeout(() => segment.remove(), TRAIL_SEGMENT_FADE_DURATION);
    }

    // MODIFIED animateCircle for snake effect in ORBITING phase
    function animateCircle() {
        frameCount++;
        if (currentPhase !== 'INITIALIZING' && (frameCount % TRAIL_CREATION_INTERVAL_FRAMES === 0)) {
            createTrailSegment();
        }
        switch (currentPhase) {
            case 'ENTERING_SCREEN':
                if (moveTowards(targetEntryScreenX, targetEntryScreenY, INITIAL_MOVEMENT_SPEED_PIXELS_PER_FRAME)) {
                    currentPhase = 'APPROACHING_ORBIT_START';
                }
                break;
            case 'APPROACHING_ORBIT_START':
                if (moveTowards(targetOrbitStartX, targetOrbitStartY, INITIAL_MOVEMENT_SPEED_PIXELS_PER_FRAME)) {
                    currentPhase = 'ORBITING';
                    currentGlobalRadius = initialOrbitRadiusForSpeedCalc;
                    currentGlobalAngle = ORBIT_INITIAL_ANGLE;
                }
                break;
            case 'ORBITING':
                if (currentGlobalRadius <= ORBIT_ARRIVAL_THRESHOLD) {
                    circleReachedCenter();
                    return;
                }
                // --- Standard orbit calculations (radius, angle, speed) ---
                let normalizedProgress = 0;
                if (initialOrbitRadiusForSpeedCalc - ORBIT_ARRIVAL_THRESHOLD > 0) {
                    normalizedProgress = (initialOrbitRadiusForSpeedCalc - currentGlobalRadius) /
                                         (initialOrbitRadiusForSpeedCalc - ORBIT_ARRIVAL_THRESHOLD);
                }
                normalizedProgress = Math.max(0, Math.min(1, normalizedProgress));
                const currentTargetOrbitSpeed = ORBIT_SPEED_AT_START_RADIUS +
                                               (ORBIT_SPEED_NEAR_CENTER - ORBIT_SPEED_AT_START_RADIUS) * normalizedProgress;
                let effectiveTangentialSpeedInOrbit;
                if (currentTargetOrbitSpeed <= ORBIT_SHRINK_SPEED) {
                    effectiveTangentialSpeedInOrbit = 0.1;
                } else {
                    effectiveTangentialSpeedInOrbit = Math.sqrt(
                        Math.pow(currentTargetOrbitSpeed, 2) - Math.pow(ORBIT_SHRINK_SPEED, 2)
                    );
                }

                const prevRadius = currentGlobalRadius; // For calculating distance moved
                const prevAngle = currentGlobalAngle;

                currentGlobalRadius -= ORBIT_SHRINK_SPEED;
                if (currentGlobalRadius < ORBIT_ARRIVAL_THRESHOLD) currentGlobalRadius = ORBIT_ARRIVAL_THRESHOLD;

                let currentAngularSpeed = 0;
                if (currentGlobalRadius > 0 && effectiveTangentialSpeedInOrbit > 0) {
                    currentAngularSpeed = effectiveTangentialSpeedInOrbit / currentGlobalRadius;
                }
                currentGlobalAngle += currentAngularSpeed;
                // --- End standard orbit calculations ---

                // Calculate the base position on the spiral (center of the snake path)
                let spiralCenterX = centerX + Math.cos(currentGlobalAngle) * currentGlobalRadius;
                let spiralCenterY = centerY + Math.sin(currentGlobalAngle) * currentGlobalRadius;

                // This is the top-left for the element, which is the path we'll apply snake to
                let pathTopLeftX = spiralCenterX - circleSize / 2;
                let pathTopLeftY = spiralCenterY - circleSize / 2;

                if (SNAKE_EFFECT_ENABLED) {
                    // Calculate instantaneous velocity vector of the spiral's center
                    // dR/dt = -ORBIT_SHRINK_SPEED
                    // dA/dt = currentAngularSpeed
                    // vx = dR/dt * cosA - R*sinA*dA/dt
                    // vy = dR/dt * sinA + R*cosA*dA/dt
                    const cosA = Math.cos(currentGlobalAngle);
                    const sinA = Math.sin(currentGlobalAngle);

                    const velX = -ORBIT_SHRINK_SPEED * cosA - currentGlobalRadius * currentAngularSpeed * sinA;
                    const velY = -ORBIT_SHRINK_SPEED * sinA + currentGlobalRadius * currentAngularSpeed * cosA;
                    const velMagnitude = Math.sqrt(velX * velX + velY * velY);

                    if (velMagnitude > 0.01) {
                        const normVelX = velX / velMagnitude;
                        const normVelY = velY / velMagnitude;

                        // Perpendicular vector to the direction of motion for the snake offset
                        const perpDx = -normVelY;
                        const perpDy = normVelX;

                        const snakeOffsetValue = SNAKE_AMPLITUDE * Math.sin(snakePhase);

                        currentX = pathTopLeftX + perpDx * snakeOffsetValue;
                        currentY = pathTopLeftY + perpDy * snakeOffsetValue;

                        // Increment snakePhase based on distance traveled along the spiral
                        snakePhase += (Math.PI * 2 / SNAKE_WAVELENGTH_PIXELS) * velMagnitude;
                        snakePhase %= (Math.PI * 2);
                    } else {
                        // Not moving much, just stay on the spiral path without snake offset
                        currentX = pathTopLeftX;
                        currentY = pathTopLeftY;
                        // Optionally, could add a tiny fixed phase increment here if it should wiggle in place
                        // snakePhase += 0.05; snakePhase %= (Math.PI * 2);
                    }
                } else {
                    currentX = pathTopLeftX;
                    currentY = pathTopLeftY;
                }
                break;
            default: console.error("Unknown animation phase:", currentPhase); return;
        }
        circle.style.left = `${currentX}px`;
        circle.style.top = `${currentY}px`;
        requestAnimationFrame(animateCircle);
    }


    function circleReachedCenter() {
        circle.style.opacity = '0';
        setTimeout(() => circle.style.display = 'none', 500);
        createExpandingRippleEffect();
        const headerNav = document.querySelector('#header nav');
        if (headerNav) {
            setTimeout(() => {
                headerNav.classList.add('fade-in-nav');
            }, 500);
        }
    }

    function createExpandingRippleEffect() { /* ... (no changes) ... */
        for (let i = 0; i < NUM_RIPPLE_RINGS; i++) {
            setTimeout(() => {
                const scaler = document.createElement('div');
                scaler.classList.add('expanding-ripple-scaler');
                const ringVisual = document.createElement('div');
                ringVisual.classList.add('ring-visual');
                scaler.appendChild(ringVisual);
                scaler.style.left = `${centerX - (RIPPLE_SCALER_BASE_SIZE / 2)}px`;
                scaler.style.top = `${centerY - (RIPPLE_SCALER_BASE_SIZE / 2)}px`;
                body.appendChild(scaler);

                const ringAnimation = scaler.animate([
                    { transform: 'scale(0)', opacity: RIPPLE_INITIAL_OPACITY },
                    { transform: `scale(${RIPPLE_MAX_SCALE})`, opacity: 0 }
                ], {
                    duration: RIPPLE_RING_DURATION,
                    easing: 'ease-out',
                    fill: 'forwards'
                });

                const particleSpawnerInterval = setInterval(() => {
                    if (!scaler.parentElement) {
                        clearInterval(particleSpawnerInterval);
                        return;
                    }
                    const computedStyle = getComputedStyle(scaler);
                    const matrix = new DOMMatrix(computedStyle.transform);
                    const currentScale = matrix.a;

                    if (currentScale > 0.1 && parseFloat(computedStyle.opacity) > 0.05) {
                        const ringCurrentRadius = (RIPPLE_SCALER_BASE_SIZE / 2) * currentScale;
                        for (let k = 0; k < PARTICLES_PER_SPAWN_FROM_RING; k++) {
                            const angle = Math.random() * Math.PI * 2;
                            const spawnX = centerX + Math.cos(angle) * ringCurrentRadius;
                            const spawnY = centerY + Math.sin(angle) * ringCurrentRadius;
                            createAndLaunchParticle(spawnX, spawnY);
                        }
                    }
                }, RING_PARTICLE_SPAWN_INTERVAL_MS);

                ringAnimation.onfinish = () => {
                    clearInterval(particleSpawnerInterval);
                    scaler.remove();
                };

            }, i * RIPPLE_RING_DELAY);
        }
    }

    function createAndLaunchParticle(spawnX, spawnY) { /* ... (no changes) ... */
        const particle = document.createElement('div');
        particle.classList.add('particle');

        const originalSize = Math.random() * (RING_PARTICLE_BASE_SIZE_MAX - RING_PARTICLE_BASE_SIZE_MIN) + RING_PARTICLE_BASE_SIZE_MIN;
        particle.style.width = `${originalSize}px`;
        particle.style.height = `${originalSize}px`;

        const purpleShades = ['#C000FF', '#A040FF', '#D080FF', '#8A2BE2', '#9370DB', '#9932CC'];
        particle.style.backgroundColor = purpleShades[Math.floor(Math.random() * purpleShades.length)];

        particle.style.left = `${spawnX - originalSize / 2}px`;
        particle.style.top = `${spawnY - originalSize / 2}px`;
        particle.style.opacity = PARTICLE_BASE_OPACITY.toString();
        particleContainer.appendChild(particle);

        const launchAngle = Math.random() * Math.PI * 2;
        const vx = Math.cos(launchAngle) * RING_PARTICLE_INITIAL_VELOCITY_MAGNITUDE;
        const vy = Math.sin(launchAngle) * RING_PARTICLE_INITIAL_VELOCITY_MAGNITUDE;

        activeFloatingParticles.push({
            element: particle,
            x: spawnX - originalSize / 2,
            y: spawnY - originalSize / 2,
            vx: vx,
            vy: vy,
            spawnTime: performance.now(),
            baseOpacity: PARTICLE_BASE_OPACITY,
            isTwinkling: false,
            twinkleEndTime: 0,
            originalSize: originalSize,
            sizePulsePhase: Math.random() * Math.PI * 2
        });

        if (RING_PARTICLE_LIFESPAN_MS > 0) {
            setTimeout(() => {
                particle.style.transition = 'opacity 0.5s ease-out';
                particle.style.opacity = '0';
                setTimeout(() => {
                    if (particle.parentElement) particle.remove();
                    activeFloatingParticles = activeFloatingParticles.filter(p => p.element !== particle);
                }, 500);
            }, RING_PARTICLE_LIFESPAN_MS);
        }
    }

    function animateFloatingParticles() { /* ... (no changes) ... */
        const now = performance.now();

        activeFloatingParticles = activeFloatingParticles.filter(p => {
            if (!p.element.parentElement) return false;

            if (p.isTwinkling) {
                if (now >= p.twinkleEndTime) {
                    p.isTwinkling = false;
                    p.element.style.opacity = p.baseOpacity.toString();
                }
            } else {
                if (Math.random() < PARTICLE_TWINKLE_CHANCE_PER_FRAME) {
                    p.isTwinkling = true;
                    const duration = Math.random() *
                                     (PARTICLE_TWINKLE_DURATION_MAX_MS - PARTICLE_TWINKLE_DURATION_MIN_MS) +
                                     PARTICLE_TWINKLE_DURATION_MIN_MS;
                    p.twinkleEndTime = now + duration;
                    const twinkleTargetOpacity = Math.random() *
                                                 (PARTICLE_TWINKLE_OPACITY_MAX - PARTICLE_TWINKLE_OPACITY_MIN) +
                                                 PARTICLE_TWINKLE_OPACITY_MIN;
                    p.element.style.opacity = twinkleTargetOpacity.toString();
                }
            }

            if (mouseHasMoved) {
                const particleSize = p.element.offsetWidth;
                const particleCenterX = p.x + particleSize / 2;
                const particleCenterY = p.y + particleSize / 2;
                const dxMouse = particleCenterX - mouseX;
                const dyMouse = particleCenterY - mouseY;
                const distanceMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

                if (distanceMouse < MOUSE_REPULSION_RADIUS && distanceMouse > 0) {
                    const forceDirectionX = dxMouse / distanceMouse;
                    const forceDirectionY = dyMouse / distanceMouse;
                    const repulsionForce = MOUSE_REPULSION_STRENGTH * (1 - distanceMouse / MOUSE_REPULSION_RADIUS);
                    p.vx += forceDirectionX * repulsionForce;
                    p.vy += forceDirectionY * repulsionForce;
                }
            }

            p.x += p.vx;
            p.y += p.vy;

            if (PARTICLE_SIZE_ANIMATION_ENABLED) {
                p.sizePulsePhase += PARTICLE_SIZE_PULSE_SPEED;
                const sinValue = Math.sin(p.sizePulsePhase);
                // Ensure scaleFactor does not make size negative or too small, adjust pulse magnitude if needed
                const scaleFactor = 1 - (PARTICLE_SIZE_PULSE_MAGNITUDE * ( (Math.sin(p.sizePulsePhase) + 1) / 2 ) );
                const currentSize = Math.max(1, p.originalSize * scaleFactor); // Ensure size is at least 1px


                p.element.style.width = `${currentSize}px`;
                p.element.style.height = `${currentSize}px`;
                // Adjust position to keep center if size changes
                const sizeDifference = p.originalSize - currentSize;
                p.element.style.left = `${p.x + sizeDifference / 2}px`;
                p.element.style.top = `${p.y + sizeDifference / 2}px`;
            } else {
                if (parseFloat(p.element.style.width) !== p.originalSize) {
                    p.element.style.width = `${p.originalSize}px`;
                    p.element.style.height = `${p.originalSize}px`;
                    p.element.style.left = `${p.x}px`;
                    p.element.style.top = `${p.y}px`;
                } else { // Still need to update position if not animating size
                     p.element.style.left = `${p.x}px`;
                     p.element.style.top = `${p.y}px`;
                }
            }


            p.vx *= 0.99;
            p.vy *= 0.99;

            p.vx += (Math.random() - 0.5) * PARTICLE_RANDOM_WALK_STRENGTH;
            p.vy += (Math.random() - 0.5) * PARTICLE_RANDOM_WALK_STRENGTH;

            const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (currentSpeed > RING_PARTICLE_FLOAT_SPEED_MAX) {
                p.vx = (p.vx / currentSpeed) * RING_PARTICLE_FLOAT_SPEED_MAX;
                p.vy = (p.vy / currentSpeed) * RING_PARTICLE_FLOAT_SPEED_MAX;
            }

            const particleElSize = p.element.offsetWidth || p.originalSize; // Use originalSize if offsetWidth is 0 (not yet rendered)
            if (p.x < 0) {
                p.x = 0; p.vx *= -0.7;
            } else if (p.x > screenWidth - particleElSize) {
                p.x = screenWidth - particleElSize; p.vx *= -0.7;
            }
            if (p.y < 0) {
                p.y = 0; p.vy *= -0.7;
            } else if (p.y > screenHeight - particleElSize) {
                p.y = screenHeight - particleElSize; p.vy *= -0.7;
            }
            // This position update was potentially being overridden by the size animation block.
            // If size animation is off, or if it's on but we still need to set the base x,y
            // it's handled inside the PARTICLE_SIZE_ANIMATION_ENABLED block now.
            // If size animation is on, it sets left/top. If off, it sets left/top.
            // So this final p.element.style.left/top might be redundant if the logic above is complete.
            // For safety, let's keep it, or ensure the above block always sets it.
            // The logic inside PARTICLE_SIZE_ANIMATION_ENABLED block now correctly sets left/top.

            return true;
        });
        requestAnimationFrame(animateFloatingParticles);
    }

    initializeAnimation();
});
