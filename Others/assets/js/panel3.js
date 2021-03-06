// ------------------------------ DECLARATIONS AND INITIALIZATIONS ------------------------------

// Assign DOM elements to global variables (unnecessary in most browsers when names coincide):
var canvas = document.getElementById('theCanvas');
var context = canvas.getContext('2d');
var canvasDiv = document.getElementById('canvasDiv');
var startButton = document.getElementById('startButton');
var nReadout = document.getElementById('nReadout');
var nSlider = document.getElementById('nSlider');
var sizeReadout = document.getElementById('sizeReadout');
var sizeSlider = document.getElementById('sizeSlider');
var gravReadout = document.getElementById('gravReadout');
var gravSlider = document.getElementById('gravSlider');
var gravx10 = document.getElementById('gravx10');
var dtReadout = document.getElementById('dtReadout');
var dtSlider = document.getElementById('dtSlider');
var stepsReadout = document.getElementById('stepsReadout');
var stepsSlider = document.getElementById('stepsSlider');
var presetSelect = document.getElementById('presetSelect');
var mouseSelect = document.getElementById('mouseSelect');
var bondSelect = document.getElementById('bondSelect');
var mColorSelect = document.getElementById('mColorSelect');
var bgColorSelect = document.getElementById('bgColorSelect');
//var cellListCheck = document.getElementById('cellListCheck');	// for diagnostic tests
var selectDataPanel = document.getElementById('selectDataPanel');
var fixTPanel = document.getElementById('fixTPanel');
var atomNumber = document.getElementById('atomNumber');
var atomTemp = document.getElementById('atomTemp');
var tempSlider = document.getElementById('tempSlider');
var dataReadout = document.getElementById('dataReadout');
var moreButton = document.getElementById('moreButton');
var dataPanel = document.getElementById('dataPanel');
var energyReadout = document.getElementById('energyReadout');
var dataArea = document.getElementById('dataArea');
var dataSelect = document.getElementById('dataSelect');
var autoIntervalControl = document.getElementById('autoIntervalControl');
var autoDataSelect = document.getElementById('autoDataSelect');
var moreDetailCheckPanel = document.getElementById('moreDetailCheckPanel');
var moreDetailCheck = document.getElementById('moreDetailCheck');
var allAtomsDataButtons = document.getElementById('allAtomsDataButtons');

// Miscellaneous global variables:
var mobile = navigator.userAgent.match(/iPhone|iPad|iPod|Android|BlackBerry|Opera Mini|IEMobile|Kindle/i)
var nMax = Number(nSlider.max);				// maximum number of molecules
var N = 0;									// current number of molecules
var time = 0;								// simulation time in natural units
var kineticE, potentialE, gravitationalE;	// energies
var averageT = 0, averageP = 0;				// temperature and pressure averaged over time
var pressure;								// instantaneous P, computed each step
var totalT, totalP, sampleCount;			// variables for computing average T and P
var lastSampleTime = 0;						// simulation time when T and P were last sampled
var lastAutoRecordTime = 0;					// used for auto-recording data at regular intervals
var momentumX, momentumY;					// total momentum of system
var pxPerUnit = 1;							// molecule diameter in pixels (dummy value until init)
var boxWidth = canvas.width / pxPerUnit;	// width of box in natural units
var running = false;						// will be true when running
var stepCount = 0;							// number of calculation steps (used to monitor performance)
var startTime = 0;							// clock time when stepCount was zero
var selectedAtom = -1;						// index of atom selected for highlight/data (-1 if none)
var clickedAtom = 0;						// index of atom that was clicked on
var dragging = false;						// true when mouse (or touch) action is in progress
var viscosity = true;						// set true by default
var mouseX, mouseY;							// mouse coordinates in physics units (valid when dragging)
var drawingBond = false;					// true when we're creating a bond between atoms
var recentSizeDecrease = false;				// true for brief time after size is increased, to limit rate
var targetSize;								// box size that we're moving toward, if resize in progress
var sizeStepTimer = 0;						// timer (in simulation units) that counts down until next resize step

// Arrays of atoms' positions, velocities, and accelerations:
var x = new Array(nMax), y = new Array(nMax);
var vx = new Array(nMax), vy = new Array(nMax);
var ax = new Array(nMax), ay = new Array(nMax);
var atomColor = new Array(nMax);	// and colors!

// Carefully constructed list of colors for indicating speeds:
var speedColorList = ['#0000e0', '#0000ff', '#4800f4', '#6000e8', '#7800d0', '#9000b0', '#b00080',
    '#d00060', '#e80030', '#ff0000', '#ff3800', '#ff5000', '#ff6800', '#ff8000',
    '#ff9600', '#ffb400', '#ffd200', '#ffe600', '#ffff00', '#ffff78'];

// List of colors for selected atom, chosen to contrast with colors of the rest (kindof a kludge):
var selectedAtomColor = ['#00ff00', '#ff00ff', '#00ff00', '#00ff00', '#00ff00', '#00ff00', '#ff00ff',
    '#00ff00', '#00ff00', '#00ff00', '#00ff00', '#808080', '#00ff00'];

var fixedCount = 0;						// number of atoms that are fixed (anchored)
var fixedList = new Array(nMax);		// list of indices of fixed atoms
var maxBonds = nMax * 3;				// maximum number of bonded pairs
var bondCount = 0;						// current number of bonds
var bondList = new Array(maxBonds * 2);	// entry 0 is bonded to 1, 2 to 3, etc.
var fixedTList = new Array();			// list of fixed-T atoms

// Mysterious incantation that sometimes helps for smooth animation:
window.requestAnimFrame = (function (callback) {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1);		// second parameter is time in ms
        };
})();

window.onload = init;

// Initializations
function init() {
    // initialize differently for computers and mobile devices:
    if (mobile) sizeSlider.value = "25"; else sizeSlider.value = "50";
    if (mobile) nSlider.value = "100"; else nSlider.value = "500";
    changeSize();
    changeN();

    // fill the presets menu:
    for (var item = 0; item < presetList.length; item++) {
        var thePreset = document.createElement("option");
        thePreset.text = presetList[item].name;
        presetSelect.add(thePreset, null);
    }

    // register mouse/touch event listeners:
    canvas.addEventListener('mousedown', mouseDown, false);
    document.body.addEventListener('mousemove', mouseMove, false);
    document.body.addEventListener('mouseup', mouseUp, false);	// button release could occur outside canvas
    canvas.addEventListener('touchstart', mouseDown, false);
    document.body.addEventListener('touchmove', mouseMove, false);
    document.body.addEventListener('touchend', mouseUp, false);
}

// ------------------------------ PHYSICS SIMULATION CODE ------------------------------

// Simulate function executes a bunch of steps and then schedules another call to itself:
function simulate() {
    // Execute a bunch of time steps:
    var stepsPerFrame = Number(stepsSlider.value);
    for (var step = 0; step < stepsPerFrame; step++) {
        doStep();
    }
    paintCanvas();
    stepCount += stepsPerFrame;
    computeStats();
    showStats();
    if (running) {
        // schedule the next animation frame:
        //requestAnimFrame(function() { simulate(); });		// limits the frame rate
        window.setTimeout(simulate, 1);					// runs as fast as possible (nominal 1 ms delay)
    }
}

