// Layout variables
var width		= 700,
    height		= 770,
    scale		= 8500,
    centerLat		= 5.5,	
    centerLong  	= 52.2;	 
var histMargin = {top: 30, right: 30, bottom: 70, left: 70},
    histWidth = 500 - histMargin.left - histMargin.right,
    histHeight = 250 - histMargin.top - histMargin.bottom;

// Map variables
var legendSvg;
var mapSvg = d3.select('#vis').select('svg')
var map = mapSvg.attr('width', width).attr('height', height).append('g');
var dayText = mapSvg.append("g").append('text');
mapSvg.call(d3.zoom()
    .extent([[0, 0], [width, height]])
    .scaleExtent([0.5, 8])
    .on('zoom', function({transform}){map.attr('transform', transform)}));

// Histogram variables
var histTrafficYAxis;
var histTrafficXAxis;
var histTrafficYLabel;
var histTrafficSvg = d3.select('#histTraffic').select('svg')
var histTraffic = histTrafficSvg.attr('width', width).attr('height', height)
    .append('g').attr('transform', 'translate(' + histMargin.left + ',' + histMargin.top + ')');

var histWeatherYAxis;
var histWeatherXAxis;
var histWeatherYLabel;
var histWeatherSvg = d3.select('#histWeather').select('svg')
var histWeather = histWeatherSvg.attr('width', width).attr('height', height)
    .append('g').attr('transform', 'translate(' + histMargin.left + ',' + histMargin.top + ')');

var scatterYAxis;
var scatterXAxis;
var scatterXLabel;
var scatterYLabel;
var scatterSvg = d3.select('#scatter').select('svg')
var scatter = scatterSvg.attr('width', width).attr('height', height)
    .append('g').attr('transform', 'translate(' + histMargin.left + ',' + histMargin.top + ')');

var projection = d3.geoMercator().scale(scale).translate([width / 2, height / 2]).center([centerLat, centerLong]);
var path = d3.geoPath().projection(projection);

var geoData;
var hmData;
var fileData;
var fileBins;
var currentDate;
var trafficData;
var weatherData;

// var	parseDate = d3.timeParse('%m/%e/%Y');
var parseDate = d3.timeParse('%Y-%m-%d');

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
      .attr('class', 'dot')
      .attr('r', 1)
      .attr('cx', function(d){return projection(d.geometry.coordinates)[0];})
      .attr('cy', function(d){return projection(d.geometry.coordinates)[1];})
      .style('opacity', 0.5);

  // Bin size explanation
  mapSvg.append("g")
    .append('text')
      .attr('x', 370)
      .attr('y', 760)
      .style('font-size', '12px')
      .text('Bin area corresponds to the total length of traffic jams in that area.')
}

function draw() {
  drawMapData();
  drawTrafficHist();
  drawWeatherHist();
  drawScatter();
}

