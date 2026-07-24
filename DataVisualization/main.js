

const state = { scene: 1, currentHour: 0 };
let systemTotalRiders = 0;
let maxStationHourlyRiders = 0;
let stationHeatScale;
let stationRadiusScale;
let heatScale;
let systemHourlyTotals = new Array(167).fill(0);
let highestLinePeak = 0;

let busiestSingleLine = "";
let busiestSingleLineIndex = 0;
let lowestLineValley = Infinity; 
let quietestSingleLine = "";
let quietestSingleLineIndex = 0;


const width = 1000;
const height = 800;
const svg = d3.select("#viz-container")
              .append("svg")
                .attr("viewBox", `0 0 ${width} ${height}`)
              .style("width", "100%")
              .style("height", "100%");


const zoomLayer = svg.append("g").attr("id", "zoom-layer");

// map layer goes inside zoom layer
const mapLayer = zoomLayer.append("g").attr("id", "osm-background");
const subwayLayer = zoomLayer.append("g").attr("id", "subway-layer");
const segmentLayer = zoomLayer.append("g").attr("id", "segment-layer");

// get background map projection
const projection = d3.geoMercator()
                     .center([-73.94, 40.70]) 
                     .scale(90000)            
                     .translate([width / 2, height / 2]);

const pathGenerator = d3.geoPath().projection(projection);

// background generation
const tile = d3.tile()
    .size([width, height])
    .scale(projection.scale() * 2 * Math.PI)
    .translate(projection([0, 0]));

// Generate the array of tiles
const tiles = tile();

// Append the tile images to the mapLayer
mapLayer.selectAll("image")
    .data(tiles)
    .join("image")
    // d[2] is zoom, d[0] is x, d[1] is y
   .attr("xlink:href", d => `https://basemaps.cartocdn.com/light_nolabels/${d[2]}/${d[0]}/${d[1]}.png`)
    .attr("x", d => (d[0] + tiles.translate[0]) * tiles.scale)
    .attr("y", d => (d[1] + tiles.translate[1]) * tiles.scale)
    .attr("width", tiles.scale)
    .attr("height", tiles.scale);

mapLayer.attr("opacity", 0.4); 

const strokeScale = d3.scaleLinear()
    .domain([1, 8])      
    .range([2, 16])     
    .clamp(true);

// Official MTA Subway Colors
const mtaColors = {
    "A": "#0039A6", "C": "#0039A6", "E": "#0039A6", // Blue
    "B": "#FF6319", "D": "#FF6319", "F": "#FF6319", "M": "#FF6319", // Orange
    "G": "#6CBE45", // Light Green
    "J": "#996633", "Z": "#996633", // Brown
    "L": "#A7A9AC", // Gray
    "N": "#FCCC0A", "Q": "#FCCC0A", "R": "#FCCC0A", "W": "#FCCC0A", // Yellow
    "1": "#EE352E", "2": "#EE352E", "3": "#EE352E", // Red
    "4": "#00933C", "5": "#00933C", "6": "#00933C", // Green
    "7": "#B933AD", // Purple
    "SIR": "#0039A6", // Staten Island
    "S": "#212121", "FS": "#212121", "GS": "#212121" // Shuttles
};

// Helper function to match the service name to a color
function getLineColor(trainLetter) {
    const mtaColors = {
            "A": "#0039A6", "C": "#0039A6", "E": "#0039A6",
            "B": "#FF6319", "D": "#FF6319", "F": "#FF6319", "M": "#FF6319",
            "G": "#6CBE45",
            "J": "#996633", "Z": "#996633",
            "L": "#A7A9AC",
            "N": "#FCCC0A", "Q": "#FCCC0A", "R": "#FCCC0A", "W": "#FCCC0A",
            "1": "#EE352E", "2": "#EE352E", "3": "#EE352E",
            "4": "#00933C", "5": "#00933C", "6": "#00933C",
            "7": "#B933AD",
            "ST": "#808183", "SF": "#808183", "SR": "#808183"
        };
        
        // Return the official color, or a default gray if it somehow misses
        return mtaColors[trainLetter] || "#999999";
}

