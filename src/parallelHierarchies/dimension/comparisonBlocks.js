import * as d3 from 'd3';

import ValueProvider, { CATEGORY_COMPARISON_MODES } from '../itemValueProvider';

const COMPARISON_BLOCK_GREY = '#555';

export default function ComparisonBlocks() {
  let root;

  let width;
  let parentHeight;
  let x;
  let color;

  let itemList;
  let scaleY;
  let isHidden;
  let isDrilledDown;

  let topBlock;
  let bottomBlock;

  const blocks = function(selection) {
    root = selection;

    draw();
  };

  let draw = function() {
    appendTopBlock();
    appendBottomBlock();
  };

  blocks.update = function() {
    const differenceHeight = getDifferenceHeight();

    const fillColor = getFillColor();

    topBlock
      .attr('x', (d, i) => (i === 0 ? -x : x))
      .classed('hidden', isHidden)
      .attr('fill', fillColor)
      .attr('width', width)
      .attr('height', differenceHeight / 2);

    bottomBlock
      .attr('x', (d, i) => (i === 0 ? -x : x))
      .attr('y', parentHeight - (differenceHeight / 2))
      .classed('hidden', isHidden)
      .attr('fill', fillColor)
      .attr('width', width)
      .attr('height', differenceHeight / 2);
  };

  let appendTopBlock = function() {
    const top = root.append('g').attr('class', 'top');

    topBlock = top.selectAll('rect').data(['left', 'right']).enter()
      .append('rect')
      .attr('class', 'comparisonBlock');
  };

  let appendBottomBlock = function() {
    const bottom = root.append('g').attr('class', 'top');

    bottomBlock = bottom.selectAll('rect').data(['left', 'right']).enter()
      .append('rect')
      .attr('class', 'comparisonBlock bottom');
  };

  let getDifferenceHeight = function() {
    if (isDrilledDown) return 0;
    if (parentHeight === 0) return 0;

    const primaryDimension = ValueProvider.primaryAggregateDimension;
    const secondaryDimension = ValueProvider.secondaryAggregateDimension;
    const primaryValue = ValueProvider.getActiveItemValueSum(itemList, primaryDimension);
    const secondaryValue = ValueProvider.getActiveItemValueSum(itemList, secondaryDimension);

    const greaterValue = Math.max(primaryValue, secondaryValue);

    if (greaterValue === 0) return 0;

    const valueSum = primaryValue + secondaryValue;
    const valueDiff = Math.abs(primaryValue - secondaryValue);

    const height = (valueDiff / greaterValue) * valueSum;

    return scaleY(height);
  };

  let getFillColor = function() {
    const primaryDimension = ValueProvider.primaryAggregateDimension;
    const secondaryDimension = ValueProvider.secondaryAggregateDimension;
    const primaryValue = ValueProvider.getActiveItemValueSum(itemList, primaryDimension);
    const secondaryValue = ValueProvider.getActiveItemValueSum(itemList, secondaryDimension);

    let fillColor;

    if (ValueProvider.categoryComparisonMode === CATEGORY_COMPARISON_MODES.OPACITY) {
      if (primaryValue > secondaryValue) {
        fillColor = d3.rgb(color).brighter(0.5);
      } else {
        fillColor = d3.rgb(color).darker(0.5);
      }
    } else if (ValueProvider.categoryComparisonMode === CATEGORY_COMPARISON_MODES.GREY) {
      fillColor = COMPARISON_BLOCK_GREY;
    } else if (ValueProvider.categoryComparisonMode === CATEGORY_COMPARISON_MODES.NONE) {
      fillColor = color;
    }

    return fillColor;
  };

  blocks.itemList = function(_) {
    if (!arguments.length) return itemList;
    itemList = _;
    return blocks;
  };

  blocks.scaleY = function(_) {
    if (!arguments.length) return scaleY;
    scaleY = _;
    return blocks;
  };

  blocks.x = function(_) {
    if (!arguments.length) return x;
    x = _;
    return blocks;
  };

  blocks.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return blocks;
  };

  blocks.color = function(_) {
    if (!arguments.length) return color;
    color = _;
    return blocks;
  };

  blocks.isHidden = function(_) {
    if (!arguments.length) return isHidden;
    isHidden = _;
    return blocks;
  };

  blocks.isDrilledDown = function(_) {
    if (!arguments.length) return isDrilledDown;
    isDrilledDown = _;
    return blocks;
  };

  blocks.parentHeight = function(_) {
    if (!arguments.length) return parentHeight;
    parentHeight = _;
    return blocks;
  };

  return blocks;
}