function drawMapData() {
  var filtered = fileData.filter(function(d) {return parseDate(d.DatumFileBegin) - currentDate == 0;})

  //  Traffic jam bins
  var hexbin = d3.hexbin()
    .x(d => d.x)
    .y(d => d.y)
    .extent([[0, 0], [width, height]])
    .radius(d3.select('#binSize').node().value);

  var coordinates = concat_coordinates(filtered);
  var bins = hexbin(coordinates).map(d => (
    d.precipitation = d3.mean(d, v => v.precipitation), 
    d.temperature = d3.mean(d, v => v.temperature),
    d.visibility = d3.mean(d, v => v.visibility),
    d))

  if (weatherData === 'precipitation') {
    var domain = [d3.max(fileData, d => parse(d.precipitationAmount) * 0.1), 0]
  } else if (weatherData === 'temperature') {
    var domain = [d3.max(fileData, d => parse(d.meanTemp)), d3.min(fileData, d => parse(d.meanTemp))]
  } else if (weatherData === 'visibility') {
    var domain = [d3.max(fileData, d => parse(d.minVisibility)), 0]
  }

  var radius = d3.scaleSqrt([0, d3.max(bins, d => d.length)], [0, hexbin.radius() * Math.SQRT2])
  var color = d3.scaleSequential(domain, d3.interpolateRdYlBu);

  // Tooltip
  var tooltip = d3.select("#histWeather")
  .append("div")
    .attr('class', 'tooltip')
    .style('display', 'none')
    .style("position", "absolute");

  fileBins = map.selectAll('data')
    .data(bins)
    .join('path')
      .attr('d', d => hexbin.hexagon(radius(d.length)))
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('fill', d => {
        if (weatherData === 'precipitation') {
          if (d.precipitation === 0) {
            return 'rgb(64, 64, 64)'
          }
          return color(d.precipitation);
        } else if (weatherData === 'temperature') {
          return color(d.temperature);
        } else if (weatherData === 'visibility') {
          return color(d.visibility);
        } 
      })
      .style('stroke', 'black')
      .style('opacity', '0.8')
      .attr('stroke-width', '0.1')
      .on('mousemove', function(event, d) {
        tooltip.html(selectWeatherDataTooltip(d) + '</br>' + (d.length * 0.1).toFixed(1) + ' km')
          .style("left", (event.pageX - 60) + "px")
          .style("top", (event.pageY - 35) + "px");
      })
      .on("mouseover", function() {
        tooltip.style("display", "inline");
      })	
      .on("mouseout", function() {		
        tooltip.style("display", "none");	
      });

  // Day of the week
  dayText.attr('x', 635)
    .attr('y', 20)
    .style('font-size', '12px')
    .text(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][currentDate.getDay()])

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
      selection.selectAll('path')
        .style('fill', d => color(d))
        .style('opacity', '1')
        .style('stroke', 'none');
    });

    // Drawing the legend bar
    legendSvg = mapSvg.append('svg');
    legendSvg
      .append('g')
      .datum(expandedDomain)
      .call(svgBar);

    // Defining our label
    const axisLabel = fc
      .axisRight(yScale)
      .tickValues([...domain, (domain[1] + domain[0]) / 2])
      .tickValues(d3.range(min, max, Math.round((max - min) / 10)));

    // Drawing and translating the label
    legendSvg.append('g')
      .attr('transform', `translate(70)`)
      .datum(expandedDomain)
      .call(axisLabel);

    // Title
    legendSvg.append('text')
      .attr('x', 20)
      .attr('y', 15)
      .style('font-size', '12px')
      .text(function() {
        if (weatherData === 'precipitation') {
          return 'Precipiation amount (ml)'
        } else if (weatherData === 'temperature') {
          return 'Temperature (celsius)'
        } else if (weatherData === 'visibility') {
          return 'Visibility (m)'
        }
      })

    // No rain legend
    if (weatherData === 'precipitation') {
      legendSvg.append('rect')
        .attr('x', 37.5)
        .attr('y', 235)
        .attr('width', 25)
        .attr('height', 20)
        .style('fill', 'rgb(64, 64, 64)')
      legendSvg.append('text')
        .attr('x', 75)
        .attr('y', 250)
        .style('font-size', '12px')
        .text('No rain')
    }
}

