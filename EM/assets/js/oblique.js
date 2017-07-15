/**
 * Created by Qi on 5/27/17.
 */

///////////////////////////////////////////////////////////////////////////
///////////////////////////// Main part ///////////////////////////////////
///////////////////////////////////////////////////////////////////////////
/* jshint -W097 */
'use strict';
// Import libraries
var numeric = require('numeric');
var ndarray = require('ndarray');


// Variables
var n1Slider = $('#n1').bootstrapSlider();
var n2Slider = $('#n2').bootstrapSlider();
var thetaISlider = $('#thetaI').bootstrapSlider();
var n1 = n1Slider.bootstrapSlider('getValue'); // Get refraction index from slider bar
var n2 = n2Slider.bootstrapSlider('getValue'); // Get refraction index from slider bar
var thetaI = thetaISlider.bootstrapSlider('getValue'); // Get incident angle from slider bar
var plt0 = document.getElementById('plt0');
var plt1 = document.getElementById('plt1');
// Variables for calculation
var epsilon1 = Math.pow(n1, 2); // Permittivity
var epsilon2 = Math.pow(n2, 2); // Permittivity


// Interactive interfaces
thetaISlider.on('change', function () {
    thetaI = thetaISlider.bootstrapSlider('getValue');
    plotRatios();
    updateSlopes();
    plotHeatmap();

    $('#thetaISliderVal').text(thetaI);
});

n1Slider.on('change', function () {
    n1 = n1Slider.bootstrapSlider('getValue');
    [reflectRatioList, transmitRatioList] = updateRatioLists();
    plotRatios();
    plotRatioLists();
    plotBrewsterAngle();
    updateSlopes();
    plotHeatmap();

    $('#n1SliderVal').text(n1);
});

n2Slider.on('change', function () {
    n2 = n2Slider.bootstrapSlider('getValue');
    [reflectRatioList, transmitRatioList] = updateRatioLists();
    plotRatios();
    plotRatioLists();
    plotBrewsterAngle();
    updateSlopes();
    plotHeatmap();

    $('#n2SliderVal').text(n2);
});


// Adjust Plotly's plotRatios size responsively according to window motion
window.onresize = function () {
    Plotly.Plots.resize(plt0);
    Plotly.Plots.resize(plt1);
};


///////////////////////////////////////////////////////////////////////////
////////////////// Reflection and transmission ratios /////////////////////
///////////////////////////////////////////////////////////////////////////
var reflectRatioList, transmitRatioList;
var thetaIList = numeric.linspace(0, Math.PI / 2, 250);


// Main interfaces
function updateRatioValues(tI) {
    /*
     Accept an incident angle tI, return the reflection ratio and transmission ratio.
     */
    var alpha = Math.sqrt(1 - Math.pow(n1 / n2, 2) * Math.pow(Math.sin(tI), 2)) / Math.cos(tI);
    var beta = n1 / n2 * epsilon2 / epsilon1;
    var t = 2 / (alpha + beta);
    var r = (alpha - beta) / (alpha + beta);
    return [r, t];
}

function updateRatioLists() {
    /*
     Return: An array of [[r0, r1, ...], [t0, t1, ...]].
     */
    return numeric.transpose(thetaIList.map(updateRatioValues));
}

function updateBrewsterAngle() {
    /*
     Brewster angle changes when n1, n2 changes.
     */
    epsilon1 = Math.pow(n1, 2);
    epsilon2 = Math.pow(n2, 2);
    return Math.atan(n1 / n2 * epsilon2 / epsilon1);
}


// Plot
function plotRatios() {
    /*
     Make 2 "ratios" points move as their real values.
     */
    plt1.data[2].x = [thetaI, thetaI];
    plt1.data[2].y = updateRatioValues(thetaI);
    Plotly.redraw(plt1);
}

function plotRatioLists() {
    /*
     Re-plot 2 curves.
     */
    plt1.data[0].y = reflectRatioList;
    plt1.data[1].y = transmitRatioList;

    Plotly.redraw(plt1);
}

function plotBrewsterAngle() {
    plt1.data[3].x = [updateBrewsterAngle()];
    Plotly.redraw(plt1);
}

function createRatioPlot() {
    var layout = {
        title: 'reflection and transmission ratio',
        xaxis: {
            title: 'theta_I',
            titlefont: {
                size: 18
            },
            tickmode: 'array',
            tickvals: [0, Math.PI / 12, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2],
            ticktext: ['0', 'pi/12', 'pi/6', 'pi/4', 'pi/3', 'pi/2']
        },
        yaxis: {
            title: 'Ratio',
            titlefont: {
                size: 18
            }
        }
    };

    var data = [{
        x: thetaIList,
        y: reflectRatioList,
        type: 'scatter',
        mode: 'lines',
        name: 'r'
    },
        {
            x: thetaIList,
            y: transmitRatioList,
            type: 'scatter',
            mode: 'lines',
            name: 't'
        },
        {
            x: [thetaI, thetaI],
            y: updateRatioValues(thetaI),
            type: 'scatter',
            mode: 'markers',
            name: 'ratios'
        },
        {
            x: [updateBrewsterAngle()],
            y: [0],
            type: 'scatter',
            mode: 'markers',
            name: 'Brewster angle'
        }
    ];

    Plotly.newPlot(plt1, data, layout);
}