const lineOffsets = {
    "A": [8, 8], "C": [4, 4], "E": [-4, -4],
    "N": [0, 0], "Q": [4, 4], "R": [7, 7], "W": [-4, -4],
    "1": [0, 0], "2": [4, 4], "3": [-4, -4],
    "4": [0, 0], "5": [8, 8], "6": [-4, -4],
    "B": [0, 0], "D": [6, 6], "F": [-6, -6], "M": [9, 9],
    "J": [-4, -4], "Z": [4, 4],
};

function getOffset(serviceName) {
    if (!serviceName) return "translate(0,0)";
    let firstChar = String(serviceName).charAt(0).toUpperCase();
    let offset = lineOffsets[firstChar] || [0, 0];
    return `translate(${offset[0]}, ${offset[1]})`;
}

function updateTimelineTicks(totalsArray, contextName) {
    // Calculate Extremes
    const maxVal = d3.max(totalsArray);
    const minVal = d3.min(totalsArray);
    const maxIndex = totalsArray.indexOf(maxVal);
    const minIndex = totalsArray.indexOf(minVal);

    // Calculate Weekend Peak
    const weekendTotals = totalsArray.slice(119);
    const weekendMaxVal = d3.max(weekendTotals);
    const weekendMaxIndex = totalsArray.indexOf(weekendMaxVal, 119);

    // Calculate Steepest Drop
    let steepestDrop = 0;
    let steepestDropIndex = 0;
    for (let i = 1; i < totalsArray.length; i++) {
        const drop = totalsArray[i - 1] - totalsArray[i];
        if (drop > steepestDrop) {
            steepestDrop = drop;
            steepestDropIndex = i;
        }
    }

    // Update Global State
    state.maxIndex = maxIndex;
    state.minIndex = minIndex;
    state.weekendIndex = weekendMaxIndex;
    state.dropIndex = steepestDropIndex;

    // Calculate Percentages
    const maxPercent = (maxIndex / 166) * 100;
    const minPercent = (minIndex / 166) * 100;
    const weekendPercent = (weekendMaxIndex / 166) * 100;
    const dropPercent = (steepestDropIndex / 166) * 100;

    // Move the HTML Text Annotations
    d3.select("#marker-max").style("left", `${maxPercent}%`)
      .text(`↑ Busiest ${contextName} Hour: ${maxVal.toLocaleString()}`);
      
    d3.select("#marker-min").style("left", `${minPercent}%`)
      .text(`↓ Quietest ${contextName} Hour: ${minVal.toLocaleString()}`);
      
    d3.select("#marker-weekend").style("left", `${weekendPercent}%`)
      .text(`☀ Weekend Peak: ${weekendMaxVal.toLocaleString()}`);
      
    d3.select("#marker-drop").style("left", `${dropPercent}%`)
      .text(`↘ Steepest Drop (-${steepestDrop.toLocaleString()})`);

    // Move the HTML Physical Ticks
    d3.select("#tick-max").style("left", `${maxPercent}%`);
    d3.select("#tick-min").style("left", `${minPercent}%`);
    d3.select("#tick-weekend")
      .style("left", `${weekendPercent}%`)
      .style("background-color", "#f1c40f"); // Yellow for Weekend Peak

    d3.select("#tick-drop")
      .style("left", `${dropPercent}%`)
      .style("background-color", "#e67e22"); // Orange for Steepest Drop
    
}

const tooltip = d3.select("body").append("div")
    .attr("id", "tooltip");

