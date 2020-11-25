var width		= 750,
    height		= 750,
    scale		= 8500,
    centerLat		= 5.5,	
    centerLong  	= 52.2;	 

var projection = d3.geoMercator()
    .scale(scale).translate([width / 2, height / 2]).center([centerLat, centerLong]);
var path = d3.geoPath()
    .projection(projection);

// Join the FeatureCollection's features array to path elements
var svg = d3.select('svg')
  .attr("width", width)
  .attr("height", height);

function drawMap(json) {
  var nl = topojson.feature(json, json.objects.gemeente_2020);
  var u = svg.selectAll('path')
    .data(nl.features);
  
  // Create path elements and update the d attribute using the geo generator
  u.enter()
    .append('path')
    .attr('d', path);
}

d3.json('nl_grenzen_topo.json').then(function(json) {
    drawMap(json);
  })