///////////////////////////////////////////////////////////////////////////
//////////////////// EM oblique incidence on media ////////////////////////
///////////////////////////////////////////////////////////////////////////
var yCoord = numeric.linspace(-5, 5, 250);
var zUpperCoord = numeric.linspace(5, 0, 125);
var zLowerCoord = numeric.linspace(0, -5, 125);
var incidentSlope;
var reflectSlope;
var transmitSlope;
console.log(zUpperCoord);

function kr(kx, ky, kz, x, y, z) {
    /*
     Wave vector times position vector. Input Cartesian coordinates xx, yy, and zz,
     then function will return scalar value of $\mathbf{k} \cdot \mathbf{r}$, where
     $\mathbf{k} = (kx, ky, kz)$, $\mathbf{r} = (x, y, z)$.
     */
    var metricTensor = [
        [Math.cos(Math.PI / 2 - thetaI), 0, Math.cos(thetaI)],
        [0, 1, 0],
        [Math.cos(thetaI), 0, Math.cos(Math.PI / 2 - thetaI)]
    ];
    return numeric.dot([kx, ky, kz], numeric.dot(metricTensor, [x, y, z]));
}

function updateUpperAmplitude() {
    /*
     The incident E-field amplitude changes with x, y, z spatial coordinates, and thetaI.
     */
    var amp = [];
    var r = updateRatioValues(thetaI)[0];
    for (var i = 0; i < yCoord.length; i++) {
        amp[i] = [];
        for (var j = 0; j < zUpperCoord.length; j++) {
            var kDotR = kr(1, 0, 1, zUpperCoord[j], 0, yCoord[i]);
            var kpDotR = kr(1, 0, -1, zUpperCoord[j], 0, yCoord[i]);
            amp[i][j] = Math.sqrt(
                Math.pow(1 * Math.cos(thetaI) * Math.cos(kDotR) +
                    r * 1 * Math.cos(thetaI) * Math.cos(kpDotR), 2) +
                Math.pow(-1 * Math.sin(thetaI) * Math.cos(kDotR) +
                    r * 1 * Math.sin(thetaI) * Math.cos(kpDotR), 2)
            )
        }
    }

    return amp;
}

function updateTransmitAmplitude() {
    /*
     The transmissive E-field amplitude changes with x, y, z spatial coordinates, n1, n2 and thetaI.
     */
    var transamp = [];
    for (var i = 0; i < yCoord.length; i++) {
        transamp[i] = [];
        for (var j = 0; j < zLowerCoord.length; j++) {
            transamp[i][j] = updateRatioValues(thetaI)[1];
        }
    }

    return transamp;
}

function updateSlopes() {
    /*
     Update incident/reflective/transmitted light slopes according to slider motion.
     Those change when thetaI, n1, and n2 change.
     */
    var thetaT = Math.asin(n1 / n2 * Math.sin(thetaI)); // Transmission angle
    incidentSlope = -Math.tan(thetaI);
    reflectSlope = Math.tan(thetaI);
    transmitSlope = -Math.tan(thetaT);
}


// Plot
function plotHeatmap() {
    plt0.data[0].z = updateUpperAmplitude();
    plt0.data[1].z = updateTransmitAmplitude();

    Plotly.redraw(plt0);
}

// console.log(updateUpperAmplitude().concat(updateTransmitAmplitude()))


function createHeatmap() {
    var upper = {
        x: yCoord,
        y: zUpperCoord.concat(zLowerCoord),
        z: updateUpperAmplitude(),
        type: 'heatmap',
        colorscale: 'Viridis',
        zmin: -2,
        zmax: 10
    };

    var data = [upper];

    var layout = {
        title: 'E filed amplitude',
        yaxis: {
            domain: [0.6, 1]
        },
        yaxis2: {
            domain: [0, 0.4],
            title: 'z'
        },
        xaxis2: {
            anchor: 'y2',
            title: 'y'
        }
    };

    Plotly.newPlot('plt0', data, layout);
}


///////////////////////////////////////////////////////////////////////////
///////////////////////////// Initialize //////////////////////////////////
///////////////////////////////////////////////////////////////////////////
$('#thetaISliderVal').text(thetaI);
$('#n1SliderVal').text(n1);
$('#n2SliderVal').text(n2);
// Left panel
updateSlopes();
createHeatmap();
// Right panel
[reflectRatioList, transmitRatioList] = updateRatioLists();
createRatioPlot();