// --- Draw Subway Lines ----
d3.json("final_d3_subway_data4.geojson").then(subwayData => {
    
    // Filter out Shuttles
    const excludedLines = ["SIR", "ST", "SF", "SR", "FS", "GS"];
    subwayData.features = subwayData.features.filter(route => {
        return !excludedLines.includes(route.properties.service);
    });

    console.log("First Train Line Properties:", subwayData.features[0].properties);
    
    // Globals
    systemTotalRiders = 0;
    const countedLinesForTotal = new Set(); 
    systemHourlyTotals = new Array(167).fill(0);
    
    highestLinePeak = 0;
    let maxHourlyRiders = 0; 
    busiestSingleLine = "";
    busiestSingleLineIndex = 0;

    lowestLineValley = Infinity; 
    quietestSingleLine = "";
    quietestSingleLineIndex = 0;

    // Master Aggregation Loop
    subwayData.features.forEach(route => {

        const trainLetter = route.properties.service;

        // Initialize arrays for this specific map segment
        route.properties.lineTotal = 0;
        route.properties.hourlyTotals = new Array(167).fill(0);
        
        if (route.properties.stations) {
            // Check if we've already added this trains riders
            let isFirstTimeSeeingLine = !countedLinesForTotal.has(trainLetter);

            route.properties.stations.forEach(station => {
                if (station.ridership && Array.isArray(station.ridership)) {

                    const maxHourForThisStation = d3.max(station.ridership) || 0;
                    if (maxHourForThisStation > maxStationHourlyRiders) {
                        maxStationHourlyRiders = maxHourForThisStation;
                    }

                    station.ridership.forEach((val, i) => {
                        // Apply to this specific map segment so the heatmap colors work
                        route.properties.lineTotal += val;
                        route.properties.hourlyTotals[i] += val;
                        
                        // Only add to the system totals if it's the first time seeing this line
                        if (isFirstTimeSeeingLine) {
                            systemTotalRiders += val;
                            systemHourlyTotals[i] += val; 
                        }
                    });
                }
            });
            
            countedLinesForTotal.add(trainLetter);
            
            // Check if this line broke the all-time record
            const maxHourForLine = d3.max(route.properties.hourlyTotals) || 0;
            if (maxHourForLine > highestLinePeak) {
                highestLinePeak = maxHourForLine;
                busiestSingleLine = trainLetter;
                busiestSingleLineIndex = route.properties.hourlyTotals.indexOf(maxHourForLine);
            }

            const minHourForLine = d3.min(route.properties.hourlyTotals);
            if (minHourForLine < lowestLineValley) {
                lowestLineValley = minHourForLine;
                quietestSingleLine = trainLetter;
                quietestSingleLineIndex = route.properties.hourlyTotals.indexOf(minHourForLine);
            }
        }
    });
    const lineMaxPercent = (busiestSingleLineIndex / 166) * 100;
    const lineMinPercent = (quietestSingleLineIndex / 166) * 100;

    // Update Global State so the slider active state works
    state.busiestLineIndex = busiestSingleLineIndex;
    state.quietestLineIndex = quietestSingleLineIndex;

    d3.select("#marker-line-max")
      .style("left", `${lineMaxPercent}%`)
      .text(`☆ Busiest Line: ${busiestSingleLine} Train (${highestLinePeak.toLocaleString()})`)
      .style("color", getLineColor(busiestSingleLine)); 

    d3.select("#marker-line-min")
      .style("left", `${lineMinPercent}%`)
      .text(`☆ Quietest Line: ${quietestSingleLine} Train (${lowestLineValley.toLocaleString()})`)
      .style("color", getLineColor(quietestSingleLine)); 

    d3.select("#tick-line-max")
      .style("left", `${lineMaxPercent}%`)
      .style("background-color", getLineColor(busiestSingleLine));
    
    d3.select("#tick-line-min")
      .style("left", `${lineMinPercent}%`)
      .style("background-color", getLineColor(quietestSingleLine));

    console.log("System Total Riders:", systemTotalRiders);
    const dayStarts = [
            { letter: "M", hour: 0 },
            { letter: "T", hour: 24 },
            { letter: "W", hour: 48 },
            { letter: "T", hour: 72 },
            { letter: "F", hour: 96 },
            { letter: "S", hour: 120 },
            { letter: "S", hour: 144 }
        ];

    d3.select("#day-letters").selectAll(".day-label")
        .data(dayStarts)
        .join("div")
        .attr("class", "day-label")
        .style("position", "absolute")
        .style("left", d => `${(d.hour / 166) * 100}%`)
        .style("transform", d => d.hour === 0 ? "translateX(0%)" : "translateX(-50%)") 
        .style("transform", "translateY(-50%)")
        .text(d => d.letter);
            
    // Create the global Green-to-Red color scale
    heatScale = d3.scaleLinear()
        .domain([0, highestLinePeak]) 
        .range(["#2ecc71", "#e74c3c"]) 
        .interpolate(d3.interpolateHcl);
    
        stationHeatScale = d3.scaleLinear()
        .domain([0, maxStationHourlyRiders]) 
        .range(["#2ecc71", "#e74c3c"]) // Green to Red
        .interpolate(d3.interpolateHcl);
    
        console.log("Subway Data Loaded:", subwayData);
    subwayLayer.selectAll(".subway-path")
        .data(subwayData.features)
        .join("path")
        .attr("class", "subway-path")
        .attr("d", pathGenerator)
        .each(function(d) {
            console.log(d.properties.service_name);
        })
        .attr("stroke", d => getLineColor(d.properties.service))
        .attr("stroke-width", 3)
        .attr("transform", d => getOffset(d.properties.service))
        .on("click", function(event, d) {
            state.selectedLine = d.properties.service_name;
            state.scene = 2;
            console.log("Transitioning to Scene 2 for line:", state.selectedLine);
        })
        .on("mouseover", function(event, d) {
           d3.select(this).raise(); 
           d3.select(this).attr("stroke-width", 6);
           
           // Determine color based on the current scene
           const activeColor = state.scene === 1 
               ? getLineColor(d.properties.service) 
               : heatScale(d.properties.lineTotal);
           
           // Format the line total if we are in Scene 2
           const formatNumber = d3.format(",");
            let statsHtml = "";
           
           if (state.scene === 2) {
               // Pull the ridership for the specific hour currently set on the slider
               const currentHourlyVolume = d.properties.hourlyTotals[state.currentHour];
               statsHtml = `<div style="font-size: 12px; font-weight: normal; margin-top: 4px; color: #aaa;">${formatNumber(currentHourlyVolume)} Riders</div>`;
           }

           tooltip.html(`
               <span class="tooltip-bullet" style="background-color: ${activeColor};"></span>
               ${d.properties.service} Train
               ${statsHtml}
           `);
           
           tooltip.transition().duration(400).style("opacity", 1);
       })
        .on("mousemove", function(event) {
            // Instantly update the coordinates as the mouse moves
            tooltip.style("left", event.pageX + "px")
                    .style("top", event.pageY + "px");
        })
        .on("mouseout", function(event, d) {
            // Return the line to its normal width
            const currentK = d3.zoomTransform(svg.node()).k;
            const targetVisualWidth = strokeScale(currentK);
            d3.select(this).attr("stroke-width", targetVisualWidth / currentK); 
            
            // Fade the tooltip out
            tooltip.transition().duration(400).style("opacity", 0);
        })

        .on("click", function(event, d) {
            // Only trigger the deep dive if the user is currently in Scene 2
            if (state.scene === 2 || state.scene === 3) {
                console.log(`Transitioning to Scene 3 for the ${d.properties.service} line`);
                renderScene3(d.properties.service, d);
            }
        });
        
        updateTimelineTicks(systemHourlyTotals, "System");
        
        renderScene1(systemTotalRiders);
});

