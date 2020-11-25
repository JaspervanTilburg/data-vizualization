var width		= 600,
    height		= 600,
    scale		= 8500,
    centerLat		= 5.5,	
    centerLong  	= 52.2;	 

var projection = d3.geoMercator()
    .scale(scale).translate([width / 2, height / 2]).center([centerLat, centerLong]);
var path = d3.geoPath()
    .projection(projection);

// Join the FeatureCollection's features array to path elements
var svg = d3.select("svg")
  .attr("viewBox", [0, 0, width, height]);
var map = svg.append("g");

svg.call(d3.zoom()
  .extent([[0, 0], [width, height]])
  .scaleExtent([0.5, 8])
  .on("zoom", zoomed));


function drawMap(json) {
  var nl = topojson.feature(json, json.objects.gemeente_2020);
  var u = map.selectAll('path')
    .data(nl.features);
  
  // Create path elements and update the d attribute using the geo generator
  u.enter()
    .append('path')
    .attr('d', path);
}

function zoomed({transform}) {
  map.attr("transform", transform)
}

d3.json('nl_grenzen_topo.json').then(function(json) {
    drawMap(json);
  })