// Execute a single time step (Verlet algorithm):
function doStep() {
    var dt = Number(dtSlider.value);
    var halfdt = 0.5 * dt;
    var halfdtsquared = halfdt * dt;
    for (var i = 0; i < N; i++) {
        x[i] += vx[i] * dt + ax[i] * halfdtsquared;
        y[i] += vy[i] * dt + ay[i] * halfdtsquared;
        vx[i] += ax[i] * halfdt;
        vy[i] += ay[i] * halfdt;
    }
    computeAccelerations();
    for (var i = 0; i < N; i++) {
        vx[i] += ax[i] * halfdt;
        vy[i] += ay[i] * halfdt;
    }
    for (var i = 0; i < fixedCount; i++) {		// force v = 0 for fixed molecules
        vx[fixedList[i]] = 0;
        vy[fixedList[i]] = 0;
    }
    // Assign random velocities to fixed-T atoms:
    for (var i = 0; i < fixedTList.length; i++) {
        if (Math.random() < 5 * dt) {	// do this only a small percentage of the time
            var x1, x2, w;
            do {
                x1 = 2 * Math.random() - 1;
                x2 = 2 * Math.random() - 1;
                w = x1 * x1 + x2 * x2;
            } while (w >= 1.0);
            var u = Math.sqrt(-2 * Math.log(w) / w);	// polar Box-Muller transformation to get Gaussian distribution
            vx[fixedTList[i].pointer] = u * x1 * Math.sqrt(fixedTList[i].temp);
            vy[fixedTList[i].pointer] = u * x2 * Math.sqrt(fixedTList[i].temp);
        }
    }
    time += dt;
    updateTandP();
    autoRecordData();
    resizeStep();
}

// Compute accelerations of all molecules:
function computeAccelerations() {

    var dx, dy, dx2, dy2, r, rSquared, rSquaredInv, attract, repel, fOverR, fx, fy;
    var forceCutoff = 3.0;						// distance beyond which we set force=0
    var forceCutoff2 = forceCutoff * forceCutoff;
    var pEatCutoff = 4 * (Math.pow(forceCutoff, -12) - Math.pow(forceCutoff, -6));
    var g = Number(getGravity());
    var wallStiffness = 50;						// spring constant for bouncing off walls
    var wallForce = 0.0;
    potentialE = 0.0;

    // first check for bounces off walls:
    for (var i = 0; i < N; i++) {
        if (x[i] < 0.5) {
            ax[i] = wallStiffness * (0.5 - x[i]);
            wallForce += ax[i];
            potentialE += 0.5 * wallStiffness * (0.5 - x[i]) * (0.5 - x[i]);
        } else if (x[i] > (boxWidth - 0.5)) {
            ax[i] = wallStiffness * (boxWidth - 0.5 - x[i]);
            wallForce -= ax[i];
            potentialE += 0.5 * wallStiffness * (boxWidth - 0.5 - x[i]) * (boxWidth - 0.5 - x[i]);
        } else
            ax[i] = 0.0;
        if (y[i] < 0.5) {
            ay[i] = (wallStiffness * (0.5 - y[i]));
            wallForce += ay[i];
            potentialE += 0.5 * wallStiffness * (0.5 - y[i]) * (0.5 - y[i]);
        } else if (y[i] > (boxWidth - 0.5)) {
            ay[i] = (wallStiffness * (boxWidth - 0.5 - y[i]));
            wallForce -= ay[i];
            potentialE += 0.5 * wallStiffness * (boxWidth - 0.5 - y[i]) * (boxWidth - 0.5 - y[i]);
        } else
            ay[i] = 0;
        ay[i] -= g;				// add gravity if any
    }
    pressure = wallForce / (4 * boxWidth);	// instantaneous pressure

    // now compute interaction forces (Lennard-Jones potential):
    // (this is where we spend most of our computation time, so try to optimize)
    if ((N < 100) || (boxWidth < 4 * forceCutoff) /* || !cellListCheck.checked */) {
        for (var i = 0; i < N; i++) {			// simple double-loop over atoms for small system
            for (var j = 0; j < i; j++) {
                dx = x[i] - x[j];
                dx2 = dx * dx;
                if (dx2 < forceCutoff2) {  // make sure they're close enough to bother
                    dy = y[i] - y[j];
                    dy2 = dy * dy;
                    if (dy2 < forceCutoff2) {
                        rSquared = dx2 + dy2;
                        if (rSquared < forceCutoff2) {
                            rSquaredInv = 1.0 / rSquared;
                            attract = rSquaredInv * rSquaredInv * rSquaredInv;
                            repel = attract * attract;
                            potentialE += (4.0 * (repel - attract)) - pEatCutoff;
                            fOverR = 24.0 * ((2.0 * repel) - attract) * rSquaredInv;
                            fx = fOverR * dx;
                            fy = fOverR * dy;
                            ax[i] += fx;  // add this force on to i's acceleration (m = 1)
                            ay[i] += fy;
                            ax[j] -= fx;  // Newton's 3rd law
                            ay[j] -= fy;
                        }
                    }
                }
            }
        }
    } else {	// tricky O(N) cell-based approach for large system
        var nCells, cellWidth, xCell, yCell, thisCell, neighborCell, xNeighborCell, yNeighborCell;
        var neighborOffset = [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}, {x: 0, y: 1}, {x: -1, y: 1}];	// here, E, NE, N, and NW
        nCells = Math.floor(boxWidth / forceCutoff);		// number of cells in a row
        cellWidth = boxWidth / nCells;
        var listHeader = new Array(nCells * nCells);			// linked list headers
        for (var cell = 0; cell < nCells * nCells; cell++) listHeader[cell] = -1;		// set all cells to empty
        var linkedList = new Array(N);		// element i will point to next atom in same cell
        for (var i = 0; i < N; i++) {			// this loop assembles the linked list of atoms by cell
            xCell = Math.floor(x[i] / cellWidth);		// figure out which cell the atom is in
            if (xCell < 0) xCell = 0;
            if (xCell >= nCells) xCell = nCells - 1;
            yCell = Math.floor(y[i] / cellWidth);
            if (yCell < 0) yCell = 0;
            if (yCell >= nCells) yCell = nCells - 1;
            var cellHeaderIndex = xCell + nCells * yCell;		// flatten 2D structure into 1D array
            linkedList[i] = listHeader[cellHeaderIndex];	// this atom now points where the header used to
            listHeader[cellHeaderIndex] = i;				// header now points to his atom
        }	// linked list is now complete
        for (xCell = 0; xCell < nCells; xCell++) {				// loop over cells
            for (yCell = 0; yCell < nCells; yCell++) {
                thisCell = xCell + nCells * yCell;		// index of this cell in header list
                for (var neighborIndex = 0; neighborIndex < 5; neighborIndex++) {	// loop over neighboring cells
                    xNeighborCell = xCell + neighborOffset[neighborIndex].x;
                    if ((xNeighborCell < 0) || (xNeighborCell >= nCells)) continue;	// some neighbors don't actually exist
                    yNeighborCell = yCell + neighborOffset[neighborIndex].y;
                    if (yNeighborCell >= nCells) continue;
                    neighborCell = xNeighborCell + nCells * yNeighborCell;	// index of neighbor cell in header list
                    var i = listHeader[thisCell];
                    while (i > -1) {	// loop over atoms in this cell
                        var j = listHeader[neighborCell];
                        if (neighborCell == thisCell) j = linkedList[i];	// be sure not to count atoms in this cell twice
                        while (j > -1) {	// loop over atoms in neighbor cell
                            dx = x[i] - x[j];
                            dx2 = dx * dx;
                            if (dx2 < forceCutoff2) {  // make sure they're close enough to bother
                                dy = y[i] - y[j];
                                dy2 = dy * dy;
                                if (dy2 < forceCutoff2) {
                                    rSquared = dx2 + dy2;
                                    if (rSquared < forceCutoff2) {
                                        rSquaredInv = 1.0 / rSquared;
                                        attract = rSquaredInv * rSquaredInv * rSquaredInv;
                                        repel = attract * attract;
                                        potentialE += (4.0 * (repel - attract)) - pEatCutoff;
                                        fOverR = 24.0 * ((2.0 * repel) - attract) * rSquaredInv;
                                        fx = fOverR * dx;
                                        fy = fOverR * dy;
                                        ax[i] += fx;  // add this force on to i's acceleration (m = 1)
                                        ay[i] += fy;
                                        ax[j] -= fx;  // Newton's 3rd law
                                        ay[j] -= fy;
                                    }
                                }
                            }
                            j = linkedList[j];
                        } // end of loop over j
                        i = linkedList[i];
                    } // end of loop over i
                } // end of loop over neighborIndex
            } // end of loop over yCell
        } // end of loop over xCell
    } // end if (and end of L-J force computation)

    // add elastic forces between bonded atoms:
    var bondStrength = 100;	// spring constant (vastly less than actual covalent bonds!)
    for (var i = 0; i < bondCount * 2; i += 2) {
        var i1 = bondList[i];
        var i2 = bondList[i + 1];
        dx = x[i1] - x[i2];
        dy = y[i1] - y[i2];
        r = Math.sqrt(dx * dx + dy * dy);
        var rOffset = r - 1.122462;		// offset by L-J equilibrium position
        potentialE += 0.5 * bondStrength * rOffset * rOffset;
        fx = bondStrength * rOffset * dx / r;
        fy = bondStrength * rOffset * dy / r;
        ax[i1] -= fx;
        ay[i1] -= fy;
        ax[i2] += fx;
        ay[i2] += fy;
    }

    // fixed atoms don't accelerate:
    for (var i = 0; i < fixedCount; i++) {
        ax[fixedList[i]] = 0;
        ay[fixedList[i]] = 0;
    }

    // if we're pulling on an atom it feels an elastic force toward mouse location:
    if (dragging) {
        var pullStrength = 1.0;			// spring constant
        dx = mouseX - x[clickedAtom];
        dy = mouseY - y[clickedAtom];
        ax[clickedAtom] += pullStrength * dx;
        ay[clickedAtom] += pullStrength * dy;
    }

    if (viscosity) {
        var eta = 0.1;
        for (var i = 0; i < N; i++) {
            ax[i] += -eta * vx[i];
            ay[i] += -eta * vy[i];
        }
    }
}	// end of function computeAccelerations