const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", function(event) {
        
        // Scale and translate the geometry
        subwayLayer.attr("transform", event.transform);
        segmentLayer.attr("transform", event.transform);

        // alculate the exact visual stroke width
        const targetVisualWidth = strokeScale(event.transform.k);
        const actualSvgWidth = targetVisualWidth / event.transform.k;
        
        // Apply width changes to the background lines
        subwayLayer.selectAll(".subway-path")
                   .attr("stroke-width", actualSvgWidth);
                   
        // Apply width changes to the heat segments
        segmentLayer.selectAll(".heat-segment")
                    .attr("stroke-width", actualSvgWidth);
        
        // Tile recalculation
        const currentScale = projection.scale() * 2 * Math.PI * event.transform.k;
        const tileGen = d3.tile()
            .size([width, height])
            .scale(currentScale)
            .translate([
                projection([0, 0])[0] * event.transform.k + event.transform.x, 
                projection([0, 0])[1] * event.transform.k + event.transform.y
            ]);

        const newTiles = tileGen();
        
        mapLayer.attr("transform", null); 
        mapLayer.selectAll("image")
            .data(newTiles, d => d)
            .join("image")
            .attr("xlink:href", d => `https://basemaps.cartocdn.com/light_nolabels/${d[2]}/${d[0]}/${d[1]}.png`)
            .attr("x", d => (d[0] + newTiles.translate[0]) * newTiles.scale)
            .attr("y", d => (d[1] + newTiles.translate[1]) * newTiles.scale)
            .attr("width", newTiles.scale)
            .attr("height", newTiles.scale);
    });

