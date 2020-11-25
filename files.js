var viewWidth = window.innerWidth;
var viewHeight = window.innerHeight-50;
var margin = {top: 20, right: 20, bottom: 30, left: 40};
var width = viewWidth - margin.left - margin.right;
var height = viewHeight - margin.top - margin.bottom;


var geodata;
var data;

var svg = d3.select("svg")
  .attr("width", width)
  .attr("height", height);
    
var map = svg.append("g")
  .attr("width", width)
  .attr("height", height)
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var projection = d3.geoEquirectangular();
  var path = d3.geoPath().projection(projection);


function drawMap() {
  console.log("test");

  map.append("path")
      .datum(topojson.feature(uk, uk.objects.subunits))
      .attr("d", d3.geo.path().projection(d3.geo.mercator()));

  // Join the FeatureCollection's features array to path elements
  var u = map.selectAll('path')
    .data(geodata.features);

  // Create path elements and update the d attribute using the geo generator
  u.enter()
    .append('path')
    .attr('d', path);
}

// we read the data
d3.json('./nederlandgeo.json')
  .then(function(d) {
    geodata = d;
    drawMap();
  })

// d3.json('./data.json')
//   .then(function(d) {
//     data = d.slice(0, 100);
//     drawData();
//   })