function drawTrafficHist() {
  var filtered = fileData.filter(d => parseDate(d.DatumFileBegin).getMonth() === currentDate.getMonth())
  var data = d3.nest()
    .key(function(d) { return d.DatumFileBegin; })
    .rollup(v => selectTrafficData(v))
    .entries(filtered)
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
  histTrafficXAxis = histTraffic.append('g')
  histTrafficXAxis.call(d3.axisBottom(x).tickFormat(function(d) {
    return padLeadingZeros(parseDate(d).getMonth() + 1, 2) + '-' + 
    padLeadingZeros(parseDate(d).getDate(), 2)
  }))
    .attr('transform', 'translate(0,' + histHeight + ')')  
    .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');

  // Add Y axis
  histTrafficYAxis = histTraffic.append('g')
  histTrafficYAxis.call(d3.axisLeft(y).tickFormat(x => d3.format(",d")(x)));

  // Tooltip
  var tooltip = d3.select("#histTraffic")
    .append("div")
      .attr('class', 'tooltip')
      .style('display', 'none')
      .style("position", "absolute");

  // Bars
  histTraffic.selectAll('mybar')
    .data(data)
    .enter()
      .append('rect')
        .attr('x', function(d) { return x(d.key); })
        .attr('y', function(d) { return y(d.value); })
        .attr('width', x.bandwidth())
        .attr('height', function(d) { return histHeight - y(d.value); })
        .attr('fill', d => {if (parseDate(d.key) - currentDate == 0) {return 'blue'} else {return 'deepskyblue'}})
        .on('mousemove', function(event, d) {
          tooltip.html(d.key + '</br>' + d.value.toFixed(1) + selectTrafficDataUnit())
            .style("left", (event.pageX - 60) + "px")
            .style("top", (event.pageY - 35) + "px");
        })
        .on("mouseover", function() {
          tooltip.style("display", "inline");
        })	
        .on("mouseout", function() {		
          tooltip.style("display", "none");	
        })
        .on('click', function(event, d) {
          currentDate = parseDate(d.key);
          d3.select('#date').node().value = d.key
          update();
        });

  // Y label
  histTrafficYLabel = histTraffic.append('text')
    .attr('transform', 'rotate(-90) translate(0' + (histHeight) + ')')
    .attr('y', 0 - histMargin.left + 10)
    .attr('x', 0 - (histHeight + 100))
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .text(selectTrafficDataDescription());      
}

function updateTrafficHist() {
  var filtered = fileData.filter(d => parseDate(d.DatumFileBegin).getMonth() === currentDate.getMonth())
  var data = d3.nest()
    .key(function(d) { return d.DatumFileBegin; })
    .rollup(v => selectTrafficData(v))
    .entries(filtered)
    .sort((a, b) => parseDate(a.key) - parseDate(b.key));

  // Scales
  var x = d3.scaleBand()
    .range([0, histWidth])
    .domain(data.map(function(d) { return d.key; }))
    .padding(0.2);
  var y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)])
    .range([ histHeight, 0]);
  
  // Y Axis
  histTrafficYAxis.transition()
    .duration(500)
    .call(d3.axisLeft(y).tickFormat(x => d3.format(",d")(x)));

  // X Axis
  histTrafficXAxis.transition()
    .duration(500)
    .call(d3.axisBottom(x).tickFormat(function(d) {
      return padLeadingZeros(parseDate(d).getMonth() + 1, 2) + '-' + 
      padLeadingZeros(parseDate(d).getDate(), 2)
    }))
    .attr('transform', 'translate(0,' + histHeight + ')')
    .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');

  var newHistTraffic = histTraffic.selectAll('rect').data(data);
  // Enter and exit
  newHistTraffic.enter().append('rect')
    .transition()
    .duration(500)
      .attr('x', function(d) { return x(d.key); })
      .attr('y', function(d) { return y(d.value); })
      .attr('width', x.bandwidth())
      .attr('height', function(d) { return histHeight - y(d.value); })
      .attr('fill', d => {if (parseDate(d.key) - currentDate == 0) {return 'blue'} else {return 'deepskyblue'}})
  newHistTraffic.exit().remove()

  //Update all rects
  newHistTraffic.transition()
    .duration(500)
      .attr('x', function(d) { return x(d.key); })
      .attr('y', function(d) { return y(d.value); })
      .attr('height', function(d) { return histHeight - y(d.value); })
      .attr('fill', d => {if (parseDate(d.key) - currentDate == 0) {return 'blue'} else {return 'deepskyblue'}});

  // Update Y label
  histTrafficYLabel.text(selectTrafficDataDescription())
}