function updateMapByHour(hourIndex, animate = true) {
    state.currentHour = parseInt(hourIndex, 10);
    // Calculate the readable day and time
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const day = days[Math.floor(hourIndex / 24)];
    
    let hour24 = hourIndex % 24;
    const ampm = hour24 >= 12 ? "PM" : "AM";
    let hour12 = hour24 % 12;
    hour12 = hour12 ? hour12 : 12; // Convert 0 to 12 for midnight/noon

    // Update the text labels in the sidebar
    d3.select("#slider-day").text(day +  "\u00A0" );
    d3.select("#slider-time").text(hour12 + ":00 " + ampm);
    
    d3.select("#marker-max").classed("active", state.currentHour === state.maxIndex);
    d3.select("#marker-min").classed("active", state.currentHour === state.minIndex);

    d3.select("#marker-line-min").classed("active", state.currentHour === state.quietestLineIndex);
    d3.select("#marker-line").classed("active", state.currentHour === state.busiestLineIndex);
    d3.select("#marker-weekend").classed("active", state.currentHour === state.weekendIndex);
    d3.select("#marker-drop").classed("active", state.currentHour === state.dropIndex);
    const activeMaxLineIndex = state.scene === 3 ? state.peakStationHourIndex : state.busiestLineIndex;
    d3.select("#marker-line-max").classed("active", state.currentHour === activeMaxLineIndex);

    // Push the new color data to the renderer
    if (state.scene === 1) {
        d3.selectAll(".subway-path")
            .transition()
            .duration(animate ? 1200 : 400)
            .attr("stroke", d => getLineColor(d.properties.service))
            .attr("stroke-opacity", 1) 
            .attr("stroke-width", 3);  
            
    } else if (state.scene === 2) {
        d3.selectAll(".subway-path")
            .transition()
            .duration(animate ? 1200 : 400) 
            .attr("stroke", d => heatScale(d.properties.hourlyTotals[hourIndex]))
            .attr("stroke-opacity", 1)
            .attr("stroke-width", 3);  
    }else if (state.scene === 3) {
        d3.selectAll(".heat-segment")
            .transition()
            .duration(animate ? 1200 : 400)
            .attr("stroke", d => stationHeatScale(d.ridership[state.currentHour]));
    }
}


function renderScene1(weeklyRidership) {
    state.scene = 1;
    state.selectedLine = null;

    const formatNumber = d3.format(",");
    const sidebar = d3.select("#sidebar");
    subwayLayer.selectAll(".subway-path")
        .transition()
        .duration(1200)
        .attr("stroke", d => getLineColor(d.properties.service));
           
    sidebar.html(`
        <div class="panel-title">The Lifeline of NYC</div>
        <div class="panel-body">Operating 24/7 across 472 stations, the NYC subway is the largest rapid transit system in the world by number of stations.</div>
        <!-- <div class="panel-body">It serves a metropolitan population of over 20 million people, acting as the circulatory system for the local economy.</div> --!>
        <div class ="panel-body">From 9/8/2025 to 9/14/2025, the subway system experienced its busiest week in its <strong>121</strong> years of service.</div>
        <div class="panel-stat" id="animated-stat">0</div>
        <div class="panel-label">Total System-Wide Riders</div>
        
        <div class="panel-body" style="font-size: 13px; color: #666; margin-top: auto; border-top: 1px solid #333; padding-top: 20px;">
            <strong>Interaction:</strong> Hover over any subway line on the map to identify the route.
        </div>
        
        <button class="scene-btn" id="btn-scene-2">View Density Heatmap &#8594;</button>
    `);

    // Animate the number counting up
    d3.select("#animated-stat")
        .transition()
        .duration(2500) 
        .ease(d3.easeCubicOut) 
        .tween("text", function() {
            const i = d3.interpolateRound(0, systemTotalRiders);
            return function(t) {
                this.textContent = formatNumber(i(t)); 
            };
        });

    d3.select("#btn-scene-2").on("click", renderScene2);

    d3.select("#bottom-timeline").style("display", "none");
    d3.select("#time-display").style("display", "none"); 
}

