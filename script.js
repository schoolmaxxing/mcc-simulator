document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const rosterList = document.getElementById('roster-list');
    const boat1Lineup = document.getElementById('boat1-lineup');
    const boat2Lineup = document.getElementById('boat2-lineup');
    const boat1Avg2kEl = document.getElementById('boat1-avg-2k');
    const boat2Avg2kEl = document.getElementById('boat2-avg-2k');
    const startRaceBtn = document.getElementById('start-race');
    const resetBoatsBtn = document.getElementById('reset-boats');
    const autofillBtn = document.getElementById('autofill-boats');
    const boat1Div = document.getElementById('boat1');
    const boat2Div = document.getElementById('boat2');
    const winnerMessageEl = document.getElementById('winner-message');
    const speedSlider = document.getElementById('speed-slider');
    const speedLabel = document.getElementById('speed-label');
    const timerEl = document.getElementById('race-timer');
    const boat1RateEl = document.getElementById('boat1-rate');
    const boat1SplitEl = document.getElementById('boat1-split');
    const boat2RateEl = document.getElementById('boat2-rate');
    const boat2SplitEl = document.getElementById('boat2-split');
    const boat1DistEl = document.getElementById('boat1-distance');
    const boat2DistEl = document.getElementById('boat2-distance');

    // Game State
    let allRowers = [];
    let boat1Data = Array(8).fill(null);
    let boat2Data = Array(8).fill(null);
    let raceAnimationId;
    let raceSpeedMultiplier = 1;
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
    }

    function resetBoatStates() {
        boat1State = {
            distance: 0,
            phase: 'recovery',
            timeInPhase: 0,
            isFinished: false,
            finishTime: 0,
            splitTime: "0:00.0",
            strokeRate: 0,
            racePhase: 'start',
            strokeCount: 0
        };
        boat2State = {
            distance: 0,
            phase: 'recovery',
            timeInPhase: 0,
            isFinished: false,
            finishTime: 0,
            splitTime: "0:00.0",
            strokeRate: 0,
            racePhase: 'start',
            strokeCount: 0
        };
    }

    // --- SETUP AND RENDERING ---
    function renderRosterList() {
        rosterList.innerHTML = '';
        allRowers.forEach(rower => {
            const card = createRowerCard(rower.name);
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
    }

    function setupBoatLineups() {
        boat1Lineup.innerHTML = '';
        boat2Lineup.innerHTML = '';

        // --- Calculate and Display Average 2k ---
        const boat1Crew = boat1Data.filter(r => r !== null);
        if (boat1Crew.length > 0) {
            let total2kSeconds = 0;
            boat1Crew.forEach(r => total2kSeconds += parseTimeToSeconds(r['2k']));
            const avg2k = total2kSeconds / boat1Crew.length;
            boat1Avg2kEl.textContent = `(Avg 2k: ${formatTime(avg2k)})`;
        } else {
            boat1Avg2kEl.textContent = '';
        }

        const boat2Crew = boat2Data.filter(r => r !== null);
        if (boat2Crew.length > 0) {
            let total2kSeconds = 0;
            boat2Crew.forEach(r => total2kSeconds += parseTimeToSeconds(r['2k']));
            const avg2k = total2kSeconds / boat2Crew.length;
            boat2Avg2kEl.textContent = `(Avg 2k: ${formatTime(avg2k)})`;
        } else {
            boat2Avg2kEl.textContent = '';
        }
        // --- End 2k Calculation ---


        for (let i = 0; i < 8; i++) {
            const seatLabel = i === 0 ? "Stroke" : `Seat ${i + 1}`;
            boat1Lineup.appendChild(createSeat(1, i, seatLabel));
            boat2Lineup.appendChild(createSeat(2, i, seatLabel));
        }
        const allSeats = document.querySelectorAll('.seat');
        allSeats.forEach(seat => {
            addSeatListeners(seat);
        });
    }

    function createRowerCard(name) {
        const card = document.createElement('div');
        card.className = 'roster-card';
        card.dataset.rowerName = name;
        card.textContent = name;
        return card;
    }

    function createSeat(boatNum, index, label) {
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.dataset.boat = boatNum;
        seat.dataset.seat = index;
        const currentRower = boatNum === 1 ? boat1Data[index] : boat2Data[index];
        if (currentRower) {
            seat.appendChild(createRowerCard(currentRower.name));
        } else {
            seat.textContent = label;
        }
        return seat;
    }

    // --- DRAG AND DROP & AUTOFILL ---
    function addSeatListeners(seat) {
        seat.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            seat.classList.add('drag-over');
        });
        seat.addEventListener('dragleave', () => {
            seat.classList.remove('drag-over');
        });
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
            setupBoatLineups(); // Redraw everything to update seats and avg 2k
        });
    }

    function autofillBoats() {
        for (let i = 0; i < 8; i++) {
            if (boat1Data[i] === null) {
                boat1Data[i] = allRowers[Math.floor(Math.random() * allRowers.length)];
            }
        }
        for (let i = 0; i < 8; i++) {
            if (boat2Data[i] === null) {
                boat2Data[i] = allRowers[Math.floor(Math.random() * allRowers.length)];
            }
        }
        setupBoatLineups();
    }

    // --- RACE LOGIC ---
    function startRace() {
        if (boat1Data.some(r => r === null) || boat2Data.some(r => r === null)) {
            alert("Both boats must be full (8 rowers) to start the race.");
            return;
        }
        startRaceBtn.disabled = true;
        resetBoatsBtn.disabled = true;
        autofillBtn.disabled = true;
        winnerMessageEl.textContent = '';
        raceTime = 0;
        resetBoatStates();
        const raceTrackWidth = document.getElementById('race-track').offsetWidth - boat1Div.offsetWidth;

        function raceLoop(currentTime) {
            if (lastFrameTime === 0) lastFrameTime = currentTime;
            const timeDelta = (currentTime - lastFrameTime) / 1000;
            lastFrameTime = currentTime;

            if (!boat1State.isFinished || !boat2State.isFinished) raceTime += timeDelta * raceSpeedMultiplier;
            timerEl.textContent = `Time: ${formatTime(raceTime)}`;

            updateBoat(boat1Data, boat1State, boat2State, timeDelta, raceSpeedMultiplier);
            updateBoat(boat2Data, boat2State, boat1State, timeDelta, raceSpeedMultiplier);

            if (raceTime > 0) {
                if (boat1State.distance > 0 && !boat1State.isFinished) {
                    const avgSplitSeconds1 = (500 * raceTime) / boat1State.distance;
                    boat1State.splitTime = formatTime(avgSplitSeconds1);
                }
                if (boat2State.distance > 0 && !boat2State.isFinished) {
                    const avgSplitSeconds2 = (500 * raceTime) / boat2State.distance;
                    boat2State.splitTime = formatTime(avgSplitSeconds2);
                }
            }
            boat1DistEl.textContent = `Boat 1 Distance: ${Math.min(1500, boat1State.distance).toFixed(0)}m`;
            boat2DistEl.textContent = `Boat 2 Distance: ${Math.min(1500, boat2State.distance).toFixed(0)}m`;
            boat1RateEl.textContent = `Boat 1 Rate: ${boat1State.strokeRate.toFixed(0)}`;
            boat2RateEl.textContent = `Boat 2 Rate: ${boat2State.strokeRate.toFixed(0)}`;
            boat1SplitEl.textContent = `Boat 1 Split: ${boat1State.splitTime}/500m`;
            boat2SplitEl.textContent = `Boat 2 Split: ${boat2State.splitTime}/500m`;

            boat1Div.style.left = `${10 + (boat1State.distance / 1500) * raceTrackWidth}px`;
            boat2Div.style.left = `${10 + (boat2State.distance / 1500) * raceTrackWidth}px`;

            if (boat1State.isFinished && boat2State.isFinished) {
                const b1Time = boat1State.finishTime;
                const b2Time = boat2State.finishTime;
                const winner = b1Time < b2Time ? "Boat 1" : "Boat 2";
                winnerMessageEl.innerHTML = `Race Finished!\nBoat 1: ${formatTime(b1Time)}\nBoat 2: ${formatTime(b2Time)}\nWinner: ${winner}`;
                resetBoatsBtn.disabled = false;
                autofillBtn.disabled = false;
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
            powerModifier
        } = calculateBoatPhysics(boatData, boatState, opponentState.distance);
        boatState.strokeRate = strokeRate;

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
            }
        }

        let velocityMultiplier = 1.0;
        const phaseProgress = boatState.timeInPhase / (boatState.phase === 'drive' ? driveDuration : recoveryDuration);
        if (boatState.phase === 'drive') {
            velocityMultiplier = 1 + 0.5 * Math.sin(phaseProgress * Math.PI);
        } else {
            velocityMultiplier = 1 - 0.25 * phaseProgress;
        }

        const instantaneousVelocity = avgSpeed * velocityMultiplier * powerModifier;
        boatState.distance += instantaneousVelocity * timeDelta * speedMultiplier;

        if (boatState.distance >= 1500) {
            boatState.isFinished = true;
            const overshoot = boatState.distance - 1500;
            const timeOvershoot = instantaneousVelocity > 0 ? overshoot / instantaneousVelocity : 0;
            boatState.finishTime = raceTime - (timeOvershoot / speedMultiplier);
        }
    }

    function resetBoats() {
        cancelAnimationFrame(raceAnimationId);
        boat1Data = Array(8).fill(null);
        boat2Data = Array(8).fill(null);
        setupBoatLineups(); // This will also clear the avg 2k display
        resetBoatStates();
        raceTime = 0;
        timerEl.textContent = "Time: 0:00.0";
        boat1Div.style.left = '10px';
        boat2Div.style.left = '10px';
        boat1DistEl.textContent = `Boat 1 Distance: 0m`;
        boat2DistEl.textContent = `Boat 2 Distance: 0m`;
        boat1RateEl.textContent = 'Boat 1 Rate: 0';
        boat1SplitEl.textContent = 'Boat 1 Split: 0:00.0/500m';
        boat2RateEl.textContent = 'Boat 2 Rate: 0';
        boat2SplitEl.textContent = 'Boat 2 Split: 0:00.0/500m';
        winnerMessageEl.textContent = '';
        startRaceBtn.disabled = false;
        resetBoatsBtn.disabled = false;
        autofillBtn.disabled = false;
        speedSlider.value = 1;
        speedLabel.textContent = "1x";
        raceSpeedMultiplier = 1;
    }

    function parseTimeToSeconds(timeStr) {
        return timeStr ? parseInt(timeStr.split(':')[0], 10) * 60 + parseFloat(timeStr.split(':')[1]) : 500;
    }

    function calculateBoatPhysics(boat, boatState, opponentDist) {
        if (boat.some(r => r === null)) return {
            avgSpeed: 0,
            strokeRate: 30,
            powerModifier: 1
        };

        let totalPower = 0;
        boat.forEach(rower => {
            totalPower += 1 / Math.pow(parseTimeToSeconds(rower['2k']), 3);
        });
        const avgPower = totalPower / 8;
        const HULL_SPEED_SCALER = 2400;
        const baseSpeed = Math.cbrt(avgPower) * HULL_SPEED_SCALER;

        let mentalityModifier = 1.0;
        let powerModifier = 1.0;
        let totalTechScore = 0;
        let totalFollowingScore = 0;
        let totalRateDifference = 0;

        const isLosing = boatState.distance < opponentDist;
        const strokeRower = boat[0];
        const baseRate = strokeRower ? strokeRower.best_rate : 34;
        let currentRate = baseRate;

        const losingSprintMark = 1150;
        const winningSprintMark = 1200;
        if ((isLosing && boatState.distance >= losingSprintMark) || (!isLosing && boatState.distance >= winningSprintMark)) {
            if (boatState.racePhase !== 'start') boatState.racePhase = 'sprint';
        }

        switch (boatState.racePhase) {
            case 'start':
                const stroke = boatState.strokeCount;
                if (stroke <= 2) currentRate = (stroke === 1) ? 52 : 48;
                else if (stroke <= 4) currentRate = 46;
                else boatState.racePhase = 'power-20';
                powerModifier = (stroke === 1) ? 0.7 : ((stroke === 0 || stroke === 2) ? 0.85 : 1.0);
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
            const isPort = index % 2 === 1;
            totalTechScore += isPort ? rower.technique.port : rower.technique.starboard;
            if (isLosing) mentalityModifier *= (1 + (rower.mentality - 4.0) * 0.003);
            if (boatState.racePhase === 'sprint') mentalityModifier *= (1 + (rower.mentality - 4.0) * 0.008);
            if (index > 0) {
                totalFollowingScore += rower.following;
            }
            if (boatState.racePhase !== 'start') {
                let bestRate = rower.best_rate;
                if (boatState.racePhase === 'sprint') bestRate += 4;
                totalRateDifference += Math.abs(currentRate - bestRate);
            }
        });

        const techAdjustment = ((totalTechScore / 8) - 4.5) * 0.06;
        const followingAdjustment = ((totalFollowingScore / 7) - 4.5) * 0.04;
        const rateAdjustment = -(totalRateDifference / 8) * 0.015;

        const modifiedSpeed = baseSpeed + techAdjustment + followingAdjustment + rateAdjustment;
        const avgSpeed = modifiedSpeed * mentalityModifier;

        return {
            avgSpeed: Math.max(0, avgSpeed),
            strokeRate: currentRate,
            powerModifier
        };
    }

    function formatTime(totalSeconds) {
        if (totalSeconds === Infinity || isNaN(totalSeconds) || totalSeconds < 0) return "0:00.0";
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = (totalSeconds % 60).toFixed(1);
        return `${minutes}:${seconds.padStart(4, '0')}`;
    }

    // --- GLOBAL EVENT LISTENERS ---
    startRaceBtn.addEventListener('click', startRace);
    resetBoatsBtn.addEventListener('click', resetBoats);
    autofillBtn.addEventListener('click', autofillBoats);
    speedSlider.addEventListener('input', (e) => {
        raceSpeedMultiplier = e.target.value;
        speedLabel.textContent = `${raceSpeedMultiplier}x`;
    });
});