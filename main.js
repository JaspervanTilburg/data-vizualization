var width		= 750,
    height		= 750,
    scale		= 8500,
    centerLat		= 5.5,	
    centerLong  	= 52.2;	 

// var histWidth = 500,
//     height = 500;

var svg = d3.select('#vis').select("svg").attr("width", width).attr("height", height);
var map = svg.append("g");
var projection = d3.geoMercator().scale(scale).translate([width / 2, height / 2]).center([centerLat, centerLong]);
var path = d3.geoPath().projection(projection);

var geoData;
var hmData;
var fileData;
var fileBins;

var hexbin = d3.hexbin().x(d => projection(d)[0]).y(d => projection(d)[1]).extent([[0, 0], [width, height]]).radius(10);

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

function drawFile(day) {
  var filtered = fileData.filter(function(d) {return d.DatumFileBegin === "10/" + day + "/2020";})
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
  var coordinates = concat_coordinates(filtered);
  var bins = hexbin(coordinates)
  var radius = d3.scaleSqrt([0, d3.max(bins, d => d.length)], [0, hexbin.radius() * Math.SQRT2])

  fileBins = map.selectAll('data')
    .data(bins)
    .join('path')
      .attr('d', d => hexbin.hexagon(radius(d.length)))
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .style("fill", "red")
      .style("stroke", "black")
      .attr("stroke-width", "0.1")

  // Traffic jam hist
  var trafficAvg = d3.nest()
    .key(function(d) { return d.DatumFileBegin; })
    .rollup(function(v) { return d3.mean(v, function(d) { return parse(d.FileZwaarte); }); })
    .entries(fileData);
  drawTest(trafficAvg);
}

function drawTest(data) {
  console.log(data)
  var histSvg = d3.select('#hist').append("svg").attr("width", width).attr("height", height);

  // append the svg object to the body of the page
  var margin = {top: 30, right: 30, bottom: 70, left: 60},
      histWidth = 500 - margin.left - margin.right,
      histHeight = 400 - margin.top - margin.bottom;

  // X axis
  var x = d3.scaleBand()
    .range([ 0, histWidth ])
    .domain(data.map(function(d) { return d.key; }))
    .padding(0.2);
  histSvg.append("g")
    .attr("transform", "translate(0," + histHeight + ")")
    .call(d3.axisBottom(x))
    .selectAll("text")
      .attr("transform", "translate(-10,0)rotate(-45)")
      .style("text-anchor", "end");

  // Add Y axis
  var y = d3.scaleLinear()
    .domain([0, 120])
    .range([ histHeight, 0]);
  histSvg.append("g")
    .call(d3.axisLeft(y));

  // Bars
  histSvg.append("g").selectAll("mybar")
    .data(data)
    .enter()
    .append("rect")
      .attr("x", function(d) { return x(d.key); })
      .attr("y", function(d) { return y(d.value); })
      .attr("width", x.bandwidth())
      .attr("height", function(d) { return histHeight - y(d.value); })
      .attr("fill", "#69b3a2")
}

function concat_coordinates(data) {
  var array = [];
  for (i = 0; i < data.length; i++) {
    var array = array.concat(JSON.parse(data[i].coordinates));
  }
  return array;
}

function parse(x) {
  return parseFloat(x.replace(",", "."));
}

function select_day() {
  fileBins.remove()
  var day = d3.select("#day").node().value;
  drawFile(day);
}

d3.json('nl_grenzen_topo.json').then(function(json) {
  geoData = json;
});

d3.json('hmpaal_data.json').then(function(json) {
  hmData = json;
  drawMap();
  drawFile(1);
});

d3.csv('files_2020_10_with_coordinates.csv').then(function(csv) {
  fileData = csv;
})
