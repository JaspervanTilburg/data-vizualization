
// Layout variables
var width		= 750,
    height		= 750,
    scale		= 8500,
    centerLat		= 5.5,	
    centerLong  	= 52.2;	 
var histMargin = {top: 30, right: 30, bottom: 70, left: 70},
    histWidth = 500 - histMargin.left - histMargin.right,
    histHeight = 250 - histMargin.top - histMargin.bottom;

// Map variables
var mapSvg = d3.select('#vis').select("svg")
var map = mapSvg.attr("width", width).attr("height", height).append("g");
mapSvg.call(d3.zoom()
    .extent([[0, 0], [width, height]])
    .scaleExtent([0.5, 8])
    .on("zoom", function({transform}){map.attr("transform", transform)}));

// Traffic histogram variables
var histTrafficSvg = d3.select('#histTraffic').select("svg")
var histTraffic = histTrafficSvg.attr("width", width).attr("height", height)
    .append("g").attr("transform", "translate(" + histMargin.left + "," + histMargin.top + ")");

var histWeatherSvg = d3.select('#histWeather').select("svg")
var histWeather = histWeatherSvg.attr("width", width).attr("height", height)
    .append("g").attr("transform", "translate(" + histMargin.left + "," + histMargin.top + ")");
var histTrafficYAxis;
var histTrafficYLabel;

var scatterSvg = d3.select('#scatter').select('svg')
var scatter = scatterSvg.attr('width', width).attr("height", height)
    .append("g").attr("transform", "translate(" + histMargin.left + "," + histMargin.top + ")");

var projection = d3.geoMercator().scale(scale).translate([width / 2, height / 2]).center([centerLat, centerLong]);
var path = d3.geoPath().projection(projection);



var geoData;
var hmData;
var fileData;
var fileBins;
var currentDate;
var trafficData;
var weatherData;

var	parseDate = d3.timeParse("%m/%e/%Y");
var parseCalender = d3.timeParse("%Y-%m-%d");

function drawMap() {
  // NL landmap
  var nl = topojson.feature(geoData, geoData.objects.gemeente_2020);
  map.selectAll('paadjes')
    .data(nl.features)
    .enter()
      .append('path')
      .attr('d', path);

  // HM pole map
  var filtered = hmData.features.filter(function(d) { return Number.isInteger(d.properties.Hectometerpole); });
  map.selectAll('dot')
    .data(filtered)
    .enter()
      .append('circle')
      .attr("class", "dot")
      .attr("r", 1)
      .attr("cx", function(d){return projection(d.geometry.coordinates)[0];})
      .attr("cy", function(d){return projection(d.geometry.coordinates)[1];})
      .style("opacity", 0.5);
}

function draw() {
  drawMapData();
  drawTrafficHist();
  drawWeatherHist();
  drawScatter();
}

function drawMapData() {
  var filtered = fileData.filter(function(d) {return parseDate(d.DatumFileBegin) - currentDate == 0;})
  // file = map.selectAll("data")
  //   .data(filtered)
  //   .enter().append('g')
  //     .selectAll('file')
  //     .data(function(d) {return JSON.parse(d.coordinates);})
  //     .enter().append('circle')
  //       .attr("r", 2)
  //       .attr("cx", function(e) {return projection(e)[0];})
  //       .attr("cy", function(e) {return projection(e)[1];})
  //       .style("fill", "red");

  //  Traffic jam bins
  var hexbin = d3.hexbin()
    .x(d => d.x)
    .y(d => d.y)
    .extent([[0, 0], [width, height]])
    .radius(d3.select("#binSize").node().value);

  var coordinates = concat_coordinates(filtered);
  var bins = hexbin(coordinates).map(d => (d.precipitationAmount = d3.mean(d, v => parse(v.precipitationAmount)), d))
  var radius = d3.scaleSqrt([0, d3.max(bins, d => d.length)], [0, hexbin.radius() * Math.SQRT2])
  var domain = [d3.max(fileData, d => parse(d.precipitationAmount)), 0]
  var color = d3.scaleSequential(domain, d3.interpolateRdYlBu);

  fileBins = map.selectAll('data')
    .data(bins)
    .join('path')
      .attr('d', d => hexbin.hexagon(radius(d.length)))
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .style("fill", d => color(d.precipitationAmount))
      .style("stroke", "black")
      .style("opacity", "0.8")
      .attr("stroke-width", "0.1")

  drawLegend(domain, color)
}