// Compute statistical data from current system state:
function computeStats() {
    kineticE = 0;
    gravitationalE = 0;
    momentumX = 0;
    momentumY = 0;
    var g = Number(getGravity());
    for (var i = 0; i < N; i++) {
        kineticE += 0.5 * (vx[i] * vx[i] + vy[i] * vy[i]);
        gravitationalE += g * y[i];
        momentumX += vx[i];
        momentumY += vy[i];
    }
    var currentT = kineticE / (N - fixedCount);
    safetyCheck(currentT);
}

// Periodically update the temperature and pressure accumulators
function updateTandP() {
    var sampleInterval = 0.5;	// more often than this would probably be pointless
    if (time - lastSampleTime >= sampleInterval) {
        sampleCount++;
        kineticE = 0;
        for (var i = 0; i < N; i++) kineticE += 0.5 * (vx[i] * vx[i] + vy[i] * vy[i]);
        var currentT = kineticE / (N - fixedCount);
        totalT += currentT;
        safetyCheck(currentT);
        averageT = totalT / sampleCount;
        totalP += pressure;
        averageP = totalP / sampleCount;
        lastSampleTime += sampleInterval;
    }
}

// Check for run-away instability, and try to keep dt small enough to prevent it:
function safetyCheck(T) {
    if (T > 1000) {	// handle run-away instability
        running = false;
        var alertString = "Oops! The simulation has become unstable.\n";
        alertString += "Avoid placing atoms so they overlap, and use a smaller time step at high temperature.\n";
        alertString += "Click OK to restart.";
        alert(alertString);
        restart();
    } else {
        var safetyFactor = 4000;
        var dt = Number(dtSlider.value);
        if ((T > 1 / (safetyFactor * dt * dt)) && (!dtFixed.checked)) {
            var newdt = Math.max(Math.sqrt(1 / (safetyFactor * T)) - 0.001, 0.001);
            dtSlider.value = newdt.toFixed(3);
            dtReadout.innerHTML = newdt.toFixed(3);
        }
    }
}

// Function to reset the time and the averages for temperature and pressure:
function reset() {
    time = 0.0;
    totalT = 0.0;
    totalP = 0.0;
    sampleCount = 0;
    lastSampleTime = 0.0;
    lastAutoRecordTime = 0.0;
    showStats();
}

// ------------------------------ MOUSE INTERACTION CODE ------------------------------

// Handle mouse or touch press:
function mouseDown(e) {
    fixTPanel.style.display = "none";
    setMouseXY(e);
    var index = findAtom(mouseX, mouseY);		// returns -1 if none found
    if (index > -1) {
        e.preventDefault();		// don't pass this event to the browser
        if (mouseSelect.options[mouseSelect.selectedIndex].value == "anchor") {
            toggleFixedStatus(index);
        } else if (mouseSelect.options[mouseSelect.selectedIndex].value == "connect") {
            drawingBond = true;
        } else if (mouseSelect.options[mouseSelect.selectedIndex].value == "select") {
            if ((selectedAtom == index) && (selectDataPanel.style.display == "block")) {
                selectDataPanel.style.display = "none";	// second click on same atom hides panel
            } else {
                selectDataPanel.style.display = "block";
            }
            selectedAtom = index;
        } else if (mouseSelect.options[mouseSelect.selectedIndex].value == "fixT") {
            showFixTempPanel(index);
        } else {
            dragging = true;
        }
        clickedAtom = index;
        paintCanvas();
    } else {
        dragging = false;
        if (mouseSelect.options[mouseSelect.selectedIndex].value == "select") {
            selectedAtom = -1;
            selectDataPanel.style.display = "none";
            paintCanvas();
        }
    }
}

// Handle mouse or touch move:
function mouseMove(e) {
    if (dragging || drawingBond) {
        e.preventDefault();
        setMouseXY(e);
        if (dragging && (!running)) {
            x[clickedAtom] = mouseX;
            y[clickedAtom] = mouseY;
        }
        paintCanvas();
    }
}

// Handle mouse or touch up:
function mouseUp(e) {
    if (dragging && (!running)) {
        if ((x[clickedAtom] < 0) || (x[clickedAtom] > boxWidth) || (y[clickedAtom] < 0) || (y[clickedAtom] > boxWidth)) {
            deleteAtom(clickedAtom);
        }
    }
    dragging = false;
    if (drawingBond) {
        drawingBond = false;
        setMouseXY(e);
        var index = findAtom(mouseX, mouseY);
        if (index > -1) createBond(clickedAtom, index);
        paintCanvas();
    }
}

// Convert event location to mouse coordinates in physics units and store in global variables:
function setMouseXY(e) {
    var canvasX = e.pageX - canvas.offsetLeft - canvasDiv.offsetLeft;	// pixel coordinates relative to canvas
    var canvasY = e.pageY - canvas.offsetTop - canvasDiv.offsetTop;
    mouseX = canvasX / pxPerUnit;				// mouse coordinates in physics units
    mouseY = (canvas.height - canvasY) / pxPerUnit;
}

// Look for an atom at physical coordinates thisx, thisy and return its index, or -1 if not found:
function findAtom(thisx, thisy) {
    var radius2 = 0.6 * 0.6;		// square of atom's radius (0.5), plus a bit to be generous
    var found = false;				// will be true if/when we find an atom under mouse
    var i = 0;
    while (i < N) {
        var dx = x[i] - thisx;
        var dy = y[i] - thisy;
        if (dx * dx + dy * dy < radius2) {
            found = true;
            break;
        }
        i++;
    }
    if (found) return i;
    else return -1;
}

