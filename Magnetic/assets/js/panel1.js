/**
 * Created by qz on 8/6/17.
 */

'use strict';

var supportsES6 = function () { // Test if ES6 is ~fully supported
    try {
        new Function('(a = 0) => a');
        return true;
    } catch (err) {
        return false;
    }
}();

if (supportsES6) {
} else {
    alert('Your browser is too old! Please use a modern browser!');
}

// Import libraries
let numeric = require('numeric');
let ndarray = require('ndarray'); // Modular multidimensional arrays for JavaScript.
let ops = require('ndarray-ops'); // A collection of common mathematical operations for ndarrays. Implemented using cwise.
let unpack = require('ndarray-unpack'); // Converts an ndarray into an array-of-native-arrays.
let show = require('ndarray-show');


// Variables
let current = 1; // Current
let xNum = 2;
let yNum = 3;
let zNum = 4;
let wireNum = 400;
let loopMul = 4;
let xCoord = ndarray(new Float64Array(numeric.linspace(-100, 100, xNum)));
let yCoord = ndarray(new Float64Array(numeric.linspace(-100, 100, yNum)));
let zCoord = ndarray(new Float64Array(numeric.linspace(-100, 100, zNum)));
let opt;
let xWireCoord;
let yWireCoord;
let zWireCoord;
let dlx = ndarray(new Float64Array(wireNum));
let dly = ndarray(new Float64Array(wireNum));
let dlz = ndarray(new Float64Array(wireNum));


// Main interfaces
function cross(arr1, arr2) {
    /*
     Here arr1, arr2 are both 1D arrays.
     */
    let u1 = arr1[0];
    let u2 = arr1[1];
    let u3 = arr1[2];
    let v1 = arr2[0];
    let v2 = arr2[1];
    let v3 = arr2[2];
    return [u2 * v3 - u3 * v2, u3 * v1 - u1 * v3, u1 * v2 - u2 * v1];
}

function setDeltaLArray() {
    /*
     Delta l is the infinitesimal part of l---the wire.
     */
    for (let i = 0; i < wireNum - 1; i++) {
        dlx.set(i, xWireCoord.get(i + 1) - xWireCoord.get(i));
        dly.set(i, yWireCoord.get(i + 1) - yWireCoord.get(i));
        dlz.set(i, zWireCoord.get(i + 1) - zWireCoord.get(i));
    }
    dlx.set(wireNum - 1, 1 - xWireCoord.get(wireNum - 1));
    dly.set(wireNum - 1, 1 - yWireCoord.get(wireNum - 1));
    dlz.set(wireNum - 1, 1 - zWireCoord.get(wireNum - 1));
}

function calculateR(x, y, z, i) {
    /*
     This function is used to calculate \mathbf{r} = \mathbf{x} - \mathbf{l}.
     Here i labels the ith point on the wire.
     */
    let rx = x - xWireCoord.get(i);
    let ry = y - yWireCoord.get(i);
    let rz = z - zWireCoord.get(i);
    return [rx, ry, rz];
}

function calculateB(x, y, z) {
    /*
     This function calculates the magnetic field generated by the
     wire at point (x, y, z). That magnetic field is a sum of field
     generated by each point on the wire.
     */
    let b = ndarray(new Float64Array(3));
    let aux = ndarray(new Float64Array(3));
    for (let i = 0; i < wireNum - 1; i++) {
        let r = calculateR(x, y, z, i);
        let rLength = ops.norm2(ndarray(r)); // L2 norm of vector r
        let dl = [dlx.get(i), dly.get(i), dlz.get(i)];
        ops.muls(aux, ndarray(cross(dl, r)), current / Math.pow(rLength, 3));
        ops.addeq(b, aux);
    }
    return b;
}

function generateBField() {
    let bField = [];
    for (let i = 0; i < zNum; i++) {
        bField[i] = [];
        for (let j = 0; j < xNum; j++) {
            bField[i][j] = [];
            for (let k = 0; k < yNum; k++) {
                bField[i][j][k] = unpack(
                    calculateB(xCoord.get(j), yCoord.get(k), zCoord.get(i))
                );
            }
        }
    }
    return bField;
}

function parseBField() {
    let bField = generateBField();
    let size = xNum * yNum * zNum;
    let bFieldX = ndarray(new Float64Array(size), [zNum, xNum, yNum]);
    let bFieldY = ndarray(new Float64Array(size), [zNum, xNum, yNum]);
    let bFieldZ = ndarray(new Float64Array(size), [zNum, xNum, yNum]);
    for (let i = 0; i < zNum; i++) {
        for (let j = 0; j < xNum; j++) {
            for (let k = 0; k < yNum; k++) {
                bFieldX.set(i, j, k, bField[i][j][k][0]);
                bFieldY.set(i, j, k, bField[i][j][k][1]);
                bFieldZ.set(i, j, k, bField[i][j][k][2]);
            }
        }
    }
    return [bFieldX, bFieldY, bFieldZ];
}

// Plot
function plot() {
    plt0.data[0].x = unpack(xWireCoord);
    plt0.data[0].y = unpack(yWireCoord);
    plt0.data[0].z = unpack(zWireCoord);

    Plotly.redraw(plt0);
}

function createPlots() {
    let wire = {
        mode: 'lines',
        type: 'scatter3d',
        x: unpack(xWireCoord),
        y: unpack(yWireCoord),
        z: unpack(zWireCoord),
    };

    let bFieldX;
    let bFieldY;
    let bFieldZ;
    [bFieldX, bFieldY, bFieldZ] = parseBField();

    let data0 = [wire];

    Plotly.newPlot('plt0', data0);
}


// Interactive interfaces
$('#wireSelect') // See https://silviomoreto.github.io/bootstrap-select/options/
    .on('changed.bs.select', function () {
        let selectedValue = $(this)
            .val();
        switch (selectedValue) {
            case 'Straight wire':
                opt = 0;
                break;
            case 'Solenoid':
                opt = 1;
                break;
        }
        setWire(opt);
        plot();
    });

function setWire(opt) {
    switch (opt) {
        case 0:
            xWireCoord = ndarray(new Float64Array(wireNum));
            yWireCoord = ndarray(new Float64Array(wireNum));
            zWireCoord = ndarray(new Float64Array(numeric.linspace(-10, 10, wireNum)));
            break;
        case 1:
            xWireCoord = ops.coseq(
                ops.mulseq(
                    ndarray(new Float64Array(numeric.linspace(-10, 10, wireNum))), loopMul
                )
            );
            yWireCoord = ops.sineq(
                ops.mulseq(
                    ndarray(new Float64Array(numeric.linspace(-10, 10, wireNum))), loopMul
                )
            );
            zWireCoord = ndarray(new Float64Array(numeric.linspace(-10, 10, wireNum)));
            break;
        default:
            new RangeError('This option is not valid!');
    }
}

// Initialize
setWire(1);
setDeltaLArray();
createPlots();