function drawWeatherHist() {
  var filtered = fileData.filter(d => parseDate(d.DatumFileBegin).getMonth() === currentDate.getMonth())
  var data = d3.nest()
    .key(function(d) { return d.DatumFileBegin; })
    .rollup(v => selectWeatherData(v))
    .entries(filtered)
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
  histWeatherXAxis = histWeather.append('g')
  histWeatherXAxis.call(d3.axisBottom(x).tickFormat(function(d) {
      return padLeadingZeros(parseDate(d).getMonth() + 1, 2) + '-' + 
      padLeadingZeros(parseDate(d).getDate(), 2)
    }))
    .attr('transform', 'translate(0,' + histHeight + ')')
    .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');

  // Add Y axis
  histWeatherYAxis = histWeather.append('g')
  histWeatherYAxis.call(d3.axisLeft(y).tickFormat(x => d3.format(",d")(x)));

  // Tooltip
  var tooltip = d3.select("#histWeather")
  .append("div")
    .attr('class', 'tooltip')
    .style('display', 'none')
    .style("position", "absolute");

  // Bars
  histWeather.append('g').selectAll('mybar')
    .data(data)
    .enter()
    .append('rect')
      .attr('x', function(d) { return x(d.key); })
      .attr('y', function(d) { return y(d.value); })
      .attr('width', x.bandwidth())
      .attr('height', function(d) { return histHeight - y(d.value); })
      .attr('fill', d => {if (parseDate(d.key) - currentDate == 0) {return 'blue'} else {return 'deepskyblue'}})
      .on('mousemove', function(event, d) {
        tooltip.html(d.key + '</br>' + d.value.toFixed(1) + selectWeatherDataUnit())
          .style("left", (event.pageX - 60) + "px")
          .style("top", (event.pageY - 35) + "px");
      })
      .on("mouseover", function() {
        tooltip.style("display", "inline");
      })	
      .on("mouseout", function() {		
        tooltip.style("display", "none");	
      }).on('click', function(event, d) {
        currentDate = parseDate(d.key);
        d3.select('#date').node().value = d.key
        update();
      });

  // Y label
  histWeatherYLabel = histWeather.append('text')
    .attr('transform', 'rotate(-90) translate(0' + (histHeight) + ')')
    .attr('y', 0 - histMargin.left + 10)
    .attr('x', 0 - (histHeight + 100))
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .text(selectWeatherDataDescription());      
}

function updateWeatherHist() {
  var filtered = fileData.filter(d => parseDate(d.DatumFileBegin).getMonth() === currentDate.getMonth())
  var data = d3.nest()
    .key(function(d) { return d.DatumFileBegin; })
    .rollup(v => selectWeatherData(v))
    .entries(filtered)
    .sort((a, b) => parseDate(a.key) - parseDate(b.key));

  // Scales
  var x = d3.scaleBand()
    .range([ 0, histWidth])
    .domain(data.map(function(d) { return d.key; }))
    .padding(0.2);
  var y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)])
    .range([ histHeight, 0]);
  
  // Y Axis
  histWeatherYAxis.transition()
    .duration(500)
    .call(d3.axisLeft(y).tickFormat(x => d3.format(",d")(x)));

  // X Axis
  histWeatherXAxis.transition()
    .duration(500)
    .call(d3.axisBottom(x).tickFormat(function(d) {
      return padLeadingZeros(parseDate(d).getMonth() + 1, 2) + '-' + 
      padLeadingZeros(parseDate(d).getDate(), 2)
    }))
    .attr('transform', 'translate(0,' + histHeight + ')')
    .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');

  var newHistWeather = histWeather.selectAll('rect').data(data)
  // Enter and exit
  newHistWeather.enter().append('rect')
    .transition()
    .duration(500)
      .attr('x', function(d) { return x(d.key); })
      .attr('y', function(d) { return y(d.value); })
      .attr('width', x.bandwidth())
      .attr('height', function(d) { return histHeight - y(d.value); })
      .attr('fill', d => {if (parseDate(d.key) - currentDate == 0) {return 'blue'} else {return 'deepskyblue'}})
  newHistWeather.exit().remove()

  //Update all rects
  newHistWeather.transition()
    .duration(500)
      .attr('x', function(d) { return x(d.key); })
      .attr('y', function(d) { return y(d.value); })
      .attr('height', function(d) { return histHeight - y(d.value); })
      .attr('fill', d => {if (parseDate(d.key) - currentDate == 0) {return 'blue'} else {return 'deepskyblue'}});

  // Update Y label
  histWeatherYLabel.text(selectWeatherDataDescription())
}