// Delete a given atom (called when the atom is dragged out of the box):
function deleteAtom(index) {
    deleteBonds(index);
    if (selectedAtom == index) {
        selectedAtom = -1;
        selectDataPanel.style.display = "none";
    }
    for (var i = 0; i < fixedCount; i++) {	// search fixed list for it and delete if found
        if (fixedList[i] == index) {
            fixedCount--;
            fixedList[i] = fixedList[fixedCount];
            break;
        }
    }
    for (var i = 0; i < fixedTList.length; i++) {	// search fixed-T list for it and delete if found
        if (fixedTList[i].pointer == index) {
            fixedTList.splice(i, 1);
            break;
        }
    }
    N--;
    for (var i = index; i < N; i++) {		// bump remaining molecules down the list
        x[i] = x[i + 1];
        y[i] = y[i + 1];
        vx[i] = vx[i + 1];
        vy[i] = vy[i + 1];
        ax[i] = ax[i + 1];
        ay[i] = ay[i + 1];
        atomColor[i] = atomColor[i + 1];
    }
    atomColor[N] = randomHue();				// assign a new color in case next atom is brought back
    for (var i = 0; i < bondCount * 2; i++) {		// update bond list for new molecule numbering
        if (bondList[i] > index) bondList[i]--;
    }
    for (var i = 0; i < fixedCount; i++) {		// update fixed list similarly
        if (fixedList[i] > index) fixedList[i]--;
    }
    nSlider.value = N;
    nReadout.innerHTML = N;
    //if (clickedAtom >= N) clickedAtom = 0;	// is this needed?
    reset();
    paintCanvas();
}

// Make a molecule fixed if it isn't, or free it if it's fixed:
function toggleFixedStatus(atom) {
    var wasAlreadyFixed = false;
    for (var i = 0; i < fixedCount; i++) {
        if (fixedList[i] == atom) {
            wasAlreadyFixed = true;
            fixedCount--;
            fixedList[i] = fixedList[fixedCount];
            break;
        }
    }
    if (!wasAlreadyFixed) {
        fixedList[fixedCount] = atom;
        fixedCount++;
        vx[atom] = 0;
        vy[atom] = 0;
        ax[atom] = 0;
        ay[atom] = 0;
    }
    reset();
}

// Create a bond between two atoms (or delete all connecting bonds if the two are the same):
function createBond(i1, i2) {
    if (i1 == i2) {
        deleteBonds(i1);
    } else {
        if (i1 > i2) {		// put lower index first for efficiency
            var swap = i1;
            i1 = i2;
            i2 = swap;
        }
        for (var i = 0; i < bondCount * 2; i += 2) {
            if ((bondList[i] == i1) && (bondList[i + 1] == i2)) return;	// quit if bond already exists
        }
        if (bondCount == maxBonds) return;		// quit if bond list is already full
        bondList[2 * bondCount] = i1;
        bondList[2 * bondCount + 1] = i2;
        bondCount++;
    }
    reset();
}

// Delete all bonds connected to given atom:
function deleteBonds(index) {
    var bIndex = 0;
    while (bIndex < 2 * bondCount) {
        if ((bondList[bIndex] == index) || (bondList[bIndex + 1] == index)) {
            bondCount--;
            for (var i = bIndex; i < bondCount * 2; i++) bondList[i] = bondList[i + 2];
        } else {
            bIndex += 2;
        }
    }
    reset();
}

// Show control panel to fix the clicked atom's temperature:
function showFixTempPanel(index) {
    atomNumber.innerHTML = index;
    var fixedTListIndex = -1;
    for (var i = 0; i < fixedTList.length; i++) {	// see if this atom already has a fixed temperature
        if (fixedTList[i].pointer == index) {
            fixedTListIndex = i;
            break;
        }
    }
    if (fixedTListIndex == -1) {
        tempSlider.value = 0;
    } else {
        tempSlider.value = fixedTList[fixedTListIndex].temp;
    }
    atomTemp.innerHTML = Number(tempSlider.value).toFixed(2);
    fixTPanel.style.left = Math.round(x[index] * pxPerUnit + 5) + "px";
    fixTPanel.style.top = Math.round(canvas.height - y[index] * pxPerUnit + 10) + "px";
    fixTPanel.style.display = "block";
}

// Respond to atom temperature slider:
function changeAtomTemp() {
    atomTemp.innerHTML = Number(tempSlider.value).toFixed(2);
}

// Fix T button was clicked:
function fixT() {
    var atomIndex = Number(atomNumber.innerHTML);
    var fixedTListIndex = -1;
    for (var i = 0; i < fixedTList.length; i++) {		// see if this atom already has a fixed temperature
        if (fixedTList[i].pointer == atomIndex) {
            fixedTListIndex = i;
            break;
        }
    }
    if (fixedTListIndex == -1) {
        fixedTList.push({pointer: 0, temp: 0});
        fixedTListIndex = fixedTList.length - 1;
    }
    fixedTList[fixedTListIndex].pointer = atomIndex;
    fixedTList[fixedTListIndex].temp = Number(tempSlider.value);
    fixTPanel.style.display = "none";
    paintCanvas();
}

// Unfix T button was clicked:
function unfixT() {
    var atomIndex = Number(atomNumber.innerHTML);
    for (var i = 0; i < fixedTList.length; i++) {		// see if this atom already has a fixed temperature
        if (fixedTList[i].pointer == atomIndex) {
            fixedTList.splice(i, 1);				// if so, remove it from the list
            paintCanvas();
            break;
        }
    }
    fixTPanel.style.display = "none";
}

// ------------------------------ BUTTON AND SLIDER FUNCTIONS ------------------------------

// Function to start or pause the simulation:
function startStop() {
    startButton.className = "custombutton";		// revert to default color after first press
    running = !running;
    if (running) {
        startButton.innerHTML = "Pause";
        resetStepsPerSec();
        simulate();
    } else {
        startButton.innerHTML = "Resume";
    }
}

// Function to reset the performance counters:
function resetStepsPerSec() {
    stepCount = 0;
    startTime = (new Date()).getTime();
}

// Function to change all speeds by a given factor (called by button presses):
function speedFactor(factor) {
    for (var i = 0; i < N; i++) {
        vx[i] *= factor;
        vy[i] *= factor;
    }
    reset();
    resetStepsPerSec();
    paintCanvas();
}

// Function to restart, placing all the molecules in rows:
function restart() {
    N = 0;
    fixedCount = 0;
    bondCount = 0;
    changeN();
    dtSlider.value = 0.02;
    changedt();
    //reset();	// redundant because it's called by changeN, right?
    resetStepsPerSec();
    if (!running) startButton.innerHTML = "Start";
}

// Function to create lots of bonds, or get rid of them:
function createOrReleaseBonds() {
    if (bondSelect.options[bondSelect.selectedIndex].value == "create") {
        for (var i = 0; i < N; i++) {
            for (var j = 0; j < i; j++) {
                var dx = x[i] - x[j];
                var dy = y[i] - y[j];
                if (dx * dx + dy * dy < 1.3 * 1.3) {
                    createBond(i, j);
                }
            }
        }
        computeAccelerations();
        reset();
        paintCanvas();
    } else if (bondSelect.options[bondSelect.selectedIndex].value == "release") {
        bondCount = 0;
        computeAccelerations();
        reset();
        paintCanvas();
    }
    bondSelect.selectedIndex = 0;	// doesn't work on iOS Safari
    resetStepsPerSec();
}

