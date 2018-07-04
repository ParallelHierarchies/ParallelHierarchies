parallelHierarchies.percentageBars = function() {
  let max = 100;
  let visible = 28;
  let dimensions = {
    A: { value: 35, color: '#afe' },
    B: { value: 78, color: '#efa' },
    C: { value: 42, color: '#fea' },
  };

  const calculations = ['Visible Data', 'Filtered Data'];

  let width = 100;
  let height = 70;
  let padding = 20;

  let barWidth = 25;

  let scaleX = d3.scaleBand().paddingInner(.2);
  let scaleY = d3.scaleLinear();

  let root;
  let svg;
  let dropdownMenu;
  let bars;
  let dimensionBars;
  let hundredPercentLine;

  let generator = function(selection) {
    root = selection;

    width = (Object.keys(dimensions).length + 1) * barWidth + padding*3;

    root.style('width', `${width}px`);
    dropdownMenu = root.append('select').style('width', `${width}px`);

    svg = root.append('svg')
      .attr('width', width)
      .attr('height', height + padding);

    scaleX
      .domain(d3.range(Object.keys(dimensions).length + 1))
      .range([0, width - padding]);

    scaleY
      .domain([0, max])
      .range([0, height]);

    drawDropDownMenu();
    drawBars();
    appendHundredPercentLine();
  };

  generator.updateView = function() {
    width = (Object.keys(dimensions).length + 1) * barWidth + padding*3;

    root.style('width', `${width}px`);
    svg.attr('width', width);
    dropdownMenu.style('width', `${width}px`);

    scaleX
      .domain(d3.range(Object.keys(dimensions).length + 1))
      .range([0, width - padding]);

    drawBars();
    appendHundredPercentLine();
  };

  let drawDropDownMenu = function() {
    dropdownMenu
      .attr('class', 'inversion')
      .on('change', () => {
        generator.updateView();
      });

    dropdownMenu.selectAll('option').data(calculations).enter()
      .append('option')
        .text(d => d);
  };

  let drawBars = function() {
    svg.selectAll('g.bars').remove();
    bars = svg.append('g')
      .attr('class', 'bars')
      .attr('transform', `translate(${padding/2},${padding})`);

    appendBarForTotalVisiblePercentage();
    appendBarsForActivePercentagePerDimension();
  };

  let appendBarForTotalVisiblePercentage = function() {
    bars.selectAll('g.visible').remove();
    visibleBar = bars.append('g').attr('class', 'visible');

    visibleBar.append('rect')
      .attr('width', barWidth)
      .attr('height', convertToVisibleHeight(visible))
      .attr('fill', '#ccc')
      .attr('x', scaleX(0))
      .attr('y', height - convertToVisibleHeight(visible))
      .append('title')
        .text('filtered in total');

    visibleBar.append('text')
      .style('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('x', scaleX(0) + scaleX.bandwidth() / 2)
      .attr('y', height - convertToVisibleHeight(visible) - 5)
      .text(getPercentageText(visible));
  };

  let appendBarsForActivePercentagePerDimension = function() {
    bars.selectAll('g.dimensions').remove();
    dimensionBars = bars.append('g')
      .attr('class', 'dimensions')
      .attr('transform', `translate(${barWidth + padding},0)`);

    let dimensionList = Object.values(dimensions);
    let dimensionNames = Object.keys(dimensions);

    dimensionBars.selectAll('rect').data(dimensionList).enter()
      .append('rect')
        .attr('width', barWidth)
        .attr('height', d => convertToVisibleHeight(d.value))
        .attr('x', (d, i) => scaleX(i))
        .attr('y', d => height - convertToVisibleHeight(d.value))
        .attr('fill', d => d.color)
        .append('title')
          .text((d, i) => dimensionNames[i]);

    dimensionBars.selectAll('text').data(dimensionList).enter()
      .append('text')
        .style('text-anchor', 'middle')
        .attr('font-size', 10)
        .attr('x', (d, i) => scaleX(i) + scaleX.bandwidth() / 2)
        .attr('y', d => height - convertToVisibleHeight(d.value) - 5)
        .text(d => getPercentageText(d.value));
  };

  let appendHundredPercentLine = function() {
    hundredPercentLine = bars.append('line')
      .attr('class', 'hundred_percent')
      .attr('x1', 0)
      .attr('x1', width)
      .attr('stroke', '#ccc')
      .attr('stroke-dasharray', '2,2')
      .attr('stroke-width', 2);

  };

  let convertToVisibleHeight = function(value) {
    const calculationStrategy = dropdownMenu.node().value;
    let barHeight = scaleY(value);

    if (calculationStrategy === 'Filtered Data') {
      barHeight = scaleY(max - value);
    }
    // guarantee that bars have at least height of 2 pixels so they are never "invisible"
    return Math.max(2, barHeight);
  };

  let getPercentageText = function(value) {
    let ratio = value / scaleY.domain()[1];
    const calculationStrategy = dropdownMenu.node().value;

    if (calculationStrategy === 'Filtered Data') ratio = 1 - ratio;

    let percentage = Math.round(ratio * 100);

    if (ratio < 0.01) {
      percentage = parseInt(ratio * 10000, 10) / 100;
    } else if (ratio < 0.1) {
      percentage = parseInt(ratio * 1000, 10) / 10;
    }

    if (calculationStrategy === 'Filtered Data' && ratio > 0.99) {
      percentage = parseInt(ratio * 1000, 10) / 10;
    }

    return `${percentage}%`
  };

  generator.max = function(_) {
    if (!arguments.length) return max;
    max = _;
    return generator;
  };

  generator.visible = function(_) {
    if (!arguments.length) return visible;
    visible = _;
    return generator;
  };

  generator.dimensions = function(_) {
    if (!arguments.length) return dimensions;
    dimensions = _;
    return generator;
  };

  generator.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return generator;
  };

  generator.barWidth = function(_) {
    if (!arguments.length) return barWidth;
    barWidth = _;
    return generator;
  };

  return generator;
};