var width		= 750,
    height		= 750,
    scale		= 8500,
    centerLat		= 5.5,	
    centerLong  	= 52.2;	 

var projection = d3.geoMercator()
    .scale(scale).translate([width / 2, height / 2]).center([centerLat, centerLong]);
var path = d3.geoPath()
    .projection(projection);

var svg = d3.select('svg')
  .attr("width", width)
  .attr("height", height);
var map = svg.append("g");

function drawMap(json) {
  var nl = topojson.feature(json, json.objects.gemeente_2020);
  map.selectAll('path')
    .data(nl.features)
    .enter()
      .append('path')
      .attr('d', path);
}

function drawHMpaal(json) {
  // map.selectAll('path')
  //   .data(json.features)
  //   .enter()
  //     .append('path')
  //     .attr('d', path)
  //     .attr('fill', 'red');

  map.selectAll('dot')
    .data(json.features)
    .enter()
      .append('circle')
      .attr("class", "dot")
      .attr("r", 1)
      .attr("cx", function(d){return projection(d.geometry.coordinates)[0];})
      .attr("cy", function(d){return projection(d.geometry.coordinates)[1];});
}

d3.json('nl_grenzen_topo.json').then(function(json) {
  drawMap(json);
});

d3.json('hmpaal_data.json').then(function(json) {
  drawHMpaal(json)
});
