document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const mainGrid = document.querySelector('.main-grid');
    const rosterList = document.getElementById('roster-list');
    const rosterSearch = document.getElementById('roster-search');
    const rosterCardPopup = document.getElementById('roster-card-popup');
    const telemetryPanel = document.querySelector('.telemetry-panel');
    const boat3Elements = document.querySelectorAll('.boat-3-element');

    // Boat Elements (Grouped)
    const boatNames = [document.getElementById('boat1-name'), document.getElementById('boat2-name'), document.getElementById('boat3-name')];
    const boatLineups = [document.getElementById('boat1-lineup'), document.getElementById('boat2-lineup'), document.getElementById('boat3-lineup')];
    const boatAvg2kEls = [document.getElementById('boat1-avg-2k'), document.getElementById('boat2-avg-2k'), document.getElementById('boat3-avg-2k')];
    const boatAvgWeightEls = [document.getElementById('boat1-avg-weight'), document.getElementById('boat2-avg-weight'), document.getElementById('boat3-avg-weight')];
    const boatAvgQualityEls = [document.getElementById('boat1-avg-quality'), document.getElementById('boat2-avg-quality'), document.getElementById('boat3-avg-quality')];
    const boatRateEls = [document.getElementById('boat1-rate'), document.getElementById('boat2-rate'), document.getElementById('boat3-rate')];
    const boatSplitEls = [document.getElementById('boat1-split'), document.getElementById('boat2-split'), document.getElementById('boat3-split')];
    const boatDetailsEls = [document.getElementById('boat1-details'), document.getElementById('boat2-details'), document.getElementById('boat3-details')];

    // Controls & Race Info
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
    const boatCountSelect = document.getElementById('boat-count-select');
    const timerEl = document.getElementById('race-timer');
    const canvas = document.getElementById('race-canvas');
    const ctx = canvas.getContext('2d');

    // Game State
    let allRowers = [];
    let boat1Data = Array(8).fill(null);
    let boat2Data = Array(8).fill(null);
    let boat3Data = Array(8).fill(null);
    let allBoatData = [boat1Data, boat2Data, boat3Data];

    let raceAnimationId;
    let raceSpeedMultiplier = 1;
    let windCondition = 0;
    let numberOfBoats = 3;
    let lastFrameTime = 0;
    let raceTime = 0;
    let boat1State = {};
    let boat2State = {};
    let boat3State = {};
    let allBoatStates = [boat1State, boat2State, boat3State];

    // --- INITIALIZATION ---
    fetch('rowers.json')
        .then(response => response.json())
        .then(data => {
            allRowers = data;
            initialize();
        });

    function initialize() {
        renderRosterList();
        setupAllBoatLineups();
        resetAllBoatStates();
        setCanvasSize();
        setupContentEditableListeners();
        window.addEventListener('resize', setCanvasSize);
    }

    function setCanvasSize() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        drawInitialCanvas();
    }

    function resetAllBoatStates() {
        allBoatStates = allBoatStates.map(() => ({
            distance: 0,
            phase: 'recovery',
            timeInPhase: 0,
            isFinished: false,
            finishTime: 0,
            strokeRate: 0,
            racePhase: 'start',
            strokeCount: 0,
            rowerStats: Array(8).fill({
                name: 'Empty',
                watts: 0,
                quality: 0
            }),
            puddles: [],
            splashes: [],
            justCaught: false,
            animationStrokeTime: 0,
            powerModifier: 0,
        }));
        updateAllRowerDetailsUI();
    }
    
    function setupContentEditableListeners() {
        boatNames.forEach(nameEl => {
            // Sanitize input on paste
            nameEl.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text.replace(/(\r\n|\n|\r)/gm, " ").trim());
            });
            // Prevent new lines on enter
            nameEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    nameEl.blur(); // Unfocus the element
                }
            });
        });
    }

    // --- SETUP AND RENDERING ---
    function renderRosterList(filter = '') {
        rosterList.innerHTML = '';
        const lowerCaseFilter = filter.toLowerCase();
        const filteredRowers = allRowers.filter(rower => rower.name.toLowerCase().includes(lowerCaseFilter));

        filteredRowers.forEach(rower => {
            const card = createRowerCard(rower);
            card.draggable = true;
            card.addEventListener('dragstart', e => {
                hideRowerCardPopup();
                e.dataTransfer.setData('text/plain', e.target.dataset.rowerName);
                setTimeout(() => e.target.classList.add('dragging'), 0);
            });
            card.addEventListener('dragend', e => e.target.classList.remove('dragging'));
            card.addEventListener('mouseover', (event) => showRowerCardPopup(event, rower));
            card.addEventListener('mouseout', hideRowerCardPopup);
            card.addEventListener('mousemove', (event) => {
                rosterCardPopup.style.left = `${event.pageX + 20}px`;
                rosterCardPopup.style.top = `${event.pageY + 20}px`;
            });
            rosterList.appendChild(card);
        });
    }

    function setupAllBoatLineups() {
        allBoatData.forEach((boatData, boatIndex) => {
            const lineupEl = boatLineups[boatIndex];
            lineupEl.innerHTML = '';
            const listGroup = document.createElement('ul');
            listGroup.className = 'list-group';
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
                    li.appendChild(createRowerCard(rower));
                }
                listGroup.appendChild(li);
            }
            lineupEl.appendChild(listGroup);
        });

        document.querySelectorAll('.seat').forEach(seat => addSeatListeners(seat));
        updateAllBoatHeaderStats();
    }

    function updateAllBoatHeaderStats() {
        allBoatData.forEach((data, index) => {
            const avg2kEl = boatAvg2kEls[index];
            const avgWeightEl = boatAvgWeightEls[index];
            const crew = data.filter(r => r !== null);
            if (crew.length > 0) {
                const avg2k = crew.reduce((sum, r) => sum + parseTimeToSeconds(r['2k']), 0) / crew.length;
                const avgWt = crew.reduce((sum, r) => sum + r.weight, 0) / crew.length;
                avg2kEl.textContent = `Avg 2k: ${formatTime(avg2k)}`;
                avgWeightEl.textContent = `Avg Wt: ${avgWt.toFixed(1)} lbs`;
            } else {
                avg2kEl.textContent = '';
                avgWeightEl.textContent = '';
            }
        });
    }

    function createRowerCard(rower) {
        const card = document.createElement('div');
        card.className = 'roster-card';
        card.dataset.rowerName = rower.name;
        card.textContent = rower.name;
        return card;
    }

    function showRowerCardPopup(event, rower) {
        const rarityName = rower.rarity || 'Common';
        rosterCardPopup.className = `rarity-${rarityName}`; // Set class for border color
        rosterCardPopup.innerHTML = `
            <div class="popup-header">
                <div class="popup-name-section">
                    <h4>${rower.name}</h4>
                    <p class="rarity-text">${rarityName}</p> 
                </div>
                <span class="rower-2k">${rower['2k']}</span>
            </div>
            <div class="popup-divider"></div>
            <div class="popup-stats-grid">
                <div class="popup-stat">
                    <span class="stat-label">Port Tech</span>
                    <span class="stat-value">${rower.technique.port.toFixed(1)} ★</span>
                </div>
                <div class="popup-stat">
                    <span class="stat-label">Starboard Tech</span>
                    <span class="stat-value">${rower.technique.starboard.toFixed(1)} ★</span>
                </div>
                <div class="popup-stat">
                    <span class="stat-label">Mentality</span>
                    <span class="stat-value">${rower.mentality} ★</span>
                </div>
                <div class="popup-stat">
                    <span class="stat-label">Following</span>
                    <span class="stat-value">${rower.following} ★</span>
                </div>
                 <div class="popup-stat">
                    <span class="stat-label">Weight</span>
                    <span class="stat-value">${rower.weight} lbs</span>
                </div>
                 <div class="popup-stat">
                    <span class="stat-label">Best Rate</span>
                    <span class="stat-value">${rower.best_rate} spm</span>
                </div>
            </div>
        `;
        rosterCardPopup.style.left = `${event.pageX + 20}px`;
        rosterCardPopup.style.top = `${event.pageY + 20}px`;
        rosterCardPopup.style.display = 'block';
    }

    function hideRowerCardPopup() {
        rosterCardPopup.style.display = 'none';
    }

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

            allBoatData[boatNum - 1][seatIndex] = rower;

            setupAllBoatLineups();
        });
    }

    function autofillBoats() {
        const boatLineups = allBoatData.slice(0, numberOfBoats);

        boatLineups.forEach(lineup => {
            const placedInThisBoat = new Set(lineup.filter(r => r).map(r => r.name));
            let availableForThisBoat = allRowers.filter(r => !placedInThisBoat.has(r.name));

            for (let i = 0; i < 8; i++) {
                if (lineup[i] === null) {
                    if (availableForThisBoat.length === 0) {
                        availableForThisBoat = allRowers.filter(r => !placedInThisBoat.has(r.name));
                    }
                    if (availableForThisBoat.length > 0) {
                        const randomIndex = Math.floor(Math.random() * availableForThisBoat.length);
                        const selectedRower = availableForThisBoat[randomIndex];
                        lineup[i] = selectedRower;
                        placedInThisBoat.add(selectedRower.name);
                        availableForThisBoat.splice(randomIndex, 1);
                    }
                }
            }
        });

        setupAllBoatLineups();
    }

    function setPredefinedLineups() {
        resetBoats();
        const v1Names = ["Carson Fast", "Sam Peale", "Jack Kirk", "Gunnar Westland", "Henry Terrell", "Matthew Matar", "Alex Barnes", "Andrew Egorin"];
        const v2Names = ["Holden Saunders", "Finnegan Switzer", "Adrian Wiklund", "James Milward", "Sean Noh", "Owen Kelly", "Minh Tran", "Arham Jain"];
        boat1Data = v1Names.map(name => allRowers.find(rower => rower.name === name) || null);
        boat2Data = v2Names.map(name => allRowers.find(rower => rower.name === name) || null);
        allBoatData = [boat1Data, boat2Data, boat3Data];
        setupAllBoatLineups();
    }

    function updateBoatCount() {
        numberOfBoats = parseInt(boatCountSelect.value, 10);
        document.body.classList.toggle('two-boats-mode', numberOfBoats === 2);
        resetBoats();
    }


    // --- RACE LOGIC ---
    function startRace() {
        const boatsToRace = allBoatData.slice(0, numberOfBoats);
        if (boatsToRace.some(boat => boat.some(r => r === null))) {
            alert(`All ${numberOfBoats} boats must be full (8 rowers) to start the race.`);
            return;
        }

        startRaceBtn.disabled = true;
        startRaceBtn.classList.add('d-none');
        reraceBtn.classList.add('d-none');
        resetBoatsBtn.disabled = true;
        autofillBtn.disabled = true;
        setLineupsBtn.disabled = true;
        windSlider.disabled = true;
        boatCountSelect.disabled = true;
        boatNames.forEach(el => el.setAttribute('contenteditable', 'false'));
        winnerMessageEl.textContent = '';
        raceTime = 0;
        resetAllBoatStates();

        lastFrameTime = 0;
        raceAnimationId = requestAnimationFrame(raceLoop);
    }

    function raceLoop(currentTime) {
        if (lastFrameTime === 0) lastFrameTime = currentTime;
        const timeDelta = (currentTime - lastFrameTime) / 1000;
        lastFrameTime = currentTime;

        const activeStates = allBoatStates.slice(0, numberOfBoats);
        const allBoatsFinished = activeStates.every(s => s.isFinished);

        if (!allBoatsFinished) raceTime += timeDelta * raceSpeedMultiplier;

        timerEl.textContent = `${formatTime(raceTime)}`;

        activeStates.forEach((boatState, i) => {
            const opponentStates = activeStates.filter((_, j) => i !== j);
            updateBoat(allBoatData[i], boatState, opponentStates, timeDelta, raceSpeedMultiplier);
        });

        drawRaceCanvas();
        updateAllRowerDetailsUI();
        updateRaceInfoUI();

        if (allBoatsFinished) {
            cancelAnimationFrame(raceAnimationId);
            const finishedBoats = activeStates.map((state, i) => ({
                name: boatNames[i].textContent.trim(),
                time: state.finishTime
            })).sort((a, b) => a.time - b.time);

            let winnerText = `Race Finished! Winner: ${finishedBoats[0].name} (${formatTime(finishedBoats[0].time)})`;
            if (numberOfBoats === 3) {
                winnerText += `<br>2nd: ${finishedBoats[1].name} (${formatTime(finishedBoats[1].time)}) | 3rd: ${finishedBoats[2].name} (${formatTime(finishedBoats[2].time)})`;
            } else if (numberOfBoats === 2) {
                winnerText += `<br>2nd: ${finishedBoats[1].name} (${formatTime(finishedBoats[1].time)})`;
            }
            winnerMessageEl.innerHTML = winnerText;

            reraceBtn.classList.remove('d-none');
            reraceBtn.disabled = false;
            resetBoatsBtn.disabled = false;
            autofillBtn.disabled = false;
            setLineupsBtn.disabled = false;
            windSlider.disabled = false;
            boatCountSelect.disabled = false;
            boatNames.forEach(el => el.setAttribute('contenteditable', 'true'));
        } else {
            raceAnimationId = requestAnimationFrame(raceLoop);
        }
    }

    function updateBoat(boatData, boatState, opponentStates, timeDelta, speedMultiplier) {
        if (boatState.isFinished) return;

        const opponentDist = Math.max(0, ...opponentStates.map(s => s.distance));

        const {
            avgSpeed,
            strokeRate,
            individualStats
        } = calculateBoatPhysics(boatData, boatState, opponentDist);
        boatState.strokeRate = strokeRate;

        boatState.animationStrokeTime += timeDelta * speedMultiplier;

        const fullStrokeDuration = 60 / strokeRate;
        const driveDuration = fullStrokeDuration * 0.45;
        const recoveryDuration = fullStrokeDuration * 0.55;

        boatState.timeInPhase += timeDelta * speedMultiplier;
        if (boatState.phase === 'drive' && boatState.timeInPhase >= driveDuration) {
            boatState.phase = 'recovery';
            boatState.timeInPhase = 0;
        } else if (boatState.phase === 'recovery' && boatState.timeInPhase >= recoveryDuration) {
            boatState.phase = 'drive';
            boatState.timeInPhase = 0;
            boatState.strokeCount++;
            boatState.justCaught = true;
            for (let i = 0; i < 8; i++) {
                if (boatData[i]) {
                    const rowerTech = (i % 2 === 0) ? boatData[i].technique.port : boatData[i].technique.starboard;
                    boatState.rowerStats[i].quality = Math.max(1, Math.min(5, rowerTech + (Math.random() * 0.6) - 0.3));
                }
            }
        }

        individualStats.forEach((stat, i) => stat.quality = boatState.rowerStats[i].quality);
        boatState.rowerStats = individualStats;
        let velocityMultiplier = (boatState.phase === 'drive') ? 1 + 0.5 * Math.sin(boatState.timeInPhase / driveDuration * Math.PI) : 1 - 0.25 * (boatState.timeInPhase / recoveryDuration);
        const instantaneousVelocity = avgSpeed * velocityMultiplier;
        boatState.distance += instantaneousVelocity * timeDelta * speedMultiplier;

        if (boatState.distance >= 1500) {
            boatState.isFinished = true;
            const overshoot = boatState.distance - 1500;
            const timeOvershoot = instantaneousVelocity > 0 ? overshoot / instantaneousVelocity : 0;
            boatState.finishTime = raceTime - (timeOvershoot / speedMultiplier);
        }
    }

    function updateAllRowerDetailsUI() {
        allBoatStates.forEach((state, i) => {
            const detailsEl = boatDetailsEls[i];
            detailsEl.innerHTML = '';
            const grid = document.createElement('div');
            grid.className = 'boat-details-grid';
            state.rowerStats.forEach(stats => grid.appendChild(createStatCard(stats)));
            detailsEl.appendChild(grid);
        });
    }

    function updateRaceInfoUI() {
        allBoatStates.slice(0, numberOfBoats).forEach((state, i) => {
            const rateEl = boatRateEls[i];
            const splitEl = boatSplitEls[i];
            const qualityEl = boatAvgQualityEls[i];

            rateEl.textContent = `${state.strokeRate.toFixed(0)}`;
            if (raceTime > 0 && state.distance > 0 && !state.isFinished) {
                splitEl.textContent = formatTime((500 * raceTime) / state.distance);
                qualityEl.textContent = (state.rowerStats.reduce((sum, r) => sum + r.quality, 0) / 8).toFixed(1);
            }
        });
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
        boat3Data = Array(8).fill(null);
        allBoatData = [boat1Data, boat2Data, boat3Data];
        setupAllBoatLineups();
        resetAllBoatStates();
        raceTime = 0;

        timerEl.textContent = "0:00.0";
        boatRateEls.forEach(el => el.textContent = '0');
        boatSplitEls.forEach(el => el.textContent = '0:00.0');
        boatAvgQualityEls.forEach(el => el.textContent = '0.0');
        winnerMessageEl.textContent = '';

        startRaceBtn.disabled = false;
        startRaceBtn.classList.remove('d-none');
        reraceBtn.classList.add('d-none');
        resetBoatsBtn.disabled = false;
        autofillBtn.disabled = false;
        setLineupsBtn.disabled = false;
        windSlider.disabled = false;
        boatCountSelect.disabled = false;
        boatNames.forEach(el => el.setAttribute('contenteditable', 'true'));
        drawInitialCanvas();
    }

    function parseTimeToSeconds(timeStr) {
        return timeStr ? parseInt(timeStr.split(':')[0], 10) * 60 + parseFloat(timeStr.split(':')[1]) : 500;
    }

    function formatTime(totalSeconds) {
        if (totalSeconds === Infinity || isNaN(totalSeconds) || totalSeconds < 0) return "0:00.0";
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = (totalSeconds % 60).toFixed(1);
        return `${minutes}:${seconds.padStart(4, '0')}`;
    }

    function calculateBoatPhysics(boat, boatState, opponentDist) {
        if (boat.some(r => r === null)) return {
            avgSpeed: 0,
            strokeRate: 30,
            individualStats: []
        };
        let total2kSeconds = 0,
            totalWeight = 0;
        boat.forEach(rower => {
            total2kSeconds += parseTimeToSeconds(rower['2k']);
            totalWeight += rower.weight;
        });
        const avg500mSplit = (total2kSeconds / 8) / 4;
        const baseSpeed = 845 / Math.pow(avg500mSplit, 1.1);
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
        if ((isLosing && boatState.distance >= 1150) || (!isLosing && boatState.distance >= 1200)) {
            if (boatState.racePhase !== 'start') boatState.racePhase = 'sprint';
        }
        switch (boatState.racePhase) {
            case 'start':
                const stroke = boatState.strokeCount;
                if (stroke > 5) {
                    boatState.racePhase = 'power-20';
                } else {
                    switch (stroke) {
                        case 1:
                            currentRate = 40;
                            powerModifier = 0.50;
                            break;
                        case 2:
                            currentRate = 40;
                            powerModifier = 0.75;
                            break;
                        case 3:
                            currentRate = 44;
                            powerModifier = 0.75;
                            break;
                        case 4:
                            currentRate = 48;
                            powerModifier = 1.00;
                            break;
                        case 5:
                            currentRate = 48;
                            powerModifier = 1.00;
                            break;
                        default:
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
        const weightAdjustment = (170 - avgWeight) * 0.004;
        let windAdjustment = 0;
        const weightDifference = 170 - avgWeight;
        if (windCondition === 1) {
            windAdjustment = 0.169 + (weightDifference * 0.0015);
        } else if (windCondition === -1) {
            windAdjustment = -0.238 - (weightDifference * 0.0018);
        }
        const avgSpeed = baseSpeed + (totalTechAdjustment / 8) + (totalFollowingAdjustment / 7) + rateAdjustment + (totalMentalityAdjustment / 8) + weightAdjustment + windAdjustment;
        return {
            avgSpeed: Math.max(0, avgSpeed),
            strokeRate: currentRate,
            individualStats
        };
    }

    function drawInitialCanvas() {
        const finishPadding = 50;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(164, 186, 183, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 15]);

        const numLanes = numberOfBoats;
        for (let i = 1; i < numLanes; i++) {
            ctx.beginPath();
            ctx.moveTo(0, canvas.height * i / numLanes);
            ctx.lineTo(canvas.width, canvas.height * i / numLanes);
            ctx.stroke();
        }

        ctx.setLineDash([]);
        const finishLineX = canvas.width - finishPadding;
        ctx.fillStyle = '#a52422ff';
        ctx.fillRect(finishLineX, 0, 5, canvas.height);
    }

    function drawRaceCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawInitialCanvas();

        const colors = ['#a52422ff', '#eff2c0ff', '#bea57dff'];
        const activeBoats = allBoatStates.slice(0, numberOfBoats);

        activeBoats.forEach((boatState, i) => {
            const yPosition = canvas.height * (i + 0.5) / numberOfBoats;
            drawBoat(boatState, yPosition, colors[i], allBoatData[i]);
        });
    }

    function drawBoat(boatState, y, color, boatData) {
        const raceDistanceMeters = 1500,
            boatLengthMeters = 25,
            startPadding = 0,
            finishPadding = 50;
        const raceableWidth = canvas.width - startPadding - finishPadding;
        const boatLengthOnCanvas = (boatLengthMeters / raceDistanceMeters) * raceableWidth;
        const boatWidth = 5,
            riggerWidth = 6,
            oarInboard = 2,
            oarOutboard = 6;
        const sternX = startPadding + ((boatState.distance / raceDistanceMeters) * raceableWidth);
        const bowX = sternX + boatLengthOnCanvas;
        let swingAngle;
        const fullStrokeDuration = 60 / boatState.strokeRate,
            catchAngleDeg = -60,
            finishAngleDeg = 40,
            isDrivePhase = boatState.phase === 'drive';
        const driveDuration = fullStrokeDuration * 0.4,
            recoveryDuration = fullStrokeDuration * 0.6;
        let angle;
        if (isDrivePhase) {
            const progress = Math.min(1, boatState.timeInPhase / driveDuration);
            angle = catchAngleDeg + (finishAngleDeg - catchAngleDeg) * progress;
        } else {
            const progress = Math.min(1, boatState.timeInPhase / recoveryDuration);
            angle = finishAngleDeg + (catchAngleDeg - finishAngleDeg) * progress;
        }
        swingAngle = angle * (Math.PI / 180);
        boatState.splashes.forEach(s => {
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.1;
            s.life -= 0.03;
            ctx.globalAlpha = Math.max(0, s.life);
            ctx.fillStyle = 'rgba(164, 186, 183, 0.8)';
            ctx.fillRect(s.x, s.y, s.size, s.size);
            ctx.globalAlpha = 1;
        });
        boatState.splashes = boatState.splashes.filter(s => s.life > 0);
        for (let i = 0; i < 8; i++) {
            const seatX = bowX - ((i + 1.5) * (boatLengthOnCanvas / 9));
            const isPort = (i + 1) % 2 === 0;
            const sideOffset = isPort ? -riggerWidth : riggerWidth;
            const oarlockX = seatX,
                oarlockY = y + sideOffset;
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
            const bladeWidth = isDrivePhase ? 4 : 1;
            ctx.fillRect(-bladeWidth / 2 + 1.5, oarOutboard - 3, bladeWidth, 5);
            ctx.restore();
            if (boatState.justCaught && boatData[i]) {
                const quality = boatState.rowerStats[i].quality,
                    numParticles = Math.max(0, Math.floor((5.5 - quality) * 2));
                const catchAngleRad = catchAngleDeg * (Math.PI / 180),
                    oarRotation = isPort ? -catchAngleRad : -catchAngleRad;
                const bladeTipX = oarlockX - Math.sin(oarRotation) * oarOutboard,
                    bladeTipY = oarlockY + Math.cos(oarRotation) * oarOutboard * (isPort ? -1 : 1);
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
        if (boatState.justCaught) boatState.justCaught = false;
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
    boatCountSelect.addEventListener('change', updateBoatCount);
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