// kludge for iOS Safari:
function deselectBonds() {
    bondSelect.selectedIndex = 0;
}

// Change number of atoms in response to slider adjustment or +/- button click:
function changeN(dN) {
    if (dN != null) {
        if ((N + dN < nSlider.min) || (N + dN > nSlider.max)) return;
        nSlider.value = N + dN;
    }
    fixTPanel.style.display = "none";
    var newN = Number(nSlider.value);
    if (newN < N) {
        N = newN;
        if (selectedAtom >= N) {
            selectedAtom = -1;
            selectDataPanel.style.display = "none";
        }
        var bIndex = 0;
        while (bIndex < 2 * bondCount) {
            if ((bondList[bIndex] >= N) || (bondList[bIndex + 1] >= N)) {
                bondCount--;
                for (var i = bIndex; i < bondCount * 2; i++) bondList[i] = bondList[i + 2];
            } else {
                bIndex += 2;
            }
        }
        // delete removed molecules from fixed list:
        var fIndex = 0;
        while (fIndex < fixedCount) {
            if (fixedList[fIndex] >= N) {
                fixedCount--;
                fixedList[fIndex] = fixedList[fixedCount];
            } else {
                fIndex++;
            }
        }
        // delete removed molecules from fixed-T list:
        for (var i = 0; i < fixedTList.length; i++) {
            if (fixedTList[i].pointer >= N) {
                fixedTList.splice(i, 1);
            }
        }
    }
    if (newN > N) {
        addAtoms(newN);
        nSlider.value = N;
    }
    nReadout.innerHTML = N;
    computeAccelerations();
    reset();
    if (selectedAtom >= N) {
        selectedAtom = -1;
        selectDataPanel.style.display = "none";
    }
    resetStepsPerSec();
    paintCanvas();
}

// Change the size of the box:
function changeSize() {
    var newSize = Number(sizeSlider.value);
    var oldSize = boxWidth;
    if (newSize == oldSize) return;
    if (running) {	// in this case we'll do it slowly via resizeStep()
        if (targetSize != boxWidth) {	// abort if a resizing via resizeStep is already in progress
            sizeSlider.value = targetSize;
            return;
        }
        if (newSize < oldSize) {
            newSize = oldSize - 1;
        } else {
            newSize = oldSize + 1;
        }
        var minSize = 0.9 * Math.sqrt(N);
        if (newSize < minSize) {		// abort if new size would be too small to hold all the atoms
            sizeSlider.value = oldSize;
            return;
        }
        targetSize = newSize;
        sizeSlider.value = newSize;
        resizeStep();
    } else {							// if not running, do the resize all at once
        var offset = (newSize - oldSize) / 2.0;
        for (var atom = 0; atom < N; atom++) {
            x[atom] += offset;
            y[atom] += offset;
        }
        boxWidth = newSize;
        pxPerUnit = canvas.width / boxWidth;
        targetSize = boxWidth;
        computeAccelerations();
        computeStats();
        paintCanvas();
        reset();
        resetStepsPerSec();
    }
    var volume = Math.round(newSize * newSize);
    sizeReadout.innerHTML = newSize + " (volume = " + volume + ")";
}

// Function to take one step toward changing the box size, if the time is right:
function resizeStep() {
    if (boxWidth != targetSize) {
        var epsilon = 0.00001;		// avoids round-off error
        if (sizeStepTimer > epsilon) {
            sizeStepTimer -= Number(dtSlider.value);
        } else {
            var stepSize = 0.004;			// size of each step as we change boxWidth
            if (boxWidth > targetSize) stepSize = -stepSize;
            var newSize = boxWidth + stepSize;
            var offset = (newSize - boxWidth) / 2.0;
            for (var atom = 0; atom < N; atom++) {
                x[atom] += offset;
                y[atom] += offset;
            }
            boxWidth = newSize;
            if (Math.abs(boxWidth - targetSize) < epsilon) {
                boxWidth = targetSize;
            } else {
                sizeStepTimer = 0.01;	// this value controls the rate of resizing
            }
            pxPerUnit = canvas.width / boxWidth;
            computeAccelerations();
            computeStats();
            reset();
            resetStepsPerSec();
        }
    }
}

// Timed function to allow another size decrease:
function allowSizeDecrease() {
    recentSizeDecrease = false;
}

// Function to return gravitational constant:
function getGravity() {
    if (gravx10.checked) {
        return gravSlider.value * 10;
    } else {
        return gravSlider.value;
    }
}

// Function to set the gravitational constant:
function setGravity(newGrav) {
    if (newGrav == null) {		// this happens when user adjusts the slider
        newGrav = gravSlider.value;
        if (gravx10.checked) newGrav *= 10;
        reset();
        resetStepsPerSec();
    } else {
        if (newGrav > 0.1) {
            gravx10.checked = true;
            gravSlider.value = newGrav / 10;
        } else {
            gravx10.checked = false;
            gravSlider.value = newGrav;
        }
    }
    gravReadout.innerHTML = Number(newGrav).toFixed(3);
}

// Change the dt setting:
function changedt() {
    dtReadout.innerHTML = Number(dtSlider.value).toFixed(3);
}

// Change the number of steps per frame:
function changeSteps() {
    stepsReadout.innerHTML = stepsSlider.value;
    resetStepsPerSec();
}

// Function called when atom color menu is changed:
function assignRandomColors() {
    if (mColorSelect.options[mColorSelect.selectedIndex].text == "Random") {
        for (var atom = 0; atom < nMax; atom++) {
            atomColor[atom] = randomHue();
        }
    }
    paintCanvas();
}

// Function to convert a number to a two-digit hex string (from stackoverflow):
function twoDigitHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

// Function to generate a random hue as hex string:
function randomHue() {
    var hue = Math.random();
    var r, g, b;
    if (hue < 1 / 6) {
        r = 255;
        g = Math.round(hue * 6 * 255);
        b = 0;			// red to yellow
    } else if (hue < 1 / 3) {
        r = Math.round((1 / 3 - hue) * 6 * 255);
        g = 255;
        b = 0;	// yellow to green
    } else if (hue < 1 / 2) {
        r = 0;
        g = 255;
        b = Math.round((hue - 1 / 3) * 6 * 255);	// green to cyan
    } else if (hue < 2 / 3) {
        r = 0;
        g = Math.round((2 / 3 - hue) * 6 * 255);
        b = 255;	// cyan to blue
    } else if (hue < 5 / 6) {
        r = Math.round((hue - 2 / 3) * 6 * 255);
        g = 0;
        b = 255;	// blue to magenta
    } else {
        r = 255;
        g = 0;
        b = Math.round((1 - hue) * 6 * 255);	// magenta to red
    }
    return "#" + twoDigitHex(r) + twoDigitHex(g) + twoDigitHex(b);
}