function renderScene2() {
    state.scene = 2;
    const segLayer = d3.select("#segment-layer");
    segLayer.selectAll("*").interrupt(); 
    segLayer.selectAll("*").remove();

    // Restore full opacity and base widths to all subway lines
    d3.selectAll(".subway-path")
        .transition()
        .duration(800)
        .attr("stroke-opacity", 1)
        .attr("stroke-width", 3);

    const sidebar = d3.select("#sidebar");
    
    sidebar.html(`
        <div class="panel-title">Dynamic Line Usage</div>
        <div class="panel-body">
            By transitioning from standard MTA branding to a density heatmap, we can instantly identify the heaviest usage of the network throughout each day of the week.
        </div>

        <div class="panel-body" style="margin-top: 24px;">
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="display: inline-block; width: 14px; height: 14px; background-color: #e74c3c; border-radius: 50%; margin-right: 10px;"></span>
                <span">High Volume (Max Traffic)</span>
            </div>
            <div style="display: flex; align-items: center;">
                <span style="display: inline-block; width: 14px; height: 14px; background-color: #2ecc71; border-radius: 50%; margin-right: 10px;"></span>
                <span">Low Volume Routes</span>
            </div>
        </div>

        <div class="panel-body" style="font-size: 13px; color: #666; margin-top: auto; border-top: 1px solid #333; padding-top: 20px;">
            <strong>Interaction:</strong> Hover over a line to see exactly how many riders it supports each hour.
        </div>
        <button class="scene-btn" id="btn-scene-1">&#8592 Back</button>
        
    `);
    // Restore the timeline ticks to the global system totals
    updateTimelineTicks(systemHourlyTotals, "System");

    // Unhide the global system comparison ticks
    const lineMaxPercent = (busiestSingleLineIndex / 166) * 100;
    const lineMinPercent = (quietestSingleLineIndex / 166) * 100;

    d3.select("#marker-line-max")
        .style("display", "block")
        .style("left", `${lineMaxPercent}%`)
        .text(`☆ Busiest Line: ${busiestSingleLine} Train (${highestLinePeak.toLocaleString()})`)
        .style("color", getLineColor(busiestSingleLine));

    d3.select("#tick-line-max")
        .style("display", "block")
        .style("left", `${lineMaxPercent}%`)
        .style("background-color", getLineColor(busiestSingleLine));

    d3.select("#marker-line-min").style("display", "block");
    d3.select("#tick-line-min").style("display", "block");
    // Force the map to immediately draw Hour 0
    updateMapByHour(0);

    // Attach the event listener to the slider
    d3.select("#timeSlider").on("input", function() {
        updateMapByHour(this.value, false);
    });

    d3.select("#btn-scene-1").on("click", renderScene1);

    d3.select("#bottom-timeline").style("display", "block");
    d3.select("#time-display").style("display", "block"); 
    
}