function drawScatter() {
  var data = d3.nest()
    .key(function(d) { return d.DatumFileBegin; })
    .rollup(function(v) { 
      return {
        trafficValue: selectTrafficData(v),
        weatherValue: selectWeatherData(v)
      };})
    .entries(fileData)
    .sort((a, b) => parseDate(a.key) - parseDate(b.key));

  // Add X axis
  var x = d3.scaleLinear()
    .domain([0, Math.round(d3.max(data, d => d.value.trafficValue))])
    .range([0, histWidth]);
  scatterXAxis = scatter.append('g');
  scatterXAxis.attr('transform', 'translate(0,' + histHeight + ')')
    .call(d3.axisBottom(x).tickFormat(x => d3.format(",d")(x)))
    .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');

  // Add Y axis
  var y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value.weatherValue)])
    .range([histHeight, 0]);
  scatterYAxis = scatter.append('g');
  scatterYAxis.call(d3.axisLeft(y).tickFormat(x => d3.format(",d")(x)));

  // Tooltip
  var tooltip = d3.select("#scatter")
  .append("div")
    .attr('id', 'scatter-tooltip')
    .style('display', 'none')
    .style("position", "absolute");

  // Add dots
  scatter.append('g')
    .selectAll('dot')
    .data(data)
    .enter()
    .append('circle')
      .attr('cx', d => x(d.value.trafficValue))
      .attr('cy', d => y(d.value.weatherValue))
      .attr('r', 2)
      .style('fill', d => {if (parseDate(d.key) - currentDate == 0) {return 'blue'} else {return 'deepskyblue'}})
      .on('mousemove', function(event, d) {
        tooltip.html(d.key + 
            '</br>' + d.value.trafficValue.toFixed(1) + selectTrafficDataUnit() + 
            '</br>' + d.value.weatherValue.toFixed(1) + selectWeatherDataUnit())
          .style("left", (event.pageX - 60) + "px")
          .style("top", (event.pageY - 35) + "px");
      })
      .on("mouseover", function() {
        tooltip.style("display", "inline");
      })	
      .on("mouseout", function() {		
        tooltip.style("display", "none");	
      }).on('click', function(event, d) {
        currentDate = parseDate(d.key);
        d3.select('#date').node().value = d.key
        update();
      });

  // Add Y label
  scatterYLabel = scatter.append('text')
    .attr('transform', 'rotate(-90) translate(0' + (histHeight) + ')')
    .attr('y', 0 - histMargin.left + 10)
    .attr('x', 0 - (histHeight + 100))
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Precipation amount (ml)');  
    
  // Add X label
  scatterXLabel = scatter.append('text')
    .attr('y', histHeight + histMargin.bottom / 2)
    .attr('x', histMargin.left)
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Traffic length (km)');  
}

function updateScatter() {
  var data = d3.nest()
    .key(function(d) { return d.DatumFileBegin; })
    .rollup(function(v) { 
      return {
        trafficValue: selectTrafficData(v),
        weatherValue: selectWeatherData(v)
      };})
    .entries(fileData)
    .sort((a, b) => parseDate(a.key) - parseDate(b.key));

  // Add scales
  var x = d3.scaleLinear()
    .domain([0, Math.round(d3.max(data, d => d.value.trafficValue))])
    .range([0, histWidth]);
  var y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value.weatherValue)])
    .range([histHeight, 0]);

  // Add X and Y Axis
  scatterXAxis.transition()
    .duration(500)
    .attr('transform', 'translate(0,' + histHeight + ')')
    .call(d3.axisBottom(x).tickFormat(x => d3.format(",d")(x)))
    .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');
  scatterYAxis.transition()
    .duration(500)
    .call(d3.axisLeft(y).tickFormat(x => d3.format(",d")(x)));

  // Update points
  var newScatter = scatter.selectAll('circle').data(data)
  newScatter.transition()
      .duration(500)
      .attr('cx', d => x(d.value.trafficValue))
      .attr('cy', d => y(d.value.weatherValue))
      .attr('r', 2)
      .style('fill', d => {if (parseDate(d.key) - currentDate == 0) {return 'blue'} else {return 'deepskyblue'}})

  // Add Labels
  scatterXLabel.text(selectTrafficDataDescription())
  scatterYLabel.text(selectWeatherDataDescription())
}

