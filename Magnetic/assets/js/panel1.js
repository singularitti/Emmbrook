/**
 * Created by qz on 8/6/17.
 */

'use strict';
// Check if your browser supports ES6 feature
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
let ndarray = require('ndarray'); // Modular multidimensional arrays for JavaScript.
let linspace = require('ndarray-linspace'); // Fill an ndarray with equally spaced values
let ops = require('ndarray-ops'); // A collection of common mathematical operations for ndarrays.
let unpack = require('ndarray-unpack'); // Converts an ndarray into an array-of-native-arrays.
let fill = require('ndarray-fill');
// let show = require('ndarray-show');
let tile = require('ndarray-tile'); // This module takes an input ndarray and repeats it some number of times in each dimension.


// Variables
let current = 0.1; // Current
let xNum = 20;
let yNum = 20;
let zNum = 20;
let wireNum = 400;
let loopMul = 10;
let opt;
// Spatial coordinates
let spatialRange = 6;
let xCoord = myLinspace([xNum], -4, 4);
let yCoord = myLinspace([yNum], -4, 4);
let zCoord = myLinspace([zNum], -spatialRange, spatialRange);
// Wire
let wireRange = 8;
let xWireCoord;
let yWireCoord;
let zWireCoord;
// Delta L
let dlx = ndarray(new Float64Array(wireNum));
let dly = ndarray(new Float64Array(wireNum));
let dlz = ndarray(new Float64Array(wireNum));
// Meshgrid
let xMesh;
let yMesh;
let zMesh;
[xMesh, yMesh, zMesh] = meshgrid(xCoord, yCoord, zCoord); // 3D spatial coordinates on each point


// Main interfaces
function myLinspace(shape, start, end, options) {
    /*
     If we use ndarray-linspace package,
     it returns a ndarray with dtype='array',
     but this dtype cannot be used by ndarray-tile package, it needs 'float'.
     So we need to transform dtype manually.
     */
    let tmp = linspace(ndarray([], shape), start, end, options);
    return reshape(ndarray(new Float64Array(tmp.data)), shape);
}

function meshgrid(xArray, yArray, zArray) {
    /*
     Here xArray, yArray, zArray should all be 1d arrays.
     Then it returns 3 fortran-style 3D arrays, that is,
     they are all column-major order:
     http://www.wikiwand.com/en/Row-_and_column-major_order.
     */
    let xMesh = reshape(tile(xArray, [zNum, yNum]), [zNum, xNum, yNum]);
    let yMesh = reshape(
        tile(tile(yArray, [1, xNum]).transpose(1, 0), [zNum]), [zNum, xNum, yNum]
    );
    let zMesh = tile(zArray, [1, xNum, yNum]);
    return [xMesh, yMesh, zMesh];
}

function reshape(oldNdarr, newShape) {
    /*
     Here oldNdarray is a ndarray,
     newShape is an array spcifying the newer one's shape.
     */
    return ndarray(oldNdarr.data, newShape);
}

function crossProduct(arr1, arr2) {
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
    fill(dlx, function (i) {
        return xWireCoord.get(i + 1) - xWireCoord.get(i);
    });
    fill(dly, function (i) {
        return yWireCoord.get(i + 1) - yWireCoord.get(i);
    });
    fill(dlz, function (i) {
        return zWireCoord.get(i + 1) - zWireCoord.get(i);
    });
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
    // This is the integration part of Biot--Savart law.
    for (let i = 0; i < wireNum - 1; i++) {
        let r = calculateR(x, y, z, i);
        let rLength = ops.norm2(ndarray(r)); // L2 norm of vector r
        let dl = [dlx.get(i), dly.get(i), dlz.get(i)];
        ops.muls(aux, ndarray(crossProduct(dl, r)), 1 / Math.pow(rLength, 3));
        ops.addeq(b, aux);
    }
    return ops.mulseq(b, current);
}

function generateBField() {
    let bField = ndarray(new Float64Array(xNum * yNum * zNum * 3), [zNum, xNum, yNum, 3]);
    for (let i = 0; i < zNum; i++) {
        for (let j = 0; j < xNum; j++) {
            for (let k = 0; k < yNum; k++) {
                let bf = calculateB(xCoord.get(j), yCoord.get(k), zCoord.get(i));
                // let bfnorm = ops.norm2(bf);
                bField.set(i, j, k, 0, bf.get(0)); // / bfnorm * 0.5); // Normalized vector
                bField.set(i, j, k, 1, bf.get(1)); /// bfnorm * 0.5);
                bField.set(i, j, k, 2, bf.get(2)); /// bfnorm * 0.5);
            }
        }
    }
    return bField;
}

function parseBField() {
    let bField = generateBField();
    let bFieldX = bField.pick(null, null, null, 0);
    let bFieldY = bField.pick(null, null, null, 1);
    let bFieldZ = bField.pick(null, null, null, 2);
    return [bFieldX, bFieldY, bFieldZ];
}

