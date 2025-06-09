document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const rosterList = document.getElementById('roster-list');
    const rosterSearch = document.getElementById('roster-search');
    const boat1Lineup = document.getElementById('boat1-lineup');
    const boat2Lineup = document.getElementById('boat2-lineup');
    const boat1Avg2kEl = document.getElementById('boat1-avg-2k');
    const boat2Avg2kEl = document.getElementById('boat2-avg-2k');
    const boat1AvgWeightEl = document.getElementById('boat1-avg-weight');
    const boat2AvgWeightEl = document.getElementById('boat2-avg-weight');
    const boat1AvgQualityEl = document.getElementById('boat1-avg-quality');
    const boat2AvgQualityEl = document.getElementById('boat2-avg-quality');
    const startRaceBtn = document.getElementById('start-race');
    const reraceBtn = document.getElementById('rerace-btn');
    const resetBoatsBtn = document.getElementById('reset-boats');
    const autofillBtn = document.getElementById('autofill-boats');
    const setLineupsBtn = document.getElementById('set-lineups-btn');
    const winnerMessageEl = document.getElementById('winner-message');
    const speedSlider = document.getElementById('speed-slider');
    const speedLabel = document.getElementById('speed-label');
    const windSlider = document.getElementById('wind-slider');
    const windLabel = document.getElementById('wind-label');
    const timerEl = document.getElementById('race-timer');
    const boat1RateEl = document.getElementById('boat1-rate');
    const boat1SplitEl = document.getElementById('boat1-split');
    const boat2RateEl = document.getElementById('boat2-rate');
    const boat2SplitEl = document.getElementById('boat2-split');
    const boat1DetailsEl = document.getElementById('boat1-details');
    const boat2DetailsEl = document.getElementById('boat2-details');
    const canvas = document.getElementById('race-canvas');
    const ctx = canvas.getContext('2d');

    // Game State
    let allRowers = [];
    let boat1Data = Array(8).fill(null);
    let boat2Data = Array(8).fill(null);
    let raceAnimationId;
    let raceSpeedMultiplier = 1;
    let windCondition = 0;
    let lastFrameTime = 0;
    let raceTime = 0;
    let boat1State = {};
    let boat2State = {};

    // --- INITIALIZATION ---
    fetch('rowers.json')
        .then(response => response.json())
        .then(data => {
            allRowers = data;
            initialize();
        });

    function initialize() {
        renderRosterList();
        setupBoatLineups();
        resetBoatStates();
        setCanvasSize();
        window.addEventListener('resize', setCanvasSize);
    }

    function setCanvasSize() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        drawInitialCanvas();
    }

    function resetBoatStates() {
        const initialRowerStats = Array(8).fill({
            name: 'Empty',
            watts: 0,
            quality: 0
        });
        boat1State = {
            distance: 0,
            phase: 'recovery',
            timeInPhase: 0,
            isFinished: false,
            finishTime: 0,
            strokeRate: 0,
            racePhase: 'start',
            strokeCount: 0,
            rowerStats: initialRowerStats,
            puddles: [],
            splashes: [],
            justCaught: false,
            animationStrokeTime: 0,
            powerModifier: 0
        };
        boat2State = {
            distance: 0,
            phase: 'recovery',
            timeInPhase: 0,
            isFinished: false,
            finishTime: 0,
            strokeRate: 0,
            racePhase: 'start',
            strokeCount: 0,
            rowerStats: initialRowerStats,
            puddles: [],
            splashes: [],
            justCaught: false,
            animationStrokeTime: 0,
            powerModifier: 0
        };
        updateRowerDetailsUI();
    }

    // --- SETUP AND RENDERING ---
    function renderRosterList(filter = '') {
        rosterList.innerHTML = '';
        const lowerCaseFilter = filter.toLowerCase();

        const filteredRowers = allRowers.filter(rower =>
            rower.name.toLowerCase().includes(lowerCaseFilter)
        );

        filteredRowers.forEach(rower => {
            const card = createRowerCard(rower);
            card.draggable = true;
            card.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', e.target.dataset.rowerName);
                setTimeout(() => e.target.classList.add('dragging'), 0);
            });
            card.addEventListener('dragend', e => {
                e.target.classList.remove('dragging');
            });
            rosterList.appendChild(card);
        });

        initializeTooltips();
    }

    function initializeTooltips() {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.forEach(el => new bootstrap.Tooltip(el, {
            html: true
        }));
    }

    function setupBoatLineups() {
        [boat1Lineup, boat2Lineup].forEach((lineupEl, boatIndex) => {
            lineupEl.innerHTML = '';
            const listGroup = document.createElement('ul');
            listGroup.className = 'list-group';
            const boatData = boatIndex === 0 ? boat1Data : boat2Data;
            for (let i = 0; i < 8; i++) {
                const seatNumber = 8 - i;
                let seatLabelText = (i === 0) ? `Stroke (${seatNumber})` : ((i === 7) ? `Bow (${seatNumber})` : `Seat ${seatNumber}`);
                const li = document.createElement('li');
                li.className = 'list-group-item seat d-flex justify-content-between align-items-center';
                li.dataset.boat = boatIndex + 1;
                li.dataset.seat = i;
                const labelSpan = document.createElement('span');
                labelSpan.textContent = seatLabelText;
                li.appendChild(labelSpan);
                const rower = boatData[i];
                if (rower) {
                    const card = createRowerCard(rower);
                    card.removeAttribute('data-bs-toggle');
                    li.appendChild(card);
                }
                listGroup.appendChild(li);
            }
            lineupEl.appendChild(listGroup);
        });

        const allSeats = document.querySelectorAll('.seat');
        allSeats.forEach(seat => addSeatListeners(seat));
        updateBoatHeaderStats();
    }

    function updateBoatHeaderStats() {
        // Boat 1
        const boat1Crew = boat1Data.filter(r => r !== null);
        if (boat1Crew.length > 0) {
            const avg2k = boat1Crew.reduce((sum, r) => sum + parseTimeToSeconds(r['2k']), 0) / boat1Crew.length;
            const avgWt = boat1Crew.reduce((sum, r) => sum + r.weight, 0) / boat1Crew.length;
            boat1Avg2kEl.textContent = `(Avg 2k: ${formatTime(avg2k)})`;
            boat1AvgWeightEl.textContent = `(Avg Wt: ${avgWt.toFixed(1)} lbs)`;
        } else {
            boat1Avg2kEl.textContent = '';
            boat1AvgWeightEl.textContent = '';
        }
        // Boat 2
        const boat2Crew = boat2Data.filter(r => r !== null);
        if (boat2Crew.length > 0) {
            const avg2k = boat2Crew.reduce((sum, r) => sum + parseTimeToSeconds(r['2k']), 0) / boat2Crew.length;
            const avgWt = boat2Crew.reduce((sum, r) => sum + r.weight, 0) / boat2Crew.length;
            boat2Avg2kEl.textContent = `(Avg 2k: ${formatTime(avg2k)})`;
            boat2AvgWeightEl.textContent = `(Avg Wt: ${avgWt.toFixed(1)} lbs)`;
        } else {
            boat2Avg2kEl.textContent = '';
            boat2AvgWeightEl.textContent = '';
        }
    }


    function createRowerCard(rower) {
        const card = document.createElement('div');
        card.className = 'roster-card';
        card.dataset.rowerName = rower.name;
        card.textContent = rower.name;
        card.setAttribute('data-bs-toggle', 'tooltip');
        card.setAttribute('data-bs-placement', 'right');
        const tooltipContent = `2k: ${rower['2k']} | Wt: ${rower.weight} lbs<br>Port Tech: ${rower.technique.port} ★<br>Starboard Tech: ${rower.technique.starboard} ★<br>Mentality: ${rower.mentality} ★<br>Following: ${rower.following} ★<br>Best Rate: ${rower.best_rate} spm`;
        card.setAttribute('data-bs-title', tooltipContent);
        return card;
    }

    // DRAG AND DROP & AUTOFILL
    function addSeatListeners(seat) {
        seat.addEventListener('dragover', e => {
            e.preventDefault();
            seat.classList.add('drag-over');
        });
        seat.addEventListener('dragleave', () => seat.classList.remove('drag-over'));
        seat.addEventListener('drop', e => {
            e.preventDefault();
            seat.classList.remove('drag-over');
            const rowerName = e.dataTransfer.getData('text/plain');
            const rower = allRowers.find(r => r.name === rowerName);
            if (!rower) return;
            const boatNum = parseInt(seat.dataset.boat);
            const seatIndex = parseInt(seat.dataset.seat);
            if (boatNum === 1) boat1Data[seatIndex] = rower;
            else boat2Data[seatIndex] = rower;
            setupBoatLineups();
        });
    }

    function autofillBoats() {
        let availableRowers1 = [...allRowers].sort(() => 0.5 - Math.random());
        let availableRowers2 = [...allRowers].sort(() => 0.5 - Math.random());
        for (let i = 0; i < 8; i++) {
            if (boat1Data[i] === null) {
                let nextRower = availableRowers1.pop();
                while (boat1Data.some(r => r && r.name === nextRower.name) || boat2Data.some(r => r && r.name === nextRower.name)) {
                    nextRower = availableRowers1.pop();
                }
                boat1Data[i] = nextRower;
            }
        }
        for (let i = 0; i < 8; i++) {
            if (boat2Data[i] === null) {
                let nextRower = availableRowers2.pop();
                while (boat2Data.some(r => r && r.name === nextRower.name) || boat1Data.some(r => r && r.name === nextRower.name)) {
                    nextRower = availableRowers2.pop();
                }
                boat2Data[i] = nextRower;
            }
        }
        setupBoatLineups();
    }

    function setPredefinedLineups() {
        const v1Names = ["Carson Fast", "Sam Peale", "Jack Kirk", "Gunnar Westland", "Henry Terrell", "Matthew Matar", "Alex Barnes", "Andrew Egorin"];
        const v2Names = ["Holden Saunders", "Finnegan Switzer", "Adrian Wiklund", "James Milward", "Sean Noh", "Owen Kelly", "Minh Tran", "Arham Jain"];

        boat1Data = v1Names.map(name => allRowers.find(rower => rower.name === name) || null);
        boat2Data = v2Names.map(name => allRowers.find(rower => rower.name === name) || null);

        setupBoatLineups();
    }

    // --- RACE LOGIC ---
    function startRace() {
        if (boat1Data.some(r => r === null) || boat2Data.some(r => r === null)) {
            alert("Both boats must be full (8 rowers) to start the race.");
            return;
        }
        startRaceBtn.disabled = true;
        startRaceBtn.classList.add('d-none');
        reraceBtn.classList.add('d-none');
        resetBoatsBtn.disabled = true;
        autofillBtn.disabled = true;
        setLineupsBtn.disabled = true;
        speedSlider.disabled = false;
        windSlider.disabled = true;
        winnerMessageEl.textContent = '';
        raceTime = 0;
        resetBoatStates();

        function raceLoop(currentTime) {
            if (lastFrameTime === 0) lastFrameTime = currentTime;
            const timeDelta = (currentTime - lastFrameTime) / 1000;
            lastFrameTime = currentTime;
            if (!boat1State.isFinished || !boat2State.isFinished) raceTime += timeDelta * raceSpeedMultiplier;
            timerEl.textContent = `${formatTime(raceTime)}`;
            updateBoat(boat1Data, boat1State, boat2State, timeDelta, raceSpeedMultiplier);
            updateBoat(boat2Data, boat2State, boat1State, timeDelta, raceSpeedMultiplier);
            drawRaceCanvas();
            updateRowerDetailsUI();
            boat1RateEl.textContent = `${boat1State.strokeRate.toFixed(0)}`;
            boat2RateEl.textContent = `${boat2State.strokeRate.toFixed(0)}`;
            if (raceTime > 0) {
                if (boat1State.distance > 0 && !boat1State.isFinished) {
                    boat1SplitEl.textContent = formatTime((500 * raceTime) / boat1State.distance);
                    boat1AvgQualityEl.textContent = (boat1State.rowerStats.reduce((sum, r) => sum + r.quality, 0) / 8).toFixed(1);
                }
                if (boat2State.distance > 0 && !boat2State.isFinished) {
                    boat2SplitEl.textContent = formatTime((500 * raceTime) / boat2State.distance);
                    boat2AvgQualityEl.textContent = (boat2State.rowerStats.reduce((sum, r) => sum + r.quality, 0) / 8).toFixed(1);
                }
            }
            if (boat1State.isFinished && boat2State.isFinished) {
                const winner = boat1State.finishTime < boat2State.finishTime ? "Boat 1" : "Boat 2";
                winnerMessageEl.innerHTML = `Race Finished! - Boat 1: ${formatTime(boat1State.finishTime)} | Boat 2: ${formatTime(boat2State.finishTime)} - Winner: ${winner}`;
                reraceBtn.classList.remove('d-none');
                reraceBtn.disabled = false;
                resetBoatsBtn.disabled = false;
                autofillBtn.disabled = false;
                setLineupsBtn.disabled = false;
                speedSlider.disabled = true;
                windSlider.disabled = false;
            } else {
                raceAnimationId = requestAnimationFrame(raceLoop);
            }
        }
        lastFrameTime = 0;
        raceAnimationId = requestAnimationFrame(raceLoop);
    }

    function updateBoat(boatData, boatState, opponentState, timeDelta, speedMultiplier) {
        if (boatState.isFinished) return;
        const {
            avgSpeed,
            strokeRate,
            powerModifier,
            individualStats
        } = calculateBoatPhysics(boatData, boatState, opponentState.distance);
        boatState.strokeRate = strokeRate;
        boatState.powerModifier = powerModifier;

        boatState.animationStrokeTime += timeDelta * speedMultiplier;

        const fullStrokeDuration = 60 / strokeRate;
        const driveDuration = fullStrokeDuration * 0.4;
        const recoveryDuration = fullStrokeDuration * 0.6;
        let previousPhase = boatState.phase;
        boatState.timeInPhase += timeDelta * speedMultiplier;
        if (boatState.phase === 'drive' && boatState.timeInPhase >= driveDuration) {
            boatState.phase = 'recovery';
            boatState.timeInPhase = 0;
        } else if (boatState.phase === 'recovery' && boatState.timeInPhase >= recoveryDuration) {
            boatState.phase = 'drive';
            boatState.timeInPhase = 0;
            if (previousPhase === 'recovery') {
                boatState.strokeCount++;
                boatState.justCaught = true; // Set flag for splash effect
                for (let i = 0; i < 8; i++) {
                    const rower = boatData[i];
                    if (rower) {
                        const isPort = i % 2 === 0;
                        const rowerTech = isPort ? rower.technique.port : rower.technique.starboard;
                        boatState.rowerStats[i].quality = Math.max(1, Math.min(5, rowerTech + (Math.random() * 0.6) - 0.3));
                    }
                }
            }
        }
        individualStats.forEach((stat, i) => stat.quality = boatState.rowerStats[i].quality);
        boatState.rowerStats = individualStats;
        let velocityMultiplier = (boatState.phase === 'drive') ? 1 + 0.5 * Math.sin(boatState.timeInPhase / driveDuration * Math.PI) : 1 - 0.25 * (boatState.timeInPhase / recoveryDuration);
        const instantaneousVelocity = avgSpeed * velocityMultiplier; // powerModifier is now applied in physics
        boatState.distance += instantaneousVelocity * timeDelta * speedMultiplier;
        if (boatState.distance >= 1500) {
            boatState.isFinished = true;
            const overshoot = boatState.distance - 1500;
            const timeOvershoot = instantaneousVelocity > 0 ? overshoot / instantaneousVelocity : 0;
            boatState.finishTime = raceTime - (timeOvershoot / speedMultiplier);
        }
    }

    function updateRowerDetailsUI() {
        boat1DetailsEl.innerHTML = '';
        const boat1Grid = document.createElement('div');
        boat1Grid.className = 'boat-details-grid';
        boat1State.rowerStats.forEach(stats => boat1Grid.appendChild(createStatCard(stats)));
        boat1DetailsEl.appendChild(boat1Grid);
        boat2DetailsEl.innerHTML = '';
        const boat2Grid = document.createElement('div');
        boat2Grid.className = 'boat-details-grid';
        boat2State.rowerStats.forEach(stats => boat2Grid.appendChild(createStatCard(stats)));
        boat2DetailsEl.appendChild(boat2Grid);
    }

    function createStatCard(stats) {
        const card = document.createElement('div');
        card.className = 'rower-stats-card';
        card.innerHTML = `<h4>${stats.name}</h4><p>Watts: ${stats.watts.toFixed(0)}</p><p>Quality: ${stats.quality.toFixed(1)} / 5.0</p>`;
        return card;
    }

    function resetBoats() {
        cancelAnimationFrame(raceAnimationId);
        rosterSearch.value = '';
        boat1Data = Array(8).fill(null);
        boat2Data = Array(8).fill(null);
        setupBoatLineups();
        renderRosterList();
        resetBoatStates();
        raceTime = 0;
        timerEl.textContent = "0:00.0";
        boat1RateEl.textContent = '0';
        boat1SplitEl.textContent = '0:00.0';
        boat1AvgQualityEl.textContent = '0.0';
        boat2RateEl.textContent = '0';
        boat2SplitEl.textContent = '0:00.0';
        boat2AvgQualityEl.textContent = '0.0';
        winnerMessageEl.textContent = '';
        startRaceBtn.disabled = false;
        startRaceBtn.classList.remove('d-none');
        reraceBtn.classList.add('d-none');
        resetBoatsBtn.disabled = false;
        autofillBtn.disabled = false;
        setLineupsBtn.disabled = false;
        speedSlider.disabled = false;
        windSlider.disabled = false;
        windSlider.value = 0;
        windLabel.textContent = "Normal";
        speedSlider.value = 1;
        speedLabel.textContent = "1x";
        raceSpeedMultiplier = 1;
        drawInitialCanvas();
    }

    function parseTimeToSeconds(timeStr) {
        return timeStr ? parseInt(timeStr.split(':')[0], 10) * 60 + parseFloat(timeStr.split(':')[1]) : 500;
    }

    function calculateBoatPhysics(boat, boatState, opponentDist) {
        if (boat.some(r => r === null)) return {
            avgSpeed: 0,
            strokeRate: 30,
            powerModifier: 1,
            individualStats: []
        };

        let total2kSeconds = 0,
            totalWeight = 0;
        boat.forEach(rower => {
            total2kSeconds += parseTimeToSeconds(rower['2k']);
            totalWeight += rower.weight;
        });
        const avg500mSplit = (total2kSeconds / 8) / 4;

        const PACE_SCALER = 845;
        const baseSpeed = PACE_SCALER / Math.pow(avg500mSplit, 1.1);

        let powerModifier = 1.0,
            totalTechAdjustment = 0,
            totalFollowingAdjustment = 0,
            totalRateDifference = 0,
            totalMentalityAdjustment = 0;
        let individualStats = [];
        const isLosing = boatState.distance < opponentDist;
        const strokeRower = boat[0];
        const baseRate = strokeRower ? strokeRower.best_rate : 34;
        let currentRate = baseRate;

        // Determine main race phase (sprint)
        if ((isLosing && boatState.distance >= 1150) || (!isLosing && boatState.distance >= 1200)) {
            if (boatState.racePhase !== 'start') boatState.racePhase = 'sprint';
        }

        // --- NEW STARTING 5 STROKE LOGIC ---
        switch (boatState.racePhase) {
            case 'start':
                const stroke = boatState.strokeCount;
                if (stroke > 5) {
                    boatState.racePhase = 'power-20';
                } else {
                    switch (stroke) {
                        case 1: // First stroke
                            currentRate = 36;
                            powerModifier = 0.50; // 50% pressure
                            break;
                        case 2: // Second stroke
                            currentRate = 48;
                            powerModifier = 0.75; // 75% pressure
                            break;
                        case 3: // Third stroke
                            currentRate = 48;
                            powerModifier = 0.75; // 75% pressure
                            break;
                        case 4: // Fourth stroke
                            currentRate = 52;
                            powerModifier = 1.00; // 100% pressure
                            break;
                        case 5: // Fifth stroke
                            currentRate = 52;
                            powerModifier = 1.00; // 100% pressure
                            break;
                        default: // Handles stroke 0 (before the race starts)
                            powerModifier = 0;
                            currentRate = 40;
                            break;
                    }
                }
                break;
            case 'power-20':
                currentRate = baseRate + 2;
                if (boatState.strokeCount >= 25) boatState.racePhase = 'settle';
                break;
            case 'settle':
                currentRate = baseRate;
                break;
            case 'sprint':
                currentRate = baseRate + 4;
                break;
        }

        boat.forEach((rower, index) => {
            const splitSeconds = parseTimeToSeconds(rower['2k']) / 4;
            const baseWatts = 2.80 / Math.pow(splitSeconds / 500, 3);
            const qualityWattsModifier = 1.0 + (boatState.rowerStats[index].quality - 4.0) * 0.02;
            const actualWatts = baseWatts * powerModifier * ((boatState.racePhase === 'sprint') ? 1.05 : 1.0) * qualityWattsModifier;
            const strokeQuality = boatState.rowerStats[index].quality;
            totalTechAdjustment += (strokeQuality - 4.5) * 0.20;
            if (isLosing) totalMentalityAdjustment += (rower.mentality - 4.0) * 0.004;
            if (boatState.racePhase === 'sprint') totalMentalityAdjustment += (rower.mentality - 4.0) * 0.006;
            if (index > 0) totalFollowingAdjustment += (rower.following - 4.5) * 0.01;
            if (boatState.racePhase !== 'start') {
                let bestRate = rower.best_rate;
                if (boatState.racePhase === 'sprint') bestRate += 4;
                totalRateDifference += Math.abs(currentRate - bestRate);
            }
            individualStats.push({
                name: rower.name,
                watts: actualWatts,
                quality: strokeQuality
            });
        });

        const rateAdjustment = -(totalRateDifference / 8) * 0.013;
        const avgWeight = totalWeight / 8;
        const baselineWeight = 170;
        const weightAdjustment = (baselineWeight - avgWeight) * 0.004;

        let windAdjustment = 0;
        const weightDifference = baselineWeight - avgWeight;

        if (windCondition === 1) { // Tailwind
            const tailwindFactor = 0.0015;
            windAdjustment = 0.169 + (weightDifference * tailwindFactor);
        } else if (windCondition === -1) { // Headwind
            const headwindFactor = 0.0018;
            windAdjustment = -0.238 - (weightDifference * headwindFactor);
        }

        const avgSpeed = baseSpeed + (totalTechAdjustment / 8) + (totalFollowingAdjustment / 7) + rateAdjustment + (totalMentalityAdjustment / 8) + weightAdjustment + windAdjustment;
        return {
            avgSpeed: Math.max(0, avgSpeed),
            strokeRate: currentRate,
            powerModifier,
            individualStats
        };
    }

    function formatTime(totalSeconds) {
        if (totalSeconds === Infinity || isNaN(totalSeconds) || totalSeconds < 0) return "0:00.0";
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = (totalSeconds % 60).toFixed(1);
        return `${minutes}:${seconds.padStart(4, '0')}`;
    }

    function drawInitialCanvas() {
        const finishPadding = 50;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 15]);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        const finishLineX = canvas.width - finishPadding;
        ctx.fillStyle = '#e50914';
        ctx.fillRect(finishLineX, 0, 5, canvas.height);
    }

    function drawRaceCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawInitialCanvas();
        drawBoat(boat1State, canvas.height / 4, '#e50914', boat1Data);
        drawBoat(boat2State, canvas.height * 3 / 4, '#f5f5f5', boat2Data);
    }

    function drawBoat(boatState, y, color, boatData) {
        const raceDistanceMeters = 1500;
        const boatLengthMeters = 25;
        const startPadding = 0;
        const finishPadding = 50;
        const raceableWidth = canvas.width - startPadding - finishPadding;
        const boatLengthOnCanvas = (boatLengthMeters / raceDistanceMeters) * raceableWidth;
        const boatWidth = 5;
        const riggerWidth = 6;
        const oarInboard = 2;
        const oarOutboard = 6;

        const sternX = startPadding + ((boatState.distance / raceDistanceMeters) * raceableWidth);
        const bowX = sternX + boatLengthOnCanvas;

        // --- NEW UNIFIED ANIMATION ENGINE ---
        let swingAngle;
        const fullStrokeDuration = 60 / boatState.strokeRate;
        const catchAngleDeg = -32; // Full stroke range
        const finishAngleDeg = 60;  // Full stroke range
        const isDrivePhase = boatState.phase === 'drive';

        // The animation timing is now determined by the physics timing in updateBoat()
        const driveRatio = 0.45;
        const recoveryRatio = 0.55;
        const driveDuration = fullStrokeDuration * driveRatio;
        const recoveryDuration = fullStrokeDuration * recoveryRatio;

        let angle;
        if (isDrivePhase) {
            const progress = Math.min(1, boatState.timeInPhase / driveDuration);
            angle = catchAngleDeg + (finishAngleDeg - catchAngleDeg) * progress;
        } else { // Recovery phase
            const progress = Math.min(1, boatState.timeInPhase / recoveryDuration);
            angle = finishAngleDeg + (catchAngleDeg - finishAngleDeg) * progress;
        }
        swingAngle = angle * (Math.PI / 180);
        // --- END NEW ANIMATION ENGINE ---


        boatState.splashes.forEach(s => {
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.1;
            s.life -= 0.03;
            ctx.globalAlpha = Math.max(0, s.life);
            ctx.fillStyle = 'rgba(215, 235, 245, 0.8)';
            ctx.fillRect(s.x, s.y, s.size, s.size);
            ctx.globalAlpha = 1;
        });
        boatState.splashes = boatState.splashes.filter(s => s.life > 0);

        for (let i = 0; i < 8; i++) {
            const seatX = bowX - ((i + 1.5) * (boatLengthOnCanvas / 9));
            const isPort = (i + 1) % 2 === 0;
            const sideOffset = isPort ? -riggerWidth : riggerWidth;
            const oarlockX = seatX;
            const oarlockY = y + sideOffset;

            ctx.save();
            ctx.translate(oarlockX, oarlockY);
            if (isPort) {
                ctx.scale(1, -1);
                ctx.rotate(-swingAngle);
            } else {
                ctx.rotate(-swingAngle);
            }

            ctx.fillStyle = '#999';
            ctx.fillRect(1, -2.5, 1, oarOutboard);
            ctx.fillRect(1, -2.5 - oarInboard, 1, oarInboard);

            ctx.fillStyle = color;
            const bladeWidth = isDrivePhase ? 4 : 1; // Blade is wider in the water
            ctx.fillRect(-bladeWidth / 2 + 1.5, oarOutboard - 3, bladeWidth, 5);

            ctx.restore();

            // Splash effect logic. Triggers on the frame 'justCaught' is true.
            if (boatState.justCaught && boatData[i]) {
                const quality = boatState.rowerStats[i].quality;
                const numParticles = Math.max(0, Math.floor((5.5 - quality) * 2));
                const catchAngleRad = catchAngleDeg * (Math.PI / 180);
                const oarRotation = isPort ? -catchAngleRad : -catchAngleRad;
                const bladeTipX = oarlockX - Math.sin(oarRotation) * oarOutboard;
                const bladeTipY = oarlockY + Math.cos(oarRotation) * oarOutboard * (isPort ? -1 : 1);

                for (let p = 0; p < numParticles; p++) {
                    boatState.splashes.push({
                        x: bladeTipX,
                        y: bladeTipY,
                        vx: (Math.random() - 0.7) * 0.8,
                        vy: -Math.random() * 1.5,
                        life: 1,
                        size: Math.random() + 1
                    });
                }
            }
        }
        // Reset the splash trigger after all rowers have been drawn for this frame
        if (boatState.justCaught) boatState.justCaught = false;

        // Draw Hull
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(bowX, y);
        ctx.bezierCurveTo(sternX + boatLengthOnCanvas * 0.7, y - boatWidth / 2, sternX + boatLengthOnCanvas * 0.3, y - boatWidth / 2, sternX, y);
        ctx.bezierCurveTo(sternX + boatLengthOnCanvas * 0.3, y + boatWidth / 2, sternX + boatLengthOnCanvas * 0.7, y + boatWidth / 2, bowX, y);
        ctx.closePath();
        ctx.fill();
    }

    // --- GLOBAL EVENT LISTENERS ---
    startRaceBtn.addEventListener('click', startRace);
    reraceBtn.addEventListener('click', startRace);
    resetBoatsBtn.addEventListener('click', resetBoats);
    autofillBtn.addEventListener('click', autofillBoats);
    setLineupsBtn.addEventListener('click', setPredefinedLineups);
    rosterSearch.addEventListener('input', (e) => renderRosterList(e.target.value));
    speedSlider.addEventListener('input', (e) => {
        raceSpeedMultiplier = parseFloat(e.target.value);
        speedLabel.textContent = `${raceSpeedMultiplier}x`;
    });
    windSlider.addEventListener('input', (e) => {
        windCondition = parseInt(e.target.value, 10);
        if (windCondition === -1) windLabel.textContent = 'Headwind';
        else if (windCondition === 0) windLabel.textContent = 'Normal';
        else if (windCondition === 1) windLabel.textContent = 'Tailwind';
    });
});