// Add atom to the simulation until N == newN (if there's room):
// (This algorithm is inefficient when it doesn't matter and efficient when it does.)
function addAtoms(newN) {
    var cellSize = 1.3;		// must be at least 1.0, preferably a little more
    var nCells = Math.floor(boxWidth / cellSize);	// number of cells in a row
    var occupied = new Array(nCells * nCells);		// keeps track of which cells are occupied
    for (var c = 0; c < nCells * nCells; c++) occupied[c] = false;
    for (var i = 0; i < N; i++) {	// loop over all atoms and label occupied cells
        var scaledX = x[i] / cellSize;	// x coordinate in units of cellSize
        if (scaledX < 0.5) scaledX = 0.5;
        if (scaledX > nCells - 0.5) scaledX = nCells - 0.5;
        var scaledY = y[i] / cellSize;
        if (scaledY < 0.5) scaledY = 0.5;
        if (scaledY > nCells - 0.5) scaledY = nCells - 0.5;
        var cellX = Math.round(scaledX - 0.5);	// integer cell number for this location
        var cellY = Math.round(scaledY - 0.5);
        // Check if atom protrudes into neighboring cells:
        var xProtrude = 0;
        if ((cellX + 1 - scaledX) * cellSize < 0.5) {		// if it's sticking out past right edge of cell...
            xProtrude = 1;
        } else if ((scaledX - cellX) * cellSize < 0.5) {		// if it's sticking past left edge...
            xProtrude = -1;
        }
        var yProtrude = 0;
        if ((cellY + 1 - scaledY) * cellSize < 0.5) {		// if it's sticking out past top edge of cell...
            yProtrude = 1;
        } else if ((scaledY - cellY) * cellSize < 0.5) {		// if it's sticking past bottom edge...
            yProtrude = -1;
        }
        // Finally, label the occupied cells (possibly as many as four):
        occupied[cellX + nCells * cellY] = true;	// cell containing atom's center is occupied
        occupied[(cellX + xProtrude) + nCells * cellY] = true;	// cell to right or left (or not)
        occupied[cellX + nCells * (cellY + yProtrude)] = true;	// cell to top or bottom (or not)
        occupied[(cellX + xProtrude) + nCells * (cellY + yProtrude)] = true;	// adjacent corner cell (or not)
    }
    var epsilon = 0.01;		// small distance for random offset to break symmetry
    // Now loop over cells and add atoms where there's room, up to newN:
    for (var cellY = 0; cellY < nCells; cellY++) {
        for (var cellX = 0; cellX < nCells; cellX++) {
            if (!occupied[cellX + nCells * cellY]) {
                x[N] = (cellX + 0.5) * cellSize + (Math.random() - 0.5) * epsilon;
                y[N] = (cellY + 0.5) * cellSize + (Math.random() - 0.5) * epsilon;
                vx[N] = 0;
                vy[N] = 0;
                ax[N] = 0;
                ay[N] = 0;
                N++;
                if (N == newN) return;
            }
        }
    }
    // if we get to here, there wasn't room!
}

// Show or hide the data panel
function showDataPanel() {
    if (moreButton.innerHTML.search("Data") > -1) {
        dataPanel.style.display = "block";
        moreButton.innerHTML = "\u2191 Hide \u2191";
    } else {
        dataPanel.style.display = "none";
        moreButton.innerHTML = "\u2193 Data \u2193";
        autoDataSelect.selectedIndex = 0;	// stop auto data recording
    }
}

// Respond to selection of data type by showing/hiding appropriate controls:
function dataSelectChange() {
    if (dataSelect.options[dataSelect.selectedIndex].value == "system") {
        allAtomsDataButtons.style.display = "none";
        autoIntervalControl.style.display = "block";
        moreDetailCheckPanel.style.display = "block";
    } else if (dataSelect.options[dataSelect.selectedIndex].value == "selected") {
        allAtomsDataButtons.style.display = "none";
        autoIntervalControl.style.display = "block";
        moreDetailCheckPanel.style.display = "none";
    } else {
        autoIntervalControl.style.display = "none";
        moreDetailCheckPanel.style.display = "none";
        allAtomsDataButtons.style.display = "block";
        autoDataSelect.selectedIndex = 0;	// stop auto data recording
    }
}

// Show various data in constantly-updated display lines:
function showStats() {
    var totalE = kineticE + potentialE + gravitationalE;
    energyReadout.innerHTML = "KE = " + kineticE.toFixed(2) +
        ", PE = " + potentialE.toFixed(2) + ", GE = " + gravitationalE.toFixed(2);
    var elapsedTime = ((new Date()).getTime() - startTime) / 1000;	// time in seconds
    energyReadout.innerHTML += ", Steps/s = " + Number(stepCount / elapsedTime).toFixed(0);
    dataReadout.innerHTML = "t = " + time.toFixed(3) + ", E = " + totalE.toFixed(2) +
        ", T = " + averageT.toFixed(4) + ", P = " + averageP.toFixed(4);
}

// Write stats to data area:
function writeStats() {
    if (dataSelect.options[dataSelect.selectedIndex].value == "system") {
        if (dataArea.value.search("t\tN\tV") == -1) {
            if (moreDetailCheck.checked) {
                dataArea.value = "t\tN\tV\tE\tT\tP\tKE\tPE\tGE\tpx\tpy\n";
            } else {
                dataArea.value = "t\tN\tV\tE\tT\tP\n";
            }
        }
        var totalE = kineticE + potentialE + gravitationalE;
        var V = boxWidth * boxWidth;
        dataArea.value += time.toFixed(3) + '\t' + N + '\t' + V.toFixed(0) + '\t' +
            totalE.toFixed(2) + '\t' + averageT.toFixed(4) + '\t' + averageP.toFixed(4);
        if (moreDetailCheck.checked) {
            dataArea.value += '\t' + kineticE.toFixed(2) + '\t' + potentialE.toFixed(2) + '\t' +
                gravitationalE.toFixed(2) + '\t' + momentumX.toFixed(2) + '\t' + momentumY.toFixed(2);
        }
        dataArea.value += '\n';
        dataArea.scrollTop = dataArea.scrollHeight;		// scroll so new line is always visible
    } else if (dataSelect.options[dataSelect.selectedIndex].value == "selected") {
        if ((selectedAtom < 0) || (selectedAtom >= N)) {
            dataArea.value = "Please select an atom.  First choose Select from the Mouse/touch popup.\n";
            autoDataSelect.selectedIndex = 0;
            return;
        }
        if (dataArea.value.search("t\tx\ty") == -1) {
            dataArea.value = "t\tx\ty\tvx\tvy\n";
        }
        dataArea.value += time.toFixed(3) + '\t' + x[selectedAtom].toFixed(4) + '\t' +
            y[selectedAtom].toFixed(4) + '\t' + vx[selectedAtom].toFixed(4) + '\t' + vy[selectedAtom].toFixed(4) + '\n';
        dataArea.scrollTop = dataArea.scrollHeight;		// scroll so new line is always visible
    } else {	// otherwise "all atoms" is selected
        showState();
    }
}

// Initiate auto data recording:
function autoDataSelectChange() {
    lastAutoRecordTime = time;
}

// Automatically record data at selected interval:
function autoRecordData() {
    var interval = Number(autoDataSelect.options[autoDataSelect.selectedIndex].value);
    if (interval > 0) {
        interval = Math.max(interval, Number(dtSlider.value));	// interval can't be < dt
        if (time - lastAutoRecordTime >= interval) {
            computeStats();
            writeStats();
            lastAutoRecordTime += interval;
        }
    }
}

// Clear the data area
function clearDataArea() {
    dataArea.value = "";
}

// Write the current system state to the data area:
function showState() {
    dataArea.value = "MD state data\n";
    dataArea.value += "N = " + N + "\n";
    dataArea.value += "Size = " + boxWidth + "\n";
    dataArea.value += "Gravity = " + Number(getGravity()).toFixed(3) + "\n";
    dataArea.value += "dt = " + Number(dtSlider.value).toFixed(3) + "\n";
    dataArea.value += "Steps per frame = " + stepsSlider.value + "\n";
    dataArea.value += "x       \ty       \tvx       \tvy       \n";
    for (var i = 0; i < N; i++) {
        dataArea.value += x[i].toFixed(6) + "\t" + y[i].toFixed(6) + "\t"
            + vx[i].toFixed(6) + "\t" + vy[i].toFixed(6) + "\n";
    }
    if (fixedCount > 0) dataArea.value += "Number of anchored atoms = " + fixedCount + "\n";
    for (var i = 0; i < fixedCount; i++) {
        dataArea.value += fixedList[i] + "\n";
    }
    if (bondCount > 0) dataArea.value += "Number of bonded pairs = " + bondCount + "\n";
    for (var i = 0; i < bondCount; i++) {
        dataArea.value += bondList[2 * i] + "\t" + bondList[2 * i + 1] + "\n";
    }
    if (fixedTList.length > 0) {
        dataArea.value += "Number of fixed-T atoms = " + fixedTList.length + "\n";
        dataArea.value += "Index\tTemperature\n";
    }
    for (var i = 0; i < fixedTList.length; i++) {
        dataArea.value += fixedTList[i].pointer + "\t" + fixedTList[i].temp + "\n";
    }
}