function drawLegend(domain, color) {
  var min = domain[1]
  var max = domain[0]
  // var domain = [min, max]

  // Band scale for x-axis
  const xScale = d3
    .scaleBand()
    .domain([0, 1])
    .range([50, 100]);
  
  // Linear scale for y-axis
  const yScale = d3
    .scaleLinear()
    .domain(domain)
    .range([25, 225]);

   // An array interpolated over our domain where height is the height of the bar
   const expandedDomain = d3.range(min, max, (max - min) / 100);

   // Defining the legend bar
   const svgBar = fc
    .autoBandwidth(fc.seriesSvgBar())
    .xScale(xScale)
    .yScale(yScale)
    .crossValue(0)
    .baseValue((_, i) => (i > 0 ? expandedDomain[i - 1] : 0))
    .mainValue(d => d)
    .decorate(selection => {
      selection.selectAll("path")
        .style("fill", d => color(d))
        .style("opacity", "1")
        .style("stroke", "none");
    });

    // Drawing the legend bar
    var legendSvg = mapSvg.append("svg");
    legendSvg
      .append("g")
      .datum(expandedDomain)
      .call(svgBar);

    // Defining our label
    const axisLabel = fc
      .axisRight(yScale)
      .tickValues([...domain, (domain[1] + domain[0]) / 2])
      .tickValues(d3.range(min, max, 50));

    // Drawing and translating the label
    legendSvg.append("g")
      .attr("transform", `translate(70)`)
      .datum(expandedDomain)
      .call(axisLabel);
}

function drawTrafficHist() {
  var data = d3.nest()
    .key(function(d) { return d.DatumFileBegin; })
    .rollup(v => selectTrafficData(v))
    .entries(fileData)
    .sort((a, b) => parseDate(a.key) - parseDate(b.key));

  // Scales
  var x = d3.scaleBand()
    .range([ 0, histWidth])
    .domain(data.map(function(d) { return d.key; }))
    .padding(0.2);
  var y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)])
    .range([ histHeight, 0]);

  // X axis
  histTraffic.append("g")
    .attr("transform", "translate(0," + histHeight + ")")
    .call(d3.axisBottom(x))
    .selectAll("text")
      .attr("transform", "translate(-10,0)rotate(-45)")
      .style("text-anchor", "end");

  // Add Y axis
  histTrafficYAxis = histTraffic.append("g")
  histTrafficYAxis.call(d3.axisLeft(y));

  // Bars
  histTraffic.selectAll("mybar")
    .data(data)
    .enter()
      .append("rect")
        .attr("x", function(d) { return x(d.key); })
        .attr("y", function(d) { return y(d.value); })
        .attr("width", x.bandwidth())
        .attr("height", function(d) { return histHeight - y(d.value); })
        .attr("fill", d => {if (parseDate(d.key) - currentDate == 0) {return "blue"} else {return "deepskyblue"}})

  // Y label
  histTrafficYLabel = histTraffic.append("text")
    .attr("transform", "rotate(-90) translate(0" + (histHeight) + ")")
    .attr("y", 0 - histMargin.left + 10)
    .attr("x", 0 - (histHeight + 100))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .text(selectDataDescription());      
}

function updateHist() {
  var data = d3.nest()
    .key(function(d) { return d.DatumFileBegin; })
    .rollup(v => selectTrafficData(v))
    .entries(fileData)
    .sort((a, b) => parseDate(a.key) - parseDate(b.key));

  // Scales
  var y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)])
    .range([ histHeight, 0]);
  
  // Y Axis
  histTrafficYAxis
    .transition()
    .duration(1000)
    .call(d3.axisLeft(y));

  //Update all rects
  histTraffic.selectAll("rect")
    .data(data)
    .transition()
    .duration(1000)
      .attr("y", function(d) { return y(d.value); })
      .attr("height", function(d) { return histHeight - y(d.value); })
      .attr("fill", d => {if (parseDate(d.key) - currentDate == 0) {return "blue"} else {return "deepskyblue"}});

  // Update Y label
  histTrafficYLabel.text(selectDataDescription())
}

function drawWeatherHist() {
  var data = d3.nest()
    .key(function(d) { return d.DatumFileBegin; })
    .rollup(function(v) { return d3.mean(v, d => parse(d.precipitationAmount)); })
    .entries(fileData)
    .sort((a, b) => parseDate(a.key) - parseDate(b.key));

  // Scales
  var x = d3.scaleBand()
    .range([ 0, histWidth])
    .domain(data.map(function(d) { return d.key; }))
    .padding(0.2);
  var y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)])
    .range([ histHeight, 0]);

  // X axis
  histWeather.append("g")
    .attr("transform", "translate(0," + histHeight + ")")
    .call(d3.axisBottom(x))
    .selectAll("text")
      .attr("transform", "translate(-10,0)rotate(-45)")
      .style("text-anchor", "end");

  // Add Y axis
  histWeather.append("g")
    .call(d3.axisLeft(y));

  // Bars
  histWeather.append("g").selectAll("mybar")
    .data(data)
    .enter()
    .append("rect")
      .attr("x", function(d) { return x(d.key); })
      .attr("y", function(d) { return y(d.value); })
      .attr("width", x.bandwidth())
      .attr("height", function(d) { return histHeight - y(d.value); })
      .attr("fill", d => {if (parseDate(d.key) - currentDate == 0) {return "blue"} else {return "deepskyblue"}})

  // Y label
  histWeather.append("text")
    .attr("transform", "rotate(-90) translate(0" + (histHeight) + ")")
    .attr("y", 0 - histMargin.left + 10)
    .attr("x", 0 - (histHeight + 100))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Average amount of precipation (ml)");      
}