function vectorFieldEnd() {
    let bFieldX;
    let bFieldY;
    let bFieldZ;
    [bFieldX, bFieldY, bFieldZ] = parseBField();
    ops.addeq(bFieldX, xMesh);
    ops.addeq(bFieldY, yMesh);
    ops.addeq(bFieldZ, zMesh);
    return [bFieldX, bFieldY, bFieldZ];
}

// Plot
function plot() {
    let bFieldX;
    let bFieldY;
    let bFieldZ;
    [bFieldX, bFieldY, bFieldZ] = vectorFieldEnd();

    plt0.data[0].x = unpack(xWireCoord);
    plt0.data[0].y = unpack(yWireCoord);
    plt0.data[0].z = unpack(zWireCoord);

    for (let i = 0; i < zNum; i++) {
        for (let j = 0; j < xNum; j++) {
            for (let k = 1; k <= yNum; k++) {
                plt0.data[i * xNum * yNum + j * yNum + k].x = [xMesh.get(j, k, i), bFieldX.get(j, k, i)];
                plt0.data[i * xNum * yNum + j * yNum + k].y = [yMesh.get(j, k, i), bFieldY.get(j, k, i)];
                plt0.data[i * xNum * yNum + j * yNum + k].z = [zMesh.get(j, k, i), bFieldZ.get(j, k, i)];
            }
            ;
        }
    }

    Plotly.redraw(plt0);
}

function createPlots() {
    let bFieldX;
    let bFieldY;
    let bFieldZ;
    [bFieldX, bFieldY, bFieldZ] = vectorFieldEnd();

    let layout = {
        scene: {
            xaxis: {
                range: [-4, 4],
            },
            yaxis: {
                range: [-4, 4],
            },
            zaxis: {
                range: [-spatialRange, spatialRange],
            },
        },
        showlegend: false,
        height: 800,
    };

    // Plot wire itself
    let wire = {
        mode: 'lines',
        type: 'scatter3d',
        x: unpack(xWireCoord),
        y: unpack(yWireCoord),
        z: unpack(zWireCoord),
        line: {
            color: '#ff0000',
        },
    };

    let data0 = [wire];

    // Plot field vectors
    for (let i = 0; i < zNum; i++) {
        for (let j = 0; j < xNum; j++) {
            for (let k = 0; k < yNum; k++) {
                data0.push({
                    mode: 'lines',
                    type: 'scatter3d',
                    x: [xMesh.get(j, k, i), bFieldX.get(j, k, i)],
                    y: [yMesh.get(j, k, i), bFieldY.get(j, k, i)],
                    z: [zMesh.get(j, k, i), bFieldZ.get(j, k, i)],
                });
            }
        }
    }

    Plotly.newPlot('plt0', data0, layout);
}

// Adjust Plotly's plotRatios size responsively according to window motion
window.onresize = function () {
    Plotly.Plots.resize(plt0);
};


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
            case 'Circle':
                opt = 2;
                break;
            case 'Toroidal solenoid':
                opt = 3;
                break;
        }
        setWire(opt);
        plot();
    });

function setWire(opt) {
    switch (opt) {
        case 0: // Generate a straight wire
            xWireCoord = ndarray(new Float64Array(wireNum));
            yWireCoord = ndarray(new Float64Array(wireNum));
            zWireCoord = myLinspace([wireNum], -wireRange, wireRange);
            break;
        case 1: // Generate a solenoid
            xWireCoord = ops.coseq(
                ops.mulseq(myLinspace([wireNum], -wireRange, wireRange), loopMul)
            );
            yWireCoord = ops.sineq(
                ops.mulseq(myLinspace([wireNum], -wireRange, wireRange), loopMul)
            );
            zWireCoord = myLinspace([wireNum], -wireRange, wireRange);
            break;
        case 2: // Generate a circle
            xWireCoord = ops.coseq(myLinspace([wireNum], 0, 2 * Math.PI, {
                endpoint: false,
            }));
            yWireCoord = ops.sineq(myLinspace([wireNum], 0, 2 * Math.PI, {
                endpoint: false,
            }));
            zWireCoord = myLinspace([wireNum], 0, 0);
            zCoord = myLinspace([zNum], -2, 2);
            break;
        case 3: // Generate a toroidal solenoid
            let R = 3;
            let r = 0.5;
            let n = 60;
            let u = unpack(myLinspace([2 * wireNum], 0, 2 * Math.PI));
            xWireCoord = u.map(function (x) {
                return (R + r * Math.cos(n * x)) * Math.cos(x);
            });
            yWireCoord = u.map(function (x) {
                return (R + r * Math.cos(n * x)) * Math.sin(x);
            });
            zWireCoord = u.map(function (x) {
                return r * Math.sin(n * x);
            });
            xWireCoord = ndarray(new Float64Array(xWireCoord));
            yWireCoord = ndarray(new Float64Array(yWireCoord));
            zWireCoord = ndarray(new Float64Array(zWireCoord));
        default:
            new RangeError('This option is not valid!');
    }
}


// Initialize
setWire(1);
setDeltaLArray();
createPlots();