function renderScene3(selectedTrainLetter, routeData) {
state.scene = 3;
    state.selectedLine = selectedTrainLetter;

    // Clear any existing segments before drawing new ones
    segmentLayer.selectAll(".heat-segment").remove();

    // Calculate the maximum station volume for THIS specific line
    let currentLineMaxStationVolume = 0;
    let peakStationName = "";
    let peakStationHourIndex = 0;
    const stations = routeData.properties.stations || [];
    
    stations.forEach(station => {
        if (station.ridership) {
            const stationMax = d3.max(station.ridership) || 0;
            if (stationMax > currentLineMaxStationVolume) {
                currentLineMaxStationVolume = stationMax;
                peakStationName = station.name;
                peakStationHourIndex = station.ridership.indexOf(stationMax);
            }
        }
    });

    // Save this to the state so the timeline slider can highlight it
    state.peakStationHourIndex = peakStationHourIndex;

    stationHeatScale.domain([0, currentLineMaxStationVolume || 1]);
    const sidebar = d3.select("#sidebar");
    sidebar.html(`
        <div class="panel-title">${selectedTrainLetter} Train Heatmap</div>
        <div class="panel-body">
            Station-to-station volume breakdown for the ${selectedTrainLetter} line.
            <br><br>
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="display: inline-block; width: 14px; height: 14px; background-color: #e74c3c; border-radius: 50%; margin-right: 10px;"></span>
                <span">High Volume (Max Traffic)</span>
            </div>
            <div style="display: flex; align-items: center;">
                <span style="display: inline-block; width: 14px; height: 14px; background-color: #2ecc71; border-radius: 50%; margin-right: 10px;"></span>
                <span">Low Volume Routes</span>
            </div>
            <span style="font-size: 12px; color: #aaa;">
                Scale calibrated to peak station service: <strong>${d3.format(",")(currentLineMaxStationVolume)} riders</strong>
            </span>
        </div>
        <button class="scene-btn" id="btn-scene-2">&#8592 Back to Network Heatmap</button>
    `);

    updateTimelineTicks(routeData.properties.hourlyTotals, "Line");

    // Hide the global system comparison ticks to prevent clutter
    d3.select("#marker-line-min").style("display", "none");
    d3.select("#tick-line-min").style("display", "none"); 
    d3.select("#btn-scene-2").on("click", renderScene2);

    const peakStationPercent = (peakStationHourIndex / 166) * 100;
    d3.select("#marker-line-max")
        .style("display", "block")
        .style("left", `${peakStationPercent}%`)
        .text(`★ Peak Station: ${peakStationName}`)
        .style("color", getLineColor(selectedTrainLetter));
        
    d3.select("#tick-line-max")
        .style("display", "block")
        .style("left", `${peakStationPercent}%`)
        .style("background-color", getLineColor(selectedTrainLetter));


    // Fade base subway geometry into a dark ghost track
    subwayLayer.selectAll(".subway-path")
        .transition()
        .duration(800)
        .attr("stroke", d => d.properties.service === selectedTrainLetter ? "#444" : "#222")
        .attr("stroke-opacity", d => d.properties.service === selectedTrainLetter ? 0.6 : 0.15)
        .attr("stroke-width", d => d.properties.service === selectedTrainLetter ? 5 : 1);

    // Generate Segments
    const segments = [];
    const unvisited = [...(routeData.properties.stations || [])];
    const visited = [];

if (unvisited.length > 0) {
        
        visited.push(unvisited.shift());

        // Keep looping until every single station is attached to the web
        while (unvisited.length > 0) {
            let shortestDist = Infinity;
            let bestVisited = null;
            let bestUnvisitedIdx = -1;

            // Find the closest physical pair between the connected tree and the remaining stations
            for (let i = 0; i < visited.length; i++) {
                for (let j = 0; j < unvisited.length; j++) {
                    const dx = visited[i].longitude - unvisited[j].longitude;
                    const dy = visited[i].latitude - unvisited[j].latitude;
                    const dist = dx * dx + dy * dy;

                    if (dist < shortestDist) {
                        shortestDist = dist;
                        bestVisited = visited[i];
                        bestUnvisitedIdx = j;
                    }
                }
            }

            // Extract that closest unvisited station
            const target = unvisited.splice(bestUnvisitedIdx, 1)[0];
            
            // Set a safe distance threshold (~3 miles) to prevent missing-data hops
            if (shortestDist < 0.003) {
                segments.push({
                    source: bestVisited,
                    target: target,
                    ridership: bestVisited.ridership, // Inherit color from the source station
                    name: `${bestVisited.name} ↔ ${target.name}`
                });
            }
            
            // Add the newly connected station tree, allowing future stations to branch off it
            visited.push(target);
        }
    }

    // Line generator
    const lineGen = d3.line()
        .x(d => projection([d.longitude, d.latitude])[0])
        .y(d => projection([d.longitude, d.latitude])[1]);

    // Draw segment paths directly
    segmentLayer.selectAll(".heat-segment")
        .data(segments)
        .join("path")
        .attr("class", "heat-segment")
        .attr("d", d => lineGen([d.source, d.target]))
        .attr("stroke", d => stationHeatScale(d.ridership[state.currentHour])) // Direct initial color
        .attr("stroke-width", 3)
        .attr("fill", "none")
        .attr("stroke-linecap", "round")
        .attr("opacity", 1) 
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke-width", 6).raise();
            const currentVolume = d.ridership[state.currentHour];
            
            tooltip.html(`
                <div style="font-size: 11px; text-transform: uppercase; color: #aaa;">Line Segment</div>
                <strong>${d.name}</strong><br>
                <div style="margin-top: 4px;">Volume: ${d3.format(",")(currentVolume)} riders</div>
            `);
            tooltip.transition().duration(200).style("opacity", 1);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", event.pageX + 15 + "px").style("top", event.pageY - 15 + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke-width", 3);
            tooltip.transition().duration(200).style("opacity", 0);
        });

    // Sync clock and UI
    updateMapByHour(state.currentHour, false);
}


svg.call(zoom);