function concat_coordinates(data) {
  var array = [];
  for (var i = 0; i < data.length; i++) {
    var res = JSON.parse(data[i].coordinates)
    var newres = res.map(d => {
      return {
        'x': projection(d)[0], 
        'y': projection(d)[1], 
        'precipitation': parse(data[i].precipitationAmount) * 0.1,
        'temperature': parse(data[i].meanTemp),
        'visibility': parse(data[i].minVisibility)
      };})
    array = array.concat(newres);
  }
  return array;
}

function parse(x) {
  return parseFloat(x.replace(',', '.'));
}

function padLeadingZeros(num, size) {
  var s = num+"";
  while (s.length < size) s = "0" + s;
  return s;
}

function updateUI() {
  currentDate = parseDate(d3.select('#date').node().value);
  var weatherSelection = document.getElementById('weatherSelection');
  var trafficSelection = document.getElementById('trafficSelection');
  weatherData = weatherSelection.options[weatherSelection.selectedIndex].value;
  trafficData = trafficSelection.options[trafficSelection.selectedIndex].value;
  update();
}

function update() {
  fileBins.remove()
  legendSvg.remove()
  drawMapData();
  updateTrafficHist();
  updateWeatherHist();
  updateScatter();
}

function selectTrafficData(v) {
  if (trafficData === 'length') {
    return d3.sum(v, d => Math.abs(parse(d.HectometerKop) - parse(d.HectometerStaart)));
  } else if (trafficData === 'duration') {
    return d3.sum(v, d => parse(d.FileDuur));
  } else if (trafficData === 'severeness') {
    return d3.mean(v, d => parse(d.FileZwaarte));
  }
}

function selectWeatherData(v) {
  if (weatherData === 'precipitation') {
    return d3.mean(v, d => parse(d.precipitationAmount) * 0.1);
  } else if (weatherData === 'temperature') {
    return d3.mean(v, d => parse(d.meanTemp));
  } else if (weatherData === 'visibility') {
    return d3.mean(v, d => parse(d.minVisibility));
  }
}

function selectTrafficDataDescription() {
  if (trafficData === 'length') {
    return 'Total length (km)';
  } else if (trafficData === 'duration') {
    return 'Total duration (min)'
  } else if (trafficData === 'severeness') {
    return'Average severeness (length * duration)'
  }
}

function selectWeatherDataDescription() {
  if (weatherData === 'precipitation') {
    return 'Average precipitation (ml)';
  } else if (weatherData === 'temperature') {
    return 'Average temperature (celsius)'
  } else if (weatherData === 'visibility') {
    return'Average visibility (m)'
  }
}

function selectTrafficDataUnit() {
  if (trafficData === 'length') {
    return ' km';
  } else if (trafficData === 'duration') {
    return ' min'
  } else if (trafficData === 'severeness') {
    return''
  }
}

function selectWeatherDataUnit() {
  if (weatherData === 'precipitation') {
    return ' ml';
  } else if (weatherData === 'temperature') {
    return ' °C'
  } else if (weatherData === 'visibility') {
    return' m'
  }
}

function selectWeatherDataTooltip(d) {
  if (weatherData === 'precipitation') {
    return d.precipitation.toFixed(1) + selectWeatherDataUnit();
  } else if (weatherData === 'temperature') {
    return d.temperature.toFixed(1) + selectWeatherDataUnit();
  } else if (weatherData === 'visibility') {
    return d.visibility.toFixed(1) + selectWeatherDataUnit();
  }
}

d3.json('nl_grenzen_topo.json').then(function(json) {
  geoData = json;
});

d3.json('hmpaal_data.json').then(function(json) {
  hmData = json;
  currentDate = parseDate(d3.select('#date').node().value)
  var weatherSelection = document.getElementById('weatherSelection');
  var trafficSelection = document.getElementById('trafficSelection');
  weatherData = weatherSelection.options[weatherSelection.selectedIndex].value;
  trafficData = trafficSelection.options[trafficSelection.selectedIndex].value;
  drawMap();
});

d3.csv('files_2020_with_weather.csv').then(function(csv) {
  fileData = csv;
  draw();
})
