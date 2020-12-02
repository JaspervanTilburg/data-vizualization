var width		= 750,
    height		= 750,
    scale		= 8500,
    centerLat		= 5.5,	
    centerLong  	= 52.2;	 

var geoData;
var hmData;
var fileData;

var projection = d3.geoMercator()
    .scale(scale).translate([width / 2, height / 2]).center([centerLat, centerLong]);
var path = d3.geoPath()
    .projection(projection);

var svg = d3.select('svg')
  .attr("width", width)
  .attr("height", height);
var map = svg.append("g");

var file;

function drawMap() {
  var nl = topojson.feature(geoData, geoData.objects.gemeente_2020);
  map.selectAll('paadjes')
    .data(nl.features)
    .enter()
      .append('path')
      .attr('d', path);
}

function drawHMpaal() {
  var filtered = hmData.features.filter(function(d) { return Number.isInteger(d.properties.Hectometerpole); });
  
  // map.selectAll('path')
  //   .data(filtered)
  //   .enter()
  //     .append('path')
  //     .attr('d', path)
  //     .style("stroke", "red");
  
  map.selectAll('dot')
    .data(filtered)
    .enter()
      .append('circle')
      .attr("class", "dot")
      .attr("r", 2)
      .attr("cx", function(d){return projection(d.geometry.coordinates)[0];})
      .attr("cy", function(d){return projection(d.geometry.coordinates)[1];});
}

function drawFile(day) {
  var filtered = fileData.filter(function(d) {return d.DatumFileBegin === "10/" + day + "/2020";})
  file = map.selectAll("data")
    .data(filtered)
    .enter().append('g')
      .selectAll('file')
      .data(function(d) {return JSON.parse(d.coordinates);})
      .enter().append('circle')
        .attr("r", 2)
        .attr("cx", function(e) {return projection(e)[0];})
        .attr("cy", function(e) {return projection(e)[1];})
        // .style("fill", "red");
  }

function isFile(d, fileData) {
  for (i = 0; i < fileData.length; i++) {
    var file = fileData[i];
    var fileStart = Math.min(parseFloat(file.HectometerKop.replace(",", ".")), parseFloat(file.HectometerStaart.replace(",", ".")));
    var fileEnd = Math.max(parseFloat(file.HectometerKop.replace(",", ".")), parseFloat(file.HectometerStaart.replace(",", ".")));
    if (d.properties.Highway == file.RouteOms && fileStart <= d.properties.Hectometerpole && d.properties.Hectometerpole <= fileEnd) {
      return true;
    }
  }
  return false;
}

function select_day() {
  file.remove();
  var day = d3.select("#day").node().value;
  drawFile(day);
}

d3.json('nl_grenzen_topo.json').then(function(json) {
  geoData = json;
  drawMap();
});

d3.json('hmpaal_data.json').then(function(json) {
  hmData = json;
  drawHMpaal()
  drawFile(1)
});

d3.csv('files_2020_10_with_coordinates.csv').then(function(csv) {
  fileData = csv;
})
