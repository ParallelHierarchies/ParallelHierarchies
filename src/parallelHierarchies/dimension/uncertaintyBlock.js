import * as d3 from 'd3';

import ValueProvider from '../itemValueProvider';
import { CATEGORY_UNCERTAINTY_MODES } from '../uncertaintyProvider';

const UncertaintyBlock = function() {
  let root;

  let whiteUncertaintyBlock;
  let opacityUncertaintyBlock;
  let gapUncertaintyBlock;

  let parentCategory;
  let itemList;
  let scaleY;
  let isHidden;

  let x;
  let height;
  let width;
  let fill;

  const easing = d3.easePolyOut;

  const block = function(selection) {
    root = selection;

    draw();
  };

  let draw = function() {
    drawWhiteUncertaintyBlock();
    drawOpacityUncertaintyBlock();
    drawGapUncertaintyBlock();
  };

  const drawWhiteUncertaintyBlock = function() {
    whiteUncertaintyBlock = root.append('g').attr('class', 'whiteUncertainty');

    whiteUncertaintyBlock.selectAll('rect.top').data(['left', 'right']).enter()
      .append('rect')
      .attr('class', 'top');

    whiteUncertaintyBlock.selectAll('rect.bottom').data(['left', 'right']).enter()
      .append('rect')
      .attr('class', 'bottom');
  };

  const updateWhiteUncertaintyBlock = function(useTransition = true) {
    const duration = useTransition ? 400 : 0;
    const uncertainHeight = ValueProvider.getUncertaintyHeightForItemList(itemList) / 2;

    whiteUncertaintyBlock.classed('hidden', height === 0);

    whiteUncertaintyBlock.selectAll('rect').classed('hidden', isHidden);
    whiteUncertaintyBlock.selectAll('rect')
      .attr('fill', '#fff')
      .attr('stroke', fill)
      .attr('stroke-width', 1)
      .attr('width', width - 1);

    whiteUncertaintyBlock.selectAll('rect.top').transition().duration(duration).ease(easing)
      .attr('x', d => (d === 'left' ? -x : x) + 0.5)
      .attr('y', -uncertainHeight / 2)
      .attr('height', uncertainHeight / 2);

    whiteUncertaintyBlock.selectAll('rect.bottom').transition().duration(duration).ease(easing)
      .attr('x', d => (d === 'left' ? -x : x) + 0.5)
      .attr('y', height)
      .attr('height', uncertainHeight / 2);
  };

  const drawOpacityUncertaintyBlock = function() {
    opacityUncertaintyBlock = root.append('g').attr('class', 'opacityUncertainty');

    opacityUncertaintyBlock.selectAll('rect.top').data(['left', 'right']).enter()
      .append('rect')
      .style('fill-opacity', 0.6)
      .attr('class', 'top');

    opacityUncertaintyBlock.selectAll('rect.bottom').data(['left', 'right']).enter()
      .append('rect')
      .style('fill-opacity', 0.6)
      .attr('class', 'bottom');
  };

  const updateOpacityUncertaintyBlock = function(useTransition = true) {
    const duration = useTransition ? 350 : 0;
    const uncertainHeight = ValueProvider.getUncertaintyHeightForItemList(itemList) / 2;

    opacityUncertaintyBlock.classed('hidden', height === 0 || uncertainHeight === 0);

    opacityUncertaintyBlock.selectAll('rect').classed('hidden', isHidden);
    opacityUncertaintyBlock.selectAll('rect').transition().duration(duration).ease(easing)
      .attr('fill', fill)
      .attr('width', width);

    opacityUncertaintyBlock.selectAll('rect.top').transition().duration(duration).ease(easing)
      .attr('x', d => (d === 'left' ? -x : x))
      .attr('y', -uncertainHeight / 2)
      .attr('height', uncertainHeight / 2);

    opacityUncertaintyBlock.selectAll('rect.bottom').transition().duration(duration).ease(easing)
      .attr('x', d => (d === 'left' ? -x : x))
      .attr('y', height)
      .attr('height', uncertainHeight / 2);
  };

  const drawGapUncertaintyBlock = function() {
    gapUncertaintyBlock = root.append('g').attr('class', 'gapUncertainty');

    gapUncertaintyBlock.selectAll('path.top').data(['left', 'right']).enter()
      .append('path')
      .attr('class', 'top')
      .attr('d', 'M0,0');

    gapUncertaintyBlock.selectAll('path.bottom').data(['left', 'right']).enter()
      .append('path')
      .attr('class', 'bottom')
      .attr('d', 'M0,0');
  };

  const topGapPath = function() {

    const size = 2;
    const uncertainHeight = ValueProvider.getUncertaintyHeightForItemList(itemList) / 4;

    if (uncertainHeight === 0) return '';

    return `M0,0
            L0,${uncertainHeight}
            L${width},${uncertainHeight}
            L${width},0
            L${width - size},0
            L${width - size},${uncertainHeight - size}
            L${size},${uncertainHeight - size}
            L${size},0
            Z`;
  };

  const bottomGapPath = function() {

    const size = 2;
    const uncertainHeight = ValueProvider.getUncertaintyHeightForItemList(itemList) / 4;

    if (uncertainHeight === 0) return '';

    return `M0,0
            L0,${uncertainHeight}
            L${size},${uncertainHeight}
            L${size},${size}
            L${width - size},${size}
            L${width - size},${uncertainHeight}
            L${width},${uncertainHeight}
            L${width},0
            Z`;
  };

  const updateGapUncertaintyBlock = function(useTransition = false) {
    const duration = useTransition ? 350 : 0;
    const uncertainHeight = ValueProvider.getUncertaintyHeightForItemList(itemList) / 2;

    gapUncertaintyBlock.classed('hidden', height === 0 || uncertainHeight === 0);

    gapUncertaintyBlock.selectAll('path')
      .attr('fill', fill)
      .classed('hidden', isHidden);

    gapUncertaintyBlock.selectAll('path.top').transition().duration(duration).ease(easing)
      .attr('transform', d => `translate(${d === 'left' ? -x : x},${-uncertainHeight / 2})`)
      .attr('d', topGapPath);

    gapUncertaintyBlock.selectAll('path.bottom').transition().duration(duration).ease(easing)
      .attr('transform', d => `translate(${d === 'left' ? -x : x},${height})`)
      .attr('d', bottomGapPath);
  };

  block.update = function(useTransition = true) {
    whiteUncertaintyBlock.classed('hidden', true);
    opacityUncertaintyBlock.classed('hidden', true);
    gapUncertaintyBlock.classed('hidden', true);

    if (parentCategory.isDrilledDown()) return;

    if (ValueProvider.categoryUncertaintyMode === CATEGORY_UNCERTAINTY_MODES.WHITE) {
      updateWhiteUncertaintyBlock(useTransition);
    } else if (ValueProvider.categoryUncertaintyMode === CATEGORY_UNCERTAINTY_MODES.OPACITY) {
      updateOpacityUncertaintyBlock();
    } else if (ValueProvider.categoryUncertaintyMode === CATEGORY_UNCERTAINTY_MODES.GAP) {
      updateGapUncertaintyBlock();
    }
  };

  // GETTERS AND SETTERS ///////////////////////////////////////////////////////////////////////////

  block.parentCategory = function(_) {
    if (!arguments.length) return parentCategory;
    parentCategory = _;
    return block;
  };

  block.itemList = function(_) {
    if (!arguments.length) return itemList;
    itemList = _;
    return block;
  };

  block.x = function(_) {
    if (!arguments.length) return x;
    x = _;
    return block;
  };

  block.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return block;
  };

  block.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return block;
  };

  block.fill = function(_) {
    if (!arguments.length) return fill;
    fill = _;
    return block;
  };

  block.scaleY = function(_) {
    if (!arguments.length) return scaleY;
    scaleY = _;
    return block;
  };

  block.isHidden = function(_) {
    if (!arguments.length) return isHidden;
    isHidden = _;
    return block;
  };

  return block;
};

export default UncertaintyBlock;