function drawScatter() {
  var data = d3.nest()
    .key(function(d) { return d.DatumFileBegin; })
    .rollup(function(v) { 
      return {
        length: d3.sum(v, d => parse(d.GemLengte)),
        precipitation: d3.mean(v, d => parse(d.precipitationAmount))
      };})
    .entries(fileData)
    .sort((a, b) => parseDate(a.key) - parseDate(b.key));

  var x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value.length)])
    .range([0, histWidth]);
  scatter.append("g")
    .attr("transform", "translate(0," + histHeight + ")")
    .call(d3.axisBottom(x));

  // Add Y axis
  var y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value.precipitation)])
    .range([histHeight, 0]);
  scatter.append("g")
    .call(d3.axisLeft(y));

  // Add dots
  scatter.append('g')
    .selectAll("dot")
    .data(data)
    .enter()
    .append("circle")
      .attr("cx", d => x(d.value.length))
      .attr("cy", d => y(d.value.precipitation))
      .attr("r", 2)
      .style("fill", d => {if (parseDate(d.key) - currentDate == 0) {return "blue"} else {return "deepskyblue"}})

  // Add Y label
  scatter.append("text")
    .attr("transform", "rotate(-90) translate(0" + (histHeight) + ")")
    .attr("y", 0 - histMargin.left + 10)
    .attr("x", 0 - (histHeight + 100))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Precipation amount (ml)");  
    
  // Add X label
  scatter.append("text")
    .attr("y", histHeight + histMargin.bottom / 2)
    .attr("x", histMargin.left)
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Traffic length (km)");  
}

function concat_coordinates(data) {
  var array = [];
  for (var i = 0; i < data.length; i++) {
    var res = JSON.parse(data[i].coordinates)
    var newres = res.map(d => {return {"x": projection(d)[0], "y": projection(d)[1], "precipitationAmount": data[i].precipitationAmount};})
    array = array.concat(newres);
  }
  return array;
}

function parse(x) {
  return parseFloat(x.replace(",", "."));
}

function updateUI() {
  fileBins.remove()
  currentDate = parseCalender(d3.select("#date").node().value);
  var weatherSelection = document.getElementById("weatherSelection");
  var trafficSelection = document.getElementById('trafficSelection');
  weatherData = weatherSelection.options[weatherSelection.selectedIndex].value;
  trafficData = trafficSelection.options[trafficSelection.selectedIndex].value;
  drawMapData();
  updateHist();
}

function selectTrafficData(v) {
  if (trafficData === 'length') {
    return d3.mean(v, d => trafficLength(d));
  } else if (trafficData === 'duration') {
    return d3.mean(v, d => duration(d));
  } else if (trafficData === 'severeness') {
    return d3.mean(v, d => severeness(d));
  }
}

function selectDataDescription() {
  if (trafficData === 'length') {
    return "Total length (km)";
  } else if (trafficData === 'duration') {
    return 'Average duration (m)'
  } else if (trafficData === 'severeness') {
    return'Average severeness (length * duration)'
  }
}

function trafficLength(d) {
  return Math.abs(parse(d.HectometerKop) - parse(d.HectometerStaart));
}

function duration(d) {
  return parse(d.FileDuur);
}

function severeness(d) {
  return parse(d.FileZwaarte);
}

d3.json('nl_grenzen_topo.json').then(function(json) {
  geoData = json;
});

d3.json('hmpaal_data.json').then(function(json) {
  hmData = json;
  currentDate = parseCalender(d3.select("#date").node().value)
  var weatherSelection = document.getElementById("weatherSelection");
  var trafficSelection = document.getElementById('trafficSelection');
  weatherData = weatherSelection.options[weatherSelection.selectedIndex].value;
  trafficData = trafficSelection.options[trafficSelection.selectedIndex].value;
  drawMap();
  draw();
});

d3.csv('files_10_2020_with_precipitationAmount.csv').then(function(csv) {
  fileData = csv;
})