// Read a new system state from the data area:
function inputState() {
    fixTPanel.style.display = "none";
    var lines = dataArea.value.replace(/\r\n/g, '\n').split('\n');	// split data into lines
    var newN = Math.round(Number(lines[1].substr(lines[1].indexOf('=') + 1)));	// extract N
    if (newN < nSlider.min) newN = nSlider.min;
    if (newN > nSlider.max) newN = nSlider.max;
    N = newN;
    nSlider.value = N;
    nReadout.innerHTML = N;
    var newSize = Math.round(Number(lines[2].substr(lines[2].indexOf('=') + 1)));	// extract box size
    if (newSize < sizeSlider.min) newSize = sizeSlider.min;
    if (newSize > sizeSlider.max) newSize = sizeSlider.max;
    boxWidth = newSize;
    targetSize = boxWidth;
    pxPerUnit = canvas.width / boxWidth;
    sizeSlider.value = boxWidth;
    var volume = Math.round(boxWidth * boxWidth);
    sizeReadout.innerHTML = boxWidth + " (volume = " + volume + ")";
    var newG = Number(lines[3].substr(lines[3].indexOf('=') + 1));	// extract gravity setting
    if (newG < gravSlider.min) newG = gravSlider.min;
    if (newG > gravSlider.max * 10) newG = gravSlider.max * 10;			// kludge to allow for x10 option
    setGravity(newG);
    var newdt = Number(lines[4].substr(lines[4].indexOf('=') + 1));	// extract dt setting
    if (newdt < dtSlider.min) newdt = dtSlider.min;
    if (newdt > dtSlider.max) newdt = dtSlider.max;
    dtSlider.value = newdt;
    dtReadout.innerHTML = newdt;
    var newSteps = Number(lines[5].substr(lines[5].indexOf('=') + 1));	// extract steps per frame setting
    if (newSteps < stepsSlider.min) newSteps = stepsSlider.min;
    if (newSteps > stepsSlider.max) newSteps = stepsSlider.max;
    stepsSlider.value = newSteps;
    stepsReadout.innerHTML = newSteps;
    for (var i = 0; i < N; i++) {								// now extract molecule positions and velocities
        var data = lines[i + 7].split('\t');
        x[i] = Number(data[0]);
        y[i] = Number(data[1]);		// no validity checking here!
        vx[i] = Number(data[2]);
        vy[i] = Number(data[3]);
    }
    fixedCount = 0;
    var nextIndex = N + 7;	// index of next line, if any
    if ((lines[nextIndex] != undefined) && (lines[nextIndex].search("anchored") > -1)) {		// if there are anchored atoms, extract their indices
        fixedCount = Number(lines[nextIndex].substr(lines[nextIndex].indexOf('=') + 1));
        nextIndex++;
        for (var i = 0; i < fixedCount; i++) {
            fixedList[i] = Number(lines[nextIndex]);
            nextIndex++;
        }
    }
    bondCount = 0;
    if ((lines[nextIndex] != undefined) && (lines[nextIndex].search("bonded") > -1)) {		// if there are bonded pairs, extract their indices
        bondCount = Number(lines[nextIndex].substr(lines[nextIndex].indexOf('=') + 1));
        nextIndex++;
        for (var i = 0; i < bondCount * 2; i += 2) {
            var bIndex = lines[nextIndex].split('\t');
            bondList[i] = Number(bIndex[0]);
            bondList[i + 1] = Number(bIndex[1]);
            nextIndex++;
        }
    }
    fixedTList = [];
    if ((lines[nextIndex] != undefined) && (lines[nextIndex].search("fixed-T") > -1)) {
        var fixedTCount = Number(lines[nextIndex].substr(lines[nextIndex].indexOf('=') + 1));
        nextIndex += 2;		// skip header line
        for (var i = 0; i < fixedTCount; i++) {
            var fixedTItem = lines[nextIndex].split('\t');
            fixedTList.push({pointer: 0, temp: 0});
            fixedTList[i].pointer = Number(fixedTItem[0]);
            fixedTList[i].temp = Number(fixedTItem[1]);
            nextIndex++;
        }
    }
    if (selectedAtom >= N) {
        selectedAtom = -1;
        selectDataPanel.style.display = "none";
    }
    computeAccelerations();
    reset();
    paintCanvas();
}

// Write the current system state in JavaScript syntax (suitable for preset file):
function showJS() {
    dataArea.value = '{name: "MD configuration",\n';
    dataArea.value += "N: " + N + ",\n";
    dataArea.value += "size: " + boxWidth + ",\n";
    dataArea.value += "gravity: " + Number(getGravity()).toFixed(3) + ",\n";
    dataArea.value += "dt: " + Number(dtSlider.value).toFixed(3) + ",\n";
    dataArea.value += "steps: " + stepsSlider.value + ",\n";
    dataArea.value += "fixedCount: " + fixedCount + ",\n";
    dataArea.value += "bondCount: " + bondCount + ",\n";
    dataArea.value += "fixedTCount: " + fixedTList.length + ",\n";
    dataArea.value += "data: [\n";
    var vxString, vyString;
    var epsilon = 0.001;		// velocities less than this are set to zero
    for (var i = 0; i < N - 1; i++) {
        if (Math.abs(vx[i]) < epsilon) vxString = "0"; else vxString = vx[i].toFixed(6);
        if (Math.abs(vy[i]) < epsilon) vyString = "0"; else vyString = vy[i].toFixed(6);
        dataArea.value += x[i].toFixed(6) + ", " + y[i].toFixed(6) + ", "
            + vxString + ", " + vyString + ",\n";
    }
    if (Math.abs(vx[N - 1]) < epsilon) vxString = "0"; else vxString = vx[N - 1].toFixed(6);
    if (Math.abs(vy[N - 1]) < epsilon) vyString = "0"; else vyString = vy[N - 1].toFixed(6);
    dataArea.value += x[N - 1].toFixed(6) + ", " + y[N - 1].toFixed(6) + ", "
        + vxString + ", " + vyString + "]";
    if (fixedCount > 0) {
        dataArea.value += ",\nfixedList: [";
        for (var i = 0; i < fixedCount - 1; i++) {
            dataArea.value += fixedList[i] + ", ";
        }
        dataArea.value += fixedList[fixedCount - 1] + "]";
    }
    if (bondCount > 0) {
        dataArea.value += ",\nbondList: [\n";
        for (var i = 0; i < bondCount - 1; i++) {
            dataArea.value += bondList[2 * i] + ", " + bondList[2 * i + 1] + ",\n";
        }
        dataArea.value += bondList[2 * (bondCount - 1)] + ", " + bondList[2 * (bondCount - 1) + 1] + "]";
    }
    if (fixedTList.length > 0) {
        dataArea.value += ",\nfixedTList: [\n";
        for (var i = 0; i < fixedTList.length - 1; i++) {
            dataArea.value += "{pointer:" + fixedTList[i].pointer + ", temp:" + fixedTList[i].temp + "},\n";
        }
        dataArea.value += "{pointer:" + fixedTList[fixedTList.length - 1].pointer + ", temp:" +
            fixedTList[fixedTList.length - 1].temp + "}]";
    }
    dataArea.value += "}\n";
}

