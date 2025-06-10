document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const mainGrid = document.querySelector('.main-grid');
    const rosterList = document.getElementById('roster-list');
    const coxswainList = document.getElementById('coxswain-list');
    const rosterSearch = document.getElementById('roster-search');
    const rosterCardPopup = document.getElementById('roster-card-popup');
    const telemetryPanel = document.querySelector('.telemetry-panel');
    const boat3Elements = document.querySelectorAll('.boat-3-element');
    const lineupLibraryBtns = document.querySelectorAll('.lineup-library-btn');
    const lineupLibraryModal = document.getElementById('lineup-library-modal');
    const lineupOptionsContainer = document.getElementById('lineup-options-container');
    const coxswainSearch = document.getElementById('coxswain-roster-search');

    // Boat Elements (Grouped)
    const boatNames = [document.getElementById('boat1-name'), document.getElementById('boat2-name'), document.getElementById('boat3-name')];
    const telemetryBoatNames = [document.getElementById('boat1-telemetry-name'), document.getElementById('boat2-telemetry-name'), document.getElementById('boat3-telemetry-name')];
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
    let allCoxswains = [];
    let predefinedLineups = [];
    let boat1Data = Array(8).fill(null);
    let boat2Data = Array(8).fill(null);
    let boat3Data = Array(8).fill(null);
    let boat1Coxswain = null;
    let boat2Coxswain = null;
    let boat3Coxswain = null;
    let allBoatData = [boat1Data, boat2Data, boat3Data];
    let allBoatCoxswains = [boat1Coxswain, boat2Coxswain, boat3Coxswain];
    let selectedBoatIndex = 0; // For the lineup library modal

    let raceAnimationId;
    let raceSpeedMultiplier = 1;
    let windCondition = 0;
    let numberOfBoats = 2; // Changed default to 2
    let lastFrameTime = 0;
    let raceTime = 0;
    let boat1State = {};
    let boat2State = {};
    let boat3State = {};
    let allBoatStates = [boat1State, boat2State, boat3State];

    // Bootstrap modal instance
    let lineupModal;

    // --- INITIALIZATION ---
    Promise.all([
        fetch('rowers.json').then(response => response.json()),
        fetch('coxswains.json').then(response => response.json()),
        fetch('lineups.json').then(response => response.json())
    ]).then(([rowerData, coxswainData, lineupData]) => {
        allRowers = rowerData;
        allCoxswains = coxswainData;
        predefinedLineups = lineupData;
        initialize();
    }).catch(error => {
        console.error('Error loading data:', error);
    });

    function initialize() {
        renderRosterList();
        renderCoxswainList();
        setupAllBoatLineups();
        resetAllBoatStates();
        setCanvasSize();
        setupContentEditableListeners();
        updateTelemetryHeaders();
        setupLineupLibraryButtons();
        window.addEventListener('resize', setCanvasSize);

        // Add two-boats-mode class to body since default is now 2 boats
        document.body.classList.add('two-boats-mode');

        // Initialize Bootstrap modal
        lineupModal = new bootstrap.Modal(lineupLibraryModal);
    }

    function setupLineupLibraryButtons() {
        // Setup lineup library buttons
        lineupLibraryBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                selectedBoatIndex = parseInt(e.currentTarget.dataset.boat) - 1;
                document.getElementById('lineupLibraryModalLabel').textContent =
                    `Select Lineup for ${boatNames[selectedBoatIndex].textContent}`;

                // Generate lineup options from the predefined lineups
                lineupOptionsContainer.innerHTML = '';
                predefinedLineups.forEach((lineup, index) => {
                    const option = document.createElement('button');
                    option.type = 'button';
                    option.className = 'list-group-item list-group-item-action bg-dark text-light';
                    option.dataset.lineupIndex = index;

                    // Get last names only
                    const lastNames = lineup.rowers.map(fullName => {
                        const nameParts = fullName.split(' ');
                        return nameParts[nameParts.length - 1]; // Get the last part of the name
                    });

                    // Create summary of rowers for display with last names only
                    const rowerSummary = lastNames.join(', ');

                    // Get coxswain last name
                    const coxswainName = lineup.coxswain ? lineup.coxswain.split(' ').pop() : 'None';

                    option.innerHTML = `
                        <strong>${lineup.name}</strong>
                        <small class="d-block text-secondary">Cox: ${coxswainName} | ${rowerSummary}</small>
                    `;

                    option.addEventListener('click', () => applyLineup(index));

                    lineupOptionsContainer.appendChild(option);
                });

                lineupModal.show();
            });
        });
    }

    function applyLineup(lineupIndex) {
        const lineup = predefinedLineups[lineupIndex];

        if (lineup) {
            // Set the rowers in the boat
            allBoatData[selectedBoatIndex] = lineup.rowers.map(name =>
                allRowers.find(rower => rower.name === name) || null
            );

            // Set the coxswain in the boat
            allBoatCoxswains[selectedBoatIndex] = lineup.coxswain ?
                allCoxswains.find(cox => cox.name === lineup.coxswain) || null : null;

            // Set the boat name to match the lineup name
            boatNames[selectedBoatIndex].textContent = lineup.name;

            // Update UI
            setupAllBoatLineups();
            updateTelemetryHeaders();
            lineupModal.hide();
        }
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
            power10Active: false,
            power10StartTime: 0,
            power10Cooldown: false,
            steeringAngle: 0,
            steeringAngularVelocity: 0,
            yPosition: 0, // Will be set properly below
            rowerStats: Array(8).fill({
                name: 'Empty',
                watts: 0,
                quality: 0
            }),
            coxswainStats: {
                name: 'None',
                motivationBoost: 0,
                strategyTiming: 0,
                techCallBoost: 0,
                steeringQuality: 3
            },
            puddles: [],
            splashes: [],
            justCaught: false,
            animationStrokeTime: 0,
            powerModifier: 0,
        }));

        // Set proper initial Y positions based on current canvas size
        allBoatStates.forEach((state, index) => {
            const laneHeight = canvas.height / numberOfBoats;
            state.yPosition = laneHeight * (index + 0.5);
        });

        updateAllRowerDetailsUI();
    }

    function updateTelemetryHeaders() {
        boatNames.forEach((nameEl, index) => {
            const currentName = nameEl.textContent.trim() || `Boat ${index + 1}`;
            telemetryBoatNames[index].textContent = `${currentName} Telemetry`;
        });
    }

    function setupContentEditableListeners() {
        boatNames.forEach(nameEl => {
            nameEl.addEventListener('input', updateTelemetryHeaders);

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
                hideRosterCardPopup();
                e.dataTransfer.setData('text/plain', e.target.dataset.rowerName);
                e.dataTransfer.setData('cardType', 'rower');
                setTimeout(() => e.target.classList.add('dragging'), 0);
            });
            card.addEventListener('dragend', e => e.target.classList.remove('dragging'));
            card.addEventListener('mouseover', (event) => showRowerCardPopup(event, rower));
            card.addEventListener('mouseout', hideRosterCardPopup);
            card.addEventListener('mousemove', (event) => {
                rosterCardPopup.style.left = `${event.pageX + 20}px`;
                rosterCardPopup.style.top = `${event.pageY + 20}px`;
            });
            rosterList.appendChild(card);
        });
    }

    function renderCoxswainList(filter = '') {
        coxswainList.innerHTML = '';
        const lowerCaseFilter = filter.toLowerCase();
        const filteredCoxswains = allCoxswains.filter(coxswain => coxswain.name.toLowerCase().includes(lowerCaseFilter));

        filteredCoxswains.forEach(coxswain => {
            const card = createCoxswainCard(coxswain);
            card.draggable = true;
            card.addEventListener('dragstart', e => {
                hideRosterCardPopup();
                e.dataTransfer.setData('text/plain', e.target.dataset.coxswainName);
                e.dataTransfer.setData('cardType', 'coxswain');
                setTimeout(() => e.target.classList.add('dragging'), 0);
            });
            card.addEventListener('dragend', e => e.target.classList.remove('dragging'));
            card.addEventListener('mouseover', (event) => showCoxswainCardPopup(event, coxswain));
            card.addEventListener('mouseout', hideRosterCardPopup);
            card.addEventListener('mousemove', (event) => {
                rosterCardPopup.style.left = `${event.pageX + 20}px`;
                rosterCardPopup.style.top = `${event.pageY + 20}px`;
            });
            coxswainList.appendChild(card);
        });
    }

    function setupAllBoatLineups() {
        allBoatData.forEach((boatData, boatIndex) => {
            const lineupEl = boatLineups[boatIndex];
            lineupEl.innerHTML = '';

            // Create coxswain slot
            const coxswainSlot = document.createElement('div');
            coxswainSlot.className = 'coxswain-slot d-flex justify-content-between align-items-center';
            coxswainSlot.dataset.boat = boatIndex + 1;

            const coxswainLabel = document.createElement('span');
            coxswainLabel.className = 'coxswain-slot-label';
            coxswainLabel.textContent = 'Coxswain';
            coxswainSlot.appendChild(coxswainLabel);

            const coxswain = allBoatCoxswains[boatIndex];
            if (coxswain) {
                coxswainSlot.classList.add('has-coxswain');
                coxswainSlot.appendChild(createCoxswainCard(coxswain));
            }

            lineupEl.appendChild(coxswainSlot);

            // Add coxswain slot listeners
            addCoxswainSlotListeners(coxswainSlot);

            // Create rower slots
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
        updateCoxswainStats();
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

    function updateCoxswainStats() {
        allBoatStates.forEach((state, index) => {
            const coxswain = allBoatCoxswains[index];
            if (coxswain) {
                state.coxswainStats = {
                    name: coxswain.name,
                    motivationBoost: coxswain.motivation * 0.05, // 5% boost per star
                    strategyTiming: coxswain.strategy,
                    techCallBoost: coxswain.tech_calls * 0.1, // 0.25 quality points per star
                    steeringQuality: coxswain.steering
                };
            } else {
                state.coxswainStats = {
                    name: 'None',
                    motivationBoost: 0,
                    strategyTiming: 0,
                    techCallBoost: 0,
                    steeringQuality: 3
                };
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

    function createCoxswainCard(coxswain) {
        const card = document.createElement('div');
        card.className = 'coxswain-card';
        card.dataset.coxswainName = coxswain.name;
        card.textContent = coxswain.name;
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
                <div class="popup-header-right">
                    <span class="rower-2k">${rower['2k']}</span>
                    <span class="rower-grad-year">Class of ${rower.graduation_year}</span>
                </div>
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

    function showCoxswainCardPopup(event, coxswain) {
        const rarityName = coxswain.rarity || 'Common';
        rosterCardPopup.className = `rarity-${rarityName}`; // Set class for border color
        rosterCardPopup.innerHTML = `
            <div class="popup-header">
                <div class="popup-name-section">
                    <h4>${coxswain.name}</h4>
                    <p class="rarity-text">${rarityName}</p> 
                </div>
                <div class="popup-header-right">
                    <span class="rower-grad-year">Class of ${coxswain.graduation_year}</span>
                </div>
            </div>
            <div class="popup-divider"></div>
            <div class="popup-stats-grid">
                <div class="popup-stat">
                    <span class="stat-label">Motivation</span>
                    <span class="stat-value">${coxswain.motivation.toFixed(1)} ★</span>
                </div>
                <div class="popup-stat">
                    <span class="stat-label">Strategy</span>
                    <span class="stat-value">${coxswain.strategy.toFixed(1)} ★</span>
                </div>
                <div class="popup-stat">
                    <span class="stat-label">Tech Calls</span>
                    <span class="stat-value">${coxswain.tech_calls.toFixed(1)} ★</span>
                </div>
                <div class="popup-stat">
                    <span class="stat-label">Steering</span>
                    <span class="stat-value">${coxswain.steering.toFixed(1)} ★</span>
                </div>
            </div>
        `;
        rosterCardPopup.style.left = `${event.pageX + 20}px`;
        rosterCardPopup.style.top = `${event.pageY + 20}px`;
        rosterCardPopup.style.display = 'block';
    }

    function hideRosterCardPopup() {
        rosterCardPopup.style.display = 'none';
    }

    function addSeatListeners(seat) {
        seat.addEventListener('dragover', e => {
            e.preventDefault();
            const cardType = e.dataTransfer.getData('cardType');
            if (cardType === 'rower' || cardType === '') {
                seat.classList.add('drag-over');
            }
        });
        seat.addEventListener('dragleave', () => seat.classList.remove('drag-over'));
        seat.addEventListener('drop', e => {
            e.preventDefault();
            seat.classList.remove('drag-over');
            const cardType = e.dataTransfer.getData('cardType');

            if (cardType === 'coxswain') return; // Don't allow coxswains in rower seats

            const rowerName = e.dataTransfer.getData('text/plain');
            const rower = allRowers.find(r => r.name === rowerName);
            if (!rower) return;

            const boatNum = parseInt(seat.dataset.boat);
            const seatIndex = parseInt(seat.dataset.seat);

            allBoatData[boatNum - 1][seatIndex] = rower;

            setupAllBoatLineups();
        });
    }

    function addCoxswainSlotListeners(slot) {
        slot.addEventListener('dragover', e => {
            e.preventDefault();
            const cardType = e.dataTransfer.getData('cardType');
            if (cardType === 'coxswain' || cardType === '') {
                slot.classList.add('drag-over');
            }
        });
        slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
        slot.addEventListener('drop', e => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            const cardType = e.dataTransfer.getData('cardType');

            if (cardType === 'rower') return; // Don't allow rowers in coxswain slot

            const coxswainName = e.dataTransfer.getData('text/plain');
            const coxswain = allCoxswains.find(c => c.name === coxswainName);
            if (!coxswain) return;

            const boatNum = parseInt(slot.dataset.boat);
            allBoatCoxswains[boatNum - 1] = coxswain;

            setupAllBoatLineups();
        });
    }

    function autofillBoats() {
        // --- 1) Fill Coxswains ---
        // Simply assign a random coxswain into each empty slot
        for (let i = 0; i < numberOfBoats; i++) {
            if (!allBoatCoxswains[i] && allCoxswains.length > 0) {
                const idx = Math.floor(Math.random() * allCoxswains.length);
                allBoatCoxswains[i] = allCoxswains[idx];
            }
        }

        // --- 2) Fill Rowing Seats Boat by Boat ---
        for (let boatIndex = 0; boatIndex < numberOfBoats; boatIndex++) {
            const lineup = allBoatData[boatIndex];

            // Build a fresh pool of rowers excluding anyone already in this boat
            let pool = allRowers.filter(r =>
                !lineup.some(seat => seat && seat.name === r.name)
            );

            // Assign a random rower into each empty seat
            for (let seat = 0; seat < 8; seat++) {
                if (!lineup[seat] && pool.length > 0) {
                    const idx = Math.floor(Math.random() * pool.length);
                    lineup[seat] = pool.splice(idx, 1)[0];
                }
            }
        }

        // Re-render the lineups in the UI
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
        const coxswainsToRace = allBoatCoxswains.slice(0, numberOfBoats);

        // Check if all boats have rowers
        if (boatsToRace.some(boat => boat.some(r => r === null))) {
            alert(`All ${numberOfBoats} boats must be full (8 rowers) to start the race.`);
            return;
        }

        // Check if all boats have coxswains
        if (coxswainsToRace.some(cox => cox === null)) {
            alert(`All ${numberOfBoats} boats must have a coxswain to start the race.`);
            return;
        }

        startRaceBtn.disabled = true;
        startRaceBtn.classList.add('d-none');
        reraceBtn.classList.add('d-none');
        resetBoatsBtn.disabled = true;
        autofillBtn.disabled = true;
        windSlider.disabled = true;
        boatCountSelect.disabled = true;
        lineupLibraryBtns.forEach(btn => btn.disabled = true);
        boatNames.forEach(el => el.setAttribute('contenteditable', 'false'));
        winnerMessageEl.textContent = '';
        raceTime = 0;
        resetAllBoatStates();
        updateCoxswainStats();

        lastFrameTime = 0;
        raceAnimationId = requestAnimationFrame(raceLoop);
    }

    function raceLoop(currentTime) {
        if (lastFrameTime === 0) {
            lastFrameTime = currentTime;
        }

        // Compute elapsed time (in seconds) since last frame
        let timeDelta = (currentTime - lastFrameTime) / 1000;

        // Cap timeDelta to prevent huge jumps on slow frames
        const MAX_TIME_DELTA = 0.02; // 20ms maximum step
        timeDelta = Math.min(timeDelta, MAX_TIME_DELTA);

        lastFrameTime = currentTime;

        const activeStates = allBoatStates.slice(0, numberOfBoats);
        const allBoatsFinished = activeStates.every(s => s.isFinished);

        if (!allBoatsFinished) raceTime += timeDelta * raceSpeedMultiplier;

        timerEl.textContent = `${formatTime(raceTime)}`;

        activeStates.forEach((boatState, i) => {
            const opponentStates = activeStates.filter((_, j) => i !== j);
            updateBoat(allBoatData[i], boatState, i, opponentStates, timeDelta, raceSpeedMultiplier);
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
            windSlider.disabled = false;
            boatCountSelect.disabled = false;
            lineupLibraryBtns.forEach(btn => btn.disabled = false);
            boatNames.forEach(el => el.setAttribute('contentedelta', 'true'));
        } else {
            raceAnimationId = requestAnimationFrame(raceLoop);
        }
    }

    function updateBoat(boatData, boatState, boatIndex, opponentStates, normalizedDelta, speedMultiplier) {
        if (boatState.isFinished) return;

        const opponentDist = Math.max(0, ...opponentStates.map(s => s.distance));

        // Check for Power 10 condition
        if (!boatState.power10Active && !boatState.power10Cooldown && boatState.distance >= 500 && boatState.distance <= 1000) {
            // Calculate how close we are to the ideal power 10 point (750m)
            const distanceFrom750 = Math.abs(boatState.distance - 750);
            const strategyTiming = boatState.coxswainStats.strategyTiming;

            // The better the strategy timing, the more likely the power 10 will be called close to 750m
            // 5 stars means almost perfect timing
            const maxDeviation = 150 - (strategyTiming * 20); // 50m deviation for 5 star, 150m for 0 star

            if (distanceFrom750 < maxDeviation && Math.random() < 0.1) { // 10% chance per update to call power 10
                boatState.power10Active = true;
                boatState.power10StartTime = raceTime;

                // Create power 10 indicator
                const boatPanel = document.getElementById(`boat${boatIndex + 1}-panel`);
                if (boatPanel) {
                    const indicator = document.createElement('div');
                    indicator.className = 'power10-indicator';
                    indicator.textContent = 'POWER 10!';
                    indicator.id = `boat${boatIndex + 1}-power10`;
                    boatPanel.appendChild(indicator);
                    //...
                    indicator.style.display = 'block';

                    // Remove after 3 seconds
                    setTimeout(() => {
                        if (indicator && indicator.parentNode) {
                            indicator.parentNode.removeChild(indicator);
                        }
                    }, 3000);
                }
            }
        }

        // Handle power 10 logic
        if (boatState.power10Active) {
            const power10Duration = 10 / boatState.strokeRate * 60; // 10 strokes duration
            if (raceTime - boatState.power10StartTime > power10Duration) {
                boatState.power10Active = false;
                boatState.power10Cooldown = true;
            }
        }

        // --- New Steering Logic ---
        const steeringQuality = boatState.coxswainStats.steeringQuality;

        // 1. Random "pushes" on the rudder. Less skilled coxswains cause bigger pushes.
        const randomPush = (6 - steeringQuality) * 0.1 * (Math.random() - 0.5);

        // 2. Corrective force. More skilled coxswains correct faster.
        const correctionForce = -boatState.steeringAngle * 0.5 * (steeringQuality / 5);

        // 3. Damping force. Prevents the boat from oscillating wildly.
        const dampingForce = -boatState.steeringAngularVelocity * 0.8;

        // 4. Calculate total angular acceleration and update velocity.
const angularAcceleration = randomPush + correctionForce + dampingForce;
// Use fixed timestep for consistent physics across devices
const FIXED_PHYSICS_TIMESTEP = 1/480; // 60 FPS equivalent
boatState.steeringAngularVelocity += angularAcceleration * FIXED_PHYSICS_TIMESTEP * speedMultiplier;

// 5. Update the boat's angle and cap it to prevent spinning.
boatState.steeringAngle += boatState.steeringAngularVelocity * FIXED_PHYSICS_TIMESTEP * speedMultiplier;
        boatState.steeringAngle = Math.max(-0.2, Math.min(0.2, boatState.steeringAngle)); // Approx +/- 3 degrees

        const {
            avgSpeed,
            strokeRate,
            individualStats
        } = calculateBoatPhysics(boatData, boatState, opponentDist);
        boatState.strokeRate = strokeRate;

        boatState.animationStrokeTime += normalizedDelta * speedMultiplier;

        const fullStrokeDuration = 60 / strokeRate;
        const driveDuration = fullStrokeDuration * 0.45;
        const recoveryDuration = fullStrokeDuration * 0.55;

        boatState.timeInPhase += normalizedDelta * speedMultiplier;
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
                    // Add coxswain tech call boost to base rower technique
                    const techWithBoost = rowerTech + boatState.coxswainStats.techCallBoost;
                    boatState.rowerStats[i].quality = Math.max(1, Math.min(5, techWithBoost + (Math.random() * 0.6) - 0.3));
                }
            }
        }

        individualStats.forEach((stat, i) => stat.quality = boatState.rowerStats[i].quality);
        boatState.rowerStats = individualStats;
        let velocityMultiplier = (boatState.phase === 'drive') ? 1 + 0.5 * Math.sin(boatState.timeInPhase / driveDuration * Math.PI) : 1 - 0.25 * (boatState.timeInPhase / recoveryDuration);

        // Apply steering penalty to velocity based on the angle
        const steeringPenalty = Math.abs(boatState.steeringAngle) * 2; // Penalty for being off-course
        velocityMultiplier *= (1 - steeringPenalty);

        const instantaneousVelocity = avgSpeed * velocityMultiplier;

        // Calculate movement components based on steering angle
        const forwardMovement = instantaneousVelocity * Math.cos(boatState.steeringAngle);
        const lateralMovement = instantaneousVelocity * Math.sin(boatState.steeringAngle);

        // Update position
        boatState.distance += forwardMovement * normalizedDelta * speedMultiplier;
        boatState.yPosition += lateralMovement * normalizedDelta * speedMultiplier;

        // Optional: Add soft boundaries to prevent boats from going completely off-screen
        const laneHeight = canvas.height / numberOfBoats;
        const minY = laneHeight * 0.1; // 10% margin from top
        const maxY = canvas.height - (laneHeight * 0.1); // 10% margin from bottom
        boatState.yPosition = Math.max(minY, Math.min(maxY, boatState.yPosition));

        if (boatState.distance >= 1500) {
            boatState.isFinished = true;
            const overshoot = boatState.distance - 1500;
            const timeOvershoot = instantaneousVelocity > 0 ? overshoot / instantaneousVelocity : 0;
            boatState.finishTime = raceTime - (timeOvershoot / speedMultiplier);

            // Remove power 10 indicator if it exists
            const indicator = document.getElementById(`boat${boatIndex + 1}-power10`);
            if (indicator && indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }
    }

    function updateAllRowerDetailsUI() {
        allBoatStates.forEach((state, i) => {
            const detailsEl = boatDetailsEls[i];
            detailsEl.innerHTML = '';

            // Add rower cards
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
        boat1Coxswain = null;
        boat2Coxswain = null;
        boat3Coxswain = null;
        allBoatData = [boat1Data, boat2Data, boat3Data];
        allBoatCoxswains = [boat1Coxswain, boat2Coxswain, boat3Coxswain];

        boatNames.forEach((el, i) => {
            el.textContent = `Boat ${i + 1}`;
            el.setAttribute('contenteditable', 'true');
        });
        updateTelemetryHeaders();

        setupAllBoatLineups();
        resetAllBoatStates();
        raceTime = 0;

        timerEl.textContent = "0:00.0";
        boatRateEls.forEach(el => el.textContent = '0');
        boatSplitEls.forEach(el => el.textContent = '0:00.0');
        boatAvgQualityEls.forEach(el => el.textContent = '0.0');
        winnerMessageEl.textContent = '';

        // Clear any power 10 indicators
        for (let i = 1; i <= 3; i++) {
            const indicator = document.getElementById(`boat${i}-power10`);
            if (indicator && indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }

        startRaceBtn.disabled = false;
        startRaceBtn.classList.remove('d-none');
        reraceBtn.classList.add('d-none');
        resetBoatsBtn.disabled = false;
        autofillBtn.disabled = false;
        windSlider.disabled = false;
        boatCountSelect.disabled = false;
        lineupLibraryBtns.forEach(btn => btn.disabled = false);
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
        const baseSpeed = 207.5 / Math.pow(avg500mSplit, 0.80);
        let powerModifier = 1.0,
            totalTechAdjustment = 0,
            totalFollowingAdjustment = 0,
            totalRateDifference = 0,
            totalMentalityAdjustment = 0;
        let individualStats = [];
        const isLosing = boatState.distance < opponentDist;
        const strokeRower = boat[0];
        const baseRate = strokeRower ? strokeRower.best_rate : 36;
        let currentRate = baseRate;

        // Race phase management
        if ((isLosing && boatState.distance >= 1100) || (!isLosing && boatState.distance >= 1200)) {
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

        // Power 10 effect - MOVED TO AFTER THE SWITCH STATEMENT
        let power10Modifier = 1.0;
        if (boatState.power10Active) {
            // Calculate how timing affects Power 10 strength
            const distanceFrom750 = Math.abs(boatState.distance - 750);
            const timingFactor = 1 - Math.min(1, distanceFrom750 / 250);
            const maxBoost = 0.15; // 15% boost when perfectly timed
            const maxRateBoost = 2; // +2 spm when perfectly timed

            // Scale both speed boost and rate boost by timingFactor
            const boost = maxBoost * timingFactor;
            power10Modifier = 1 + boost;

            const rateBoost = maxRateBoost * timingFactor;
            currentRate += rateBoost;
        }

        // Apply coxswain's motivation effect to each rower
        const motivationMultiplier = 1 + boatState.coxswainStats.motivationBoost;

        boat.forEach((rower, index) => {
            const splitSeconds = parseTimeToSeconds(rower['2k']) / 4;
            const baseWatts = 2.80 / Math.pow(splitSeconds / 500, 3);
            const qualityWattsModifier = 1.0 + (boatState.rowerStats[index].quality - 4.0) * 0.02;

            // Apply coxswain's motivation boost and power 10 effect to wattage
            const actualWatts = baseWatts * powerModifier * ((boatState.racePhase === 'sprint') ? 1.05 : 1.0) *
                qualityWattsModifier * motivationMultiplier * power10Modifier;

            const strokeQuality = boatState.rowerStats[index].quality;
            totalTechAdjustment += (strokeQuality - 4.5) * 0.15; // Reduced from 0.20
            if (isLosing) totalMentalityAdjustment += (rower.mentality - 4.0) * 0.004;
            if (boatState.racePhase === 'sprint') totalMentalityAdjustment += (rower.mentality - 4.0) * 0.020;
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
            windAdjustment = 0.135 + (weightDifference * 0.0035); // Slightly reduced tailwind benefit
        } else if (windCondition === -1) {
            windAdjustment = -0.225 - (weightDifference * 0.0015); // Adjusted for correct headwind impact
        }

        // Apply all adjustments to base speed
        const avgSpeed = baseSpeed + (totalTechAdjustment / 8) + (totalFollowingAdjustment / 7) +
            rateAdjustment + (totalMentalityAdjustment / 8) + weightAdjustment +
            windAdjustment;

        // Apply power 10 effect to final speed
        const finalSpeed = avgSpeed * power10Modifier;

        return {
            avgSpeed: Math.max(0, finalSpeed),
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
            // Use the boat's actual Y position instead of fixed lane center
            const yPosition = boatState.yPosition;
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

        // Use the calculated steering angle from boatState
        const steeringAngle = boatState.steeringAngle || 0;

        // Save context for boat rotation
        ctx.save();
        ctx.translate(sternX + boatLengthOnCanvas * 0.5, y);
        ctx.rotate(steeringAngle);
        ctx.translate(-(sternX + boatLengthOnCanvas * 0.5), -y);

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

        // Draw boat hull with steering angle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(bowX, y);
        ctx.bezierCurveTo(sternX + boatLengthOnCanvas * 0.7, y - boatWidth / 2, sternX + boatLengthOnCanvas * 0.3, y - boatWidth / 2, sternX, y);
        ctx.bezierCurveTo(sternX + boatLengthOnCanvas * 0.3, y + boatWidth / 2, sternX + boatLengthOnCanvas * 0.7, y + boatWidth / 2, bowX, y);
        ctx.closePath();
        ctx.fill();

        // Restore context after boat rotation
        ctx.restore();

        if (boatState.justCaught) boatState.justCaught = false;
    }

    // --- GLOBAL EVENT LISTENERS ---
    startRaceBtn.addEventListener('click', startRace);
    reraceBtn.addEventListener('click', startRace);
    resetBoatsBtn.addEventListener('click', resetBoats);
    autofillBtn.addEventListener('click', autofillBoats);
    boatCountSelect.addEventListener('change', updateBoatCount);
    coxswainSearch.addEventListener('input', (e) => renderCoxswainList(e.target.value));
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