// Load data from one of the presets (no validity checking!):
function loadPreset() {
    var index = presetSelect.selectedIndex - 1;		// actual presets start at menu item 1
    if (index < 0) return;
    fixTPanel.style.display = "none";
    N = presetList[index].N;	// the presetList array is in mdpresets.js, loaded above
    nSlider.value = N;
    nReadout.innerHTML = N;
    boxWidth = presetList[index].size;
    targetSize = boxWidth;
    pxPerUnit = canvas.width / boxWidth;
    sizeSlider.value = boxWidth;
    var volume = Math.round(boxWidth * boxWidth);
    sizeReadout.innerHTML = boxWidth + " (volume = " + volume + ")";
    setGravity(presetList[index].gravity);
    dtSlider.value = presetList[index].dt;
    dtReadout.innerHTML = presetList[index].dt;
    stepsSlider.value = presetList[index].steps;
    stepsReadout.innerHTML = presetList[index].steps;
    for (var i = 0; i < N; i++) {
        x[i] = presetList[index].data[i * 4];
        y[i] = presetList[index].data[i * 4 + 1];
        vx[i] = presetList[index].data[i * 4 + 2];
        vy[i] = presetList[index].data[i * 4 + 3];
    }
    fixedCount = presetList[index].fixedCount;
    for (var i = 0; i < fixedCount; i++) {
        fixedList[i] = presetList[index].fixedList[i];
    }
    bondCount = presetList[index].bondCount;
    for (var i = 0; i < 2 * bondCount; i++) {
        bondList[i] = presetList[index].bondList[i];
    }
    fixedTList = [];
    for (var i = 0; i < presetList[index].fixedTCount; i++) {
        fixedTList.push({pointer: 0, temp: 0});
        fixedTList[i].pointer = Number(presetList[index].fixedTList[i].pointer);
        fixedTList[i].temp = Number(presetList[index].fixedTList[i].temp);
    }
    if (selectedAtom >= N) {
        selectedAtom = -1;
        selectDataPanel.style.display = "none";
    }
    computeAccelerations();
    reset();
    resetStepsPerSec();
    paintCanvas();
    if (!running) startButton.innerHTML = "Start";
    presetSelect.selectedIndex = 0;		// reset menu to read "Presets" (doesn't work in iOS Safari)
}

// kludge to handle iOS Safari bug, called by onblur:
function deselectPreset() {
    presetSelect.selectedIndex = 0;
}

// ------------------------------ GRAPHICS OUTPUT ------------------------------

// Clear the canvas and draw all the molecules:
function paintCanvas() {

    // First draw the background:
    context.fillStyle = bgColorSelect.options[bgColorSelect.selectedIndex].value;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw atoms next:
    var theColorOption = mColorSelect.options[mColorSelect.selectedIndex];
    var randomColor = false;
    var speedColor = false;
    var speedLimit = 3.0;		// speed for high end of speedColorList
    if (theColorOption.text == "By speed") {
        speedColor = true;
    }
    else if (theColorOption.text == "Random") {
        randomColor = true;
    }
    for (var i = 0; i < N; i++) {
        var pixelX = x[i] * pxPerUnit;
        var pixelY = canvas.height - (y[i] * pxPerUnit);
        if (speedColor) {
            var speed = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
            if (speed > speedLimit) {
                context.fillStyle = speedColorList[speedColorList.length - 1];
            } else {
                context.fillStyle = speedColorList[Math.floor(speed * speedColorList.length / speedLimit)];
            }
        } else if (randomColor) {
            context.fillStyle = atomColor[i];
        } else {
            context.fillStyle = theColorOption.value;
        }
        if (i == selectedAtom) {
            context.fillStyle = selectedAtomColor[mColorSelect.selectedIndex];
        }
        context.beginPath();
        context.arc(pixelX, pixelY, pxPerUnit / 2, 0, 2 * Math.PI);
        context.fill();
    }

    // Redraw fixed atoms in light gray:
    context.fillStyle = "#c0c0c0";	// light gray for fixed atoms
    for (var i = 0; i < fixedCount; i++) {
        var pixelX = x[fixedList[i]] * pxPerUnit;
        var pixelY = canvas.height - (y[fixedList[i]] * pxPerUnit);
        context.beginPath();
        context.arc(pixelX, pixelY, pxPerUnit / 2, 0, 2 * Math.PI);
        context.fill();
    }

    // Draw light gray dot on fixed-T atoms:
    context.fillStyle = "#c0c0c0";
    for (var i = 0; i < fixedTList.length; i++) {
        var pixelX = x[fixedTList[i].pointer] * pxPerUnit;
        var pixelY = canvas.height - (y[fixedTList[i].pointer] * pxPerUnit);
        context.beginPath();
        context.arc(pixelX, pixelY, pxPerUnit / 4, 0, 2 * Math.PI);
        context.fill();
    }

    // Draw bonds between molecules:
    context.strokeStyle = "#808080";		// gray
    context.lineWidth = 1;
    var x1, x2, y1, y2;						// pixel coordinates of line representing bond
    for (var i = 0; i < bondCount * 2; i += 2) {
        var i1 = bondList[i];
        var i2 = bondList[i + 1];
        x1 = x[i1] * pxPerUnit;
        y1 = canvas.height - (y[i1] * pxPerUnit);
        x2 = x[i2] * pxPerUnit;
        y2 = canvas.height - (y[i2] * pxPerUnit);
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
    }

    // Draw the bond that's being created, if any:
    if (drawingBond) {
        context.beginPath();
        context.moveTo(x[clickedAtom] * pxPerUnit, canvas.height - (y[clickedAtom] * pxPerUnit));
        context.lineTo(mouseX * pxPerUnit, canvas.height - (mouseY * pxPerUnit));
        context.stroke();
    }

    // Draw elastic cord to mouse location if appropriate:
    if ((running) && (dragging)) {
        context.strokeStyle = "#808080";	// gray
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x[clickedAtom] * pxPerUnit, canvas.height - (y[clickedAtom] * pxPerUnit));
        context.lineTo(mouseX * pxPerUnit, canvas.height - (mouseY * pxPerUnit));
        context.stroke();
    }

    // Update panel of data for selected atom:
    if ((selectedAtom > -1) && (selectDataPanel.style.display == "block")) {
        selectDataPanel.style.left = Math.round((x[selectedAtom] + 0.4) * pxPerUnit) + "px";
        selectDataPanel.style.top = Math.round(canvas.height - ((y[selectedAtom] - 0.4) * pxPerUnit)) + "px";
        selectDataPanel.innerHTML = "<b>Atom " + selectedAtom + "</b><br>" +
            "x = " + Number(x[selectedAtom]).toFixed(4) + "<br>" +
            "y = " + Number(y[selectedAtom]).toFixed(4) + "<br>" +
            "v<sub>x</sub> = " + Number(vx[selectedAtom]).toFixed(4) + "<br>" +
            "v<sub>y</sub> = " + Number(vy[selectedAtom]).toFixed(4);
        // add x, y, vx, vy data
    }

    // testing--show all speed colors:
    /*for (var i=0; i<speedColorList.length; i++) {
        context.fillStyle = speedColorList[i];
        context.beginPath();
        context.arc(i*20+20, 20, 9, 0, 2*Math.PI);
        context.fill();
